const express = require('express');
const ScheduledPayment = require('../models/ScheduledPayment');
const { protect } = require('../middleware/auth');
const {
  validatePayload,
  normalizePayload,
  initialStatus,
  processDuePayments,
  runNow,
  firstOccurrence,
  parseDateInput,
} = require('../services/scheduledPaymentService');

// Statuses a schedule may still be edited through. Finished work is frozen so
// the history stays meaningful.
const EDITABLE_STATUSES = ['scheduled', 'paused', 'failed'];

function dateKey(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Everything the scheduler derives the next run from. */
function scheduleSignature(doc) {
  return [
    doc.frequency,
    dateKey(doc.startDate),
    doc.scheduledTime,
    dateKey(doc.endDate),
    doc.maxOccurrences == null ? '' : String(doc.maxOccurrences),
  ].join('|');
}

function bodyScheduleSignature(body, doc) {
  const frequency = body.frequency !== undefined ? body.frequency : doc.frequency;
  const startDate =
    body.startDate !== undefined && body.startDate !== ''
      ? dateKey(parseDateInput(body.startDate))
      : dateKey(doc.startDate);
  const time = body.time || body.scheduledTime || doc.scheduledTime;
  const endDate =
    body.endDate !== undefined && body.endDate !== null && body.endDate !== ''
      ? dateKey(parseDateInput(body.endDate))
      : dateKey(doc.endDate);
  const maxOccurrences =
    body.maxOccurrences !== undefined && body.maxOccurrences !== null && body.maxOccurrences !== ''
      ? String(Number(body.maxOccurrences))
      : doc.maxOccurrences == null
        ? ''
        : String(doc.maxOccurrences);

  return [frequency, startDate, time, endDate, maxOccurrences].join('|');
}

/**
 * Builds a router for one schedule family. Scheduled payments and auto pays
 * share every rule and handler — only the `isAutoPay` flag and the list key
 * differ — so there is exactly one implementation of the behaviour below.
 */
const buildRouter = ({ isAutoPay = false, resourceKey = 'scheduledPayments' } = {}) => {
  const router = express.Router();
  const kind = isAutoPay ? 'auto pay' : 'scheduled payment';
  const notFoundMessage = `This ${kind} was not found`;

  router.use(protect);

  const findOwned = async (req, res) => {
    let doc;
    try {
      doc = await ScheduledPayment.findById(req.params.id);
    } catch (error) {
      if (error.kind === 'ObjectId') {
        res.status(400).json({ message: `Invalid ${kind} id` });
        return null;
      }
      throw error;
    }

    if (!doc) {
      res.status(404).json({ message: notFoundMessage });
      return null;
    }

    if (doc.user.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: `Not authorized to access this ${kind}` });
      return null;
    }

    if (doc.isAutoPay !== isAutoPay) {
      res.status(404).json({ message: notFoundMessage });
      return null;
    }

    return doc;
  };

  // @route   GET /api/scheduled-payments
  // @desc    List the logged in user's schedules
  // @access  Private
  router.get('/', async (req, res) => {
    try {
      // Serverless hosts have no background loop: settle whatever became due
      // before answering so the list always reflects reality.
      try {
        await processDuePayments({ limit: 5 });
      } catch (error) {
        console.error(`[scheduler] catch-up on list failed: ${error.message}`);
      }

      const filter = { user: req.user._id, isAutoPay };
      if (req.query.status) filter.status = req.query.status;
      if (req.query.frequency) filter.frequency = req.query.frequency;

      const items = await ScheduledPayment.find(filter);

      // Upcoming (soonest first) ahead of finished/cancelled schedules.
      items.sort((a, b) => {
        const at = a.nextRunAt ? a.nextRunAt.getTime() : Number.MAX_SAFE_INTEGER;
        const bt = b.nextRunAt ? b.nextRunAt.getTime() : Number.MAX_SAFE_INTEGER;
        if (at !== bt) return at - bt;
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      });

      res.json({ [resourceKey]: items });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // @route   GET /api/scheduled-payments/:id
  // @desc    Get a single schedule with its execution history
  // @access  Private
  router.get('/:id', async (req, res) => {
    try {
      const doc = await findOwned(req, res);
      if (!doc) return;
      res.json(doc);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // @route   POST /api/scheduled-payments
  // @desc    Create a schedule
  // @access  Private
  router.post('/', async (req, res) => {
    try {
      const body = req.body || {};
      const validationError = validatePayload(body, { isAutoPay });
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      const normalized = normalizePayload(body, { isAutoPay });

      const doc = await ScheduledPayment.create({
        ...normalized,
        status: initialStatus(body, normalized),
        failureCount: 0,
        user: req.user._id,
      });

      res.status(201).json(doc);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // @route   PUT /api/scheduled-payments/:id
  // @desc    Update a schedule that has not finished yet
  // @access  Private
  router.put('/:id', async (req, res) => {
    try {
      const doc = await findOwned(req, res);
      if (!doc) return;

      if (!EDITABLE_STATUSES.includes(doc.status)) {
        return res.status(400).json({
          message:
            doc.status === 'processing'
              ? 'This schedule is currently processing and cannot be edited'
              : `A ${doc.status} ${kind} cannot be edited`,
        });
      }

      const body = req.body || {};
      const { status: requestedStatus, ...fields } = body;
      const merged = { ...doc.toObject(), ...fields };
      delete merged.status;

      const validationError = validatePayload(merged, { isAutoPay });
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      if (requestedStatus !== undefined && requestedStatus !== null && requestedStatus !== '') {
        if (!['scheduled', 'paused'].includes(requestedStatus)) {
          return res.status(400).json({ message: 'Status must be scheduled or paused' });
        }
      }

      const scheduleChanged = bodyScheduleSignature(fields, doc) !== scheduleSignature(doc);
      const patch = normalizePayload(merged, { isAutoPay });

      Object.assign(doc, patch);

      if (scheduleChanged) {
        const occurrence = firstOccurrence(doc.startDate, doc.scheduledTime, doc.frequency, {
          now: new Date(),
          endDate: doc.endDate,
        });
        doc.nextRunAt = occurrence;
        doc.failureCount = 0;
        if (doc.frequency !== 'one-time' && !occurrence) {
          doc.status = 'completed';
        } else if (doc.status === 'failed') {
          doc.status = 'scheduled';
        }
      }

      if (requestedStatus === 'paused') {
        doc.status = 'paused';
      } else if (requestedStatus === 'scheduled' && doc.status !== 'completed') {
        if (!doc.nextRunAt) {
          const occurrence = firstOccurrence(doc.startDate, doc.scheduledTime, doc.frequency, {
            now: new Date(),
            endDate: doc.endDate,
          });
          if (!occurrence) {
            return res.status(400).json({ message: 'This schedule has no remaining occurrences' });
          }
          doc.nextRunAt = occurrence;
        }
        doc.status = 'scheduled';
        doc.failureCount = 0;
      }

      const updated = await doc.save();
      res.json(updated);
    } catch (error) {
      if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: `Invalid ${kind} id` });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // @route   POST /api/scheduled-payments/:id/pause
  // @desc    Pause a schedule
  // @access  Private
  router.post('/:id/pause', async (req, res) => {
    try {
      const doc = await findOwned(req, res);
      if (!doc) return;

      if (doc.status === 'paused') {
        return res.status(400).json({ message: `This ${kind} is already paused` });
      }
      if (!['scheduled', 'failed'].includes(doc.status)) {
        return res.status(400).json({ message: `A ${doc.status} ${kind} cannot be paused` });
      }

      doc.status = 'paused';
      const updated = await doc.save();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // @route   POST /api/scheduled-payments/:id/resume
  // @desc    Resume a paused schedule or retry a failed one
  // @access  Private
  router.post('/:id/resume', async (req, res) => {
    try {
      const doc = await findOwned(req, res);
      if (!doc) return;

      if (!['paused', 'failed'].includes(doc.status)) {
        return res.status(400).json({ message: `A ${doc.status} ${kind} cannot be resumed` });
      }

      if (!doc.nextRunAt || doc.nextRunAt.getTime() <= Date.now()) {
        const occurrence =
          doc.frequency === 'one-time'
            ? new Date()
            : firstOccurrence(doc.startDate, doc.scheduledTime, doc.frequency, {
                now: new Date(),
                endDate: doc.endDate,
              });

        if (!occurrence) {
          return res.status(400).json({ message: 'This schedule has no remaining occurrences' });
        }
        doc.nextRunAt = occurrence;
      }

      doc.status = 'scheduled';
      doc.failureCount = 0;
      const updated = await doc.save();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // @route   POST /api/scheduled-payments/:id/cancel
  // @desc    Cancel a schedule permanently
  // @access  Private
  router.post('/:id/cancel', async (req, res) => {
    try {
      const doc = await findOwned(req, res);
      if (!doc) return;

      if (doc.status === 'cancelled') {
        return res.status(400).json({ message: `This ${kind} is already cancelled` });
      }
      if (doc.status === 'processing') {
        return res.status(400).json({ message: 'This schedule is processing right now' });
      }

      doc.status = 'cancelled';
      doc.nextRunAt = null;
      const updated = await doc.save();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // @route   POST /api/scheduled-payments/:id/run
  // @desc    Execute a schedule immediately (also used to retry a failure)
  // @access  Private
  router.post('/:id/run', async (req, res) => {
    try {
      const doc = await findOwned(req, res);
      if (!doc) return;

      const result = await runNow(doc);
      if (!result.ok) {
        return res.status(result.code || 500).json({ message: result.message });
      }

      const updated = await ScheduledPayment.findById(doc._id);
      res.json(updated || doc);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // @route   DELETE /api/scheduled-payments/:id
  // @desc    Delete a schedule
  // @access  Private
  router.delete('/:id', async (req, res) => {
    try {
      const doc = await findOwned(req, res);
      if (!doc) return;

      if (doc.status === 'processing') {
        return res.status(400).json({ message: 'This schedule is processing right now' });
      }

      await doc.deleteOne();
      res.json({ message: `${kind[0].toUpperCase()}${kind.slice(1)} removed` });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  return router;
};

module.exports = buildRouter({ isAutoPay: false, resourceKey: 'scheduledPayments' });
module.exports.buildRouter = buildRouter;
