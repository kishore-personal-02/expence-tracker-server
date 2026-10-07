const crypto = require('crypto');
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const ScheduledPayment = require('../models/ScheduledPayment');

const { FREQUENCIES } = ScheduledPayment;

// A row stuck in `processing` longer than this is assumed to have been
// interrupted (server restart / crashed invocation) and gets recovered.
const STALE_MS = 5 * 60 * 1000;
// Keep the embedded execution history bounded so the document cannot grow
// without limit for long-running daily schedules.
const MAX_EXECUTIONS = 100;
// Automatic retries for a failing recurring schedule stop after this many
// consecutive failures (failureCount resets on the next success).
const MAX_FAILURES = 3;
// Hard guard on "fast-forward to the next future occurrence" loops.
const MAX_ADVANCE_STEPS = 5000;
// How often a single process may kick off a background catch-up run.
const CATCH_UP_INTERVAL_MS = 60 * 1000;
const CATCH_UP_LIMIT = 10;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

let catchUpAt = 0;
let catchUpInFlight = false;

/* =============================================
   Date helpers
   ============================================= */

/** Parses `YYYY-MM-DD` as a local date; anything else through `new Date`. */
function parseDateInput(value) {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
      return null;
    }
    return date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Applies a `HH:MM` wall-clock time to a date (seconds/ms cleared). */
function applyTime(date, time) {
  const [hours, minutes] = (time || '00:00').split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours || 0, minutes || 0, 0, 0);
  return result;
}

function endOfDay(date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function startOfLocalDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function truncate(text, max) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

/* =============================================
   Recurrence
   ============================================= */

/**
 * Next occurrence after `current`, or null when the series is over
 * (one-time, end date passed, or max occurrences reached).
 *
 * `occurrenceCount` is how many attempts have already been made, so the
 * candidate being computed is attempt number `occurrenceCount + 1`.
 */
function computeNext(current, frequency, options = {}) {
  if (!FREQUENCIES.includes(frequency) || frequency === 'one-time') return null;

  const { anchorDate, time, endDate, maxOccurrences, occurrenceCount = 0 } = options;
  if (maxOccurrences != null && occurrenceCount + 1 > maxOccurrences) return null;

  const anchor = anchorDate || current;
  let next;

  if (frequency === 'daily') {
    next = new Date(current);
    next.setDate(next.getDate() + 1);
  } else if (frequency === 'weekly') {
    next = new Date(current);
    next.setDate(next.getDate() + 7);
  } else if (frequency === 'monthly') {
    // Anchor on the original day-of-month so 31 Jan -> 28 Feb -> 31 Mar.
    const day = anchor.getDate();
    next = new Date(current);
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    next.setDate(Math.min(day, daysInMonth(next.getFullYear(), next.getMonth())));
  } else if (frequency === 'yearly') {
    const month = anchor.getMonth();
    const day = anchor.getDate();
    next = new Date(current.getFullYear() + 1, month, 1);
    next.setDate(Math.min(day, daysInMonth(next.getFullYear(), month)));
  } else {
    return null;
  }

  const withTime = applyTime(next, time);
  if (endDate && withTime.getTime() > endOfDay(endDate).getTime()) return null;
  return withTime;
}

/**
 * First occurrence for a schedule. A recurring schedule whose start date has
 * already passed is fast-forwarded to the next *future* slot so creating (or
 * resuming) an old schedule never triggers a burst of catch-up payments.
 * Returns `null` when nothing is left to run.
 */
function firstOccurrence(startDate, time, frequency, options = {}) {
  const now = options.now || new Date();
  const endDate = options.endDate || null;
  let occurrence = applyTime(startDate, time);

  if (frequency === 'one-time') return occurrence;

  const base = { anchorDate: startDate, time, endDate, occurrenceCount: 0 };

  let steps = 0;
  while (occurrence.getTime() <= now.getTime()) {
    if (++steps > MAX_ADVANCE_STEPS) return null;
    const next = computeNext(occurrence, frequency, base);
    if (!next) return null;
    occurrence = next;
  }

  return occurrence;
}

/** Advances to the next occurrence that lies strictly in the future. */
function fastForwardToFuture(from, frequency, options) {
  let occurrence = from;
  let steps = 0;

  while (occurrence && occurrence.getTime() <= (options.now || new Date()).getTime()) {
    if (++steps > MAX_ADVANCE_STEPS) return null;
    occurrence = computeNext(occurrence, frequency, options);
  }

  return occurrence;
}

/* =============================================
   Validation / normalisation
   ============================================= */

/** Returns an error message, or null when the payload is acceptable. */
function validatePayload(body = {}, { isAutoPay = false } = {}) {
  const payee = String(body.payee || '').trim();
  if (!payee) return 'Payee is required';
  if (payee.length > 120) return 'Payee cannot exceed 120 characters';

  const description = String(body.description || '').trim();
  if (!description) return 'Description is required';
  if (description.length > 200) return 'Description cannot exceed 200 characters';

  const amount = Number(body.amount);
  if (!body.amount || !Number.isFinite(amount)) return 'Amount is required';
  if (amount <= 0) return 'Amount must be greater than zero';
  if (amount > 1e12) return 'Amount is too large';

  const type = body.type || 'expense';
  if (!['expense', 'income'].includes(type)) return 'Type must be expense or income';

  if (type !== 'income') {
    const category = String(body.category || '').trim();
    if (!category) return 'Category is required';
    if (category.length > 60) return 'Category cannot exceed 60 characters';
  }

  const frequency = body.frequency || 'one-time';
  if (!FREQUENCIES.includes(frequency)) return 'Invalid payment frequency';

  const startDate = parseDateInput(body.startDate);
  if (!startDate) return 'A valid start date is required';

  const time = String(body.time || body.scheduledTime || '00:00');
  if (!TIME_PATTERN.test(time)) return 'Time must be in HH:MM format';

  if (body.endDate !== undefined && body.endDate !== null && body.endDate !== '') {
    const endDate = parseDateInput(body.endDate);
    if (!endDate) return 'End date is not a valid date';
    if (endOfDay(endDate).getTime() < startOfLocalDay(startDate).getTime()) {
      return 'End date cannot be before the start date';
    }
    if (frequency === 'one-time') {
      return 'An end date only applies to recurring payments';
    }
  }

  if (body.maxOccurrences !== undefined && body.maxOccurrences !== null && body.maxOccurrences !== '') {
    const max = Number(body.maxOccurrences);
    if (!Number.isInteger(max) || max < 1) {
      return 'Maximum occurrences must be a whole number of at least 1';
    }
    if (frequency === 'one-time') {
      return 'Maximum occurrences only apply to recurring payments';
    }
  }

  const paymentMethod = body.paymentMethod || 'cash';
  if (!['cash', 'upi', 'bank'].includes(paymentMethod)) return 'Invalid payment method';

  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!['scheduled', 'paused'].includes(body.status)) {
      return 'Status must be scheduled or paused';
    }
  }

  if (isAutoPay && body.status === 'paused' && body.isActive === true) {
    return 'An auto pay cannot be active and paused at the same time';
  }

  return null;
}

/** Builds the Mongoose-ready document (or patch) from a validated payload. */
function normalizePayload(body = {}, { isAutoPay = false, now = new Date() } = {}) {
  const type = body.type === 'income' ? 'income' : 'expense';
  const paymentMethod = body.paymentMethod || 'cash';
  const frequency = body.frequency || 'one-time';
  const startDate = parseDateInput(body.startDate);
  const time = String(body.time || body.scheduledTime || '00:00');
  const endDateRaw = body.endDate === undefined || body.endDate === null || body.endDate === ''
    ? null
    : parseDateInput(body.endDate);
  const maxOccurrencesRaw =
    body.maxOccurrences === undefined || body.maxOccurrences === null || body.maxOccurrences === ''
      ? null
      : Number(body.maxOccurrences);

  const occurrence = firstOccurrence(startDate, time, frequency, { now, endDate: endDateRaw });

  return {
    payee: String(body.payee || '').trim(),
    description: String(body.description || '').trim(),
    amount: Number(body.amount),
    type,
    category: type === 'income' ? 'Income' : String(body.category || '').trim(),
    paymentMethod,
    upiApp: paymentMethod === 'upi' ? String(body.upiApp || 'Other').trim() : null,
    bankName: paymentMethod === 'bank' ? String(body.bankName || '').trim() || null : null,
    frequency,
    startDate,
    scheduledTime: time,
    endDate: endDateRaw,
    maxOccurrences: maxOccurrencesRaw,
    nextRunAt: occurrence,
    isAutoPay,
  };
}

/** Status a freshly created schedule starts in. */
function initialStatus(body = {}, normalized = {}) {
  if (normalized.frequency !== 'one-time' && !normalized.nextRunAt) return 'completed';
  return body.status === 'paused' ? 'paused' : 'scheduled';
}

/* =============================================
   Execution
   ============================================= */

function dueFilter(now) {
  return {
    nextRunAt: { $lte: now },
    $or: [
      { status: 'scheduled' },
      // A failing recurring schedule retries at its next occurrence only.
      { status: 'failed', frequency: { $ne: 'one-time' } },
    ],
  };
}

/** Only one worker may ever claim a given (payment, occurrence) pair. */
function claimFilter(doc, occurrenceAt) {
  return {
    _id: doc._id,
    nextRunAt: occurrenceAt,
    $or: [{ status: 'scheduled' }, { status: 'failed', frequency: { $ne: 'one-time' } }],
    // Belt and braces: never re-charge a slot that already has a live
    // execution record. A previous *failed* attempt may be retried.
    executions: {
      $not: { $elemMatch: { occurrenceAt, status: { $in: ['completed', 'processing'] } } },
    },
  };
}

async function claim(doc) {
  const occurrenceAt = new Date(doc.nextRunAt);
  const expenseId = new mongoose.Types.ObjectId();

  const claimed = await ScheduledPayment.findOneAndUpdate(
    claimFilter(doc, occurrenceAt),
    {
      $set: { status: 'processing', lastRunAt: new Date() },
      $push: {
        executions: {
          $each: [
            {
              occurrenceAt,
              status: 'processing',
              expense: expenseId,
              createdAt: new Date(),
            },
          ],
          $slice: -MAX_EXECUTIONS,
        },
      },
    },
    { new: true }
  );

  return claimed ? { doc: claimed, occurrenceAt, expenseId } : null;
}

/** Terminal state transition; a no-op when someone else already finished it. */
async function finalize(doc, occurrenceAt, outcome) {
  const now = new Date();
  const filter = {
    _id: doc._id,
    status: 'processing',
    executions: { $elemMatch: { status: 'processing', occurrenceAt } },
  };

  if (outcome.ok) {
    const occurrenceCount = doc.occurrenceCount + 1;
    let next = computeNext(occurrenceAt, doc.frequency, {
      anchorDate: doc.startDate,
      time: doc.scheduledTime,
      endDate: doc.endDate,
      maxOccurrences: doc.maxOccurrences,
      occurrenceCount,
    });

    if (next) {
      next = fastForwardToFuture(next, doc.frequency, {
        anchorDate: doc.startDate,
        time: doc.scheduledTime,
        endDate: doc.endDate,
        maxOccurrences: doc.maxOccurrences,
        occurrenceCount,
        now,
      });
    }

    return ScheduledPayment.findOneAndUpdate(filter, {
      $set: {
        status: next ? 'scheduled' : 'completed',
        nextRunAt: next,
        occurrenceCount,
        failureCount: 0,
        lastExecutionStatus: 'completed',
        failureReason: null,
        'executions.$.status': 'completed',
        'executions.$.executedAt': now,
        'executions.$.expense': outcome.expense._id,
        'executions.$.error': null,
      },
    }, { new: true });
  }

  const message = truncate(outcome.error || 'Payment execution failed', 500);
  const failureCount = doc.failureCount + 1;
  let next = null;

  if (doc.frequency !== 'one-time' && failureCount <= MAX_FAILURES) {
    next = computeNext(occurrenceAt, doc.frequency, {
      anchorDate: doc.startDate,
      time: doc.scheduledTime,
      endDate: doc.endDate,
      maxOccurrences: doc.maxOccurrences,
      // A failed attempt still consumes a slot so maxOccurrences bounds
      // attempts too, and the schedule cannot retry the same slot forever.
      occurrenceCount: doc.occurrenceCount + 1,
    });

    if (next) {
      next = fastForwardToFuture(next, doc.frequency, {
        anchorDate: doc.startDate,
        time: doc.scheduledTime,
        endDate: doc.endDate,
        maxOccurrences: doc.maxOccurrences,
        occurrenceCount: doc.occurrenceCount + 1,
        now,
      });
    }
  }

  return ScheduledPayment.findOneAndUpdate(filter, {
    $set: {
      status: 'failed',
      nextRunAt: next,
      failureCount,
      lastExecutionStatus: 'failed',
      failureReason: message,
      'executions.$.status': 'failed',
      'executions.$.executedAt': now,
      'executions.$.error': message,
      // No transaction was produced, so drop the pre-generated id.
      'executions.$.expense': null,
    },
  }, { new: true });
}

/** Creates the real transaction through the existing Expense workflow. */
async function createExpense(doc, occurrenceAt, expenseId) {
  try {
    return await Expense.create({
      _id: expenseId,
      user: doc.user,
      description: doc.description,
      amount: doc.amount,
      type: doc.type,
      category: doc.category,
      paymentMethod: doc.paymentMethod,
      upiApp: doc.upiApp,
      bankName: doc.bankName,
      date: occurrenceAt,
    });
  } catch (error) {
    // The pre-generated id already exists => a previous attempt succeeded
    // but never finalised. Treat it as success instead of duplicating.
    if (error && error.code === 11000) {
      const existing = await Expense.findById(expenseId);
      if (existing) return existing;
    }
    throw error;
  }
}

async function runClaimed(claimed) {
  const { doc, occurrenceAt, expenseId } = claimed;

  let expense;
  try {
    expense = await createExpense(doc, occurrenceAt, expenseId);
  } catch (error) {
    await finalize(doc, occurrenceAt, { ok: false, error: error.message });
    return { ok: false, id: doc._id, error: error.message };
  }

  await finalize(doc, occurrenceAt, { ok: true, expense });
  return { ok: true, id: doc._id, expenseId: expense._id };
}

/** Claims and executes one due schedule. Safe to call concurrently. */
async function executeDue(doc) {
  const claimed = await claim(doc);
  if (!claimed) return { skipped: true, reason: 'not-claimable', id: doc._id };
  return runClaimed(claimed);
}

/**
 * Resolves rows left in `processing` by a crash/restart.
 * - transaction already exists  => finish the success transition
 * - transaction never created   -> record the failure (no fake transaction)
 */
async function recoverStale() {
  const cutoff = new Date(Date.now() - STALE_MS);
  const stuck = await ScheduledPayment.find({
    status: 'processing',
    updatedAt: { $lte: cutoff },
  })
    .sort({ updatedAt: 1 })
    .limit(20);

  let recovered = 0;

  for (const doc of stuck) {
    const last = doc.executions[doc.executions.length - 1];

    if (!last || last.status !== 'processing') {
      await ScheduledPayment.updateOne(
        { _id: doc._id, status: 'processing' },
        { $set: { status: 'failed', failureReason: 'Execution was interrupted before it completed' } }
      );
      recovered += 1;
      continue;
    }

    const exists = last.expense ? await Expense.exists({ _id: last.expense }) : null;

    if (exists) {
      await finalize(doc, last.occurrenceAt, {
        ok: true,
        expense: { _id: last.expense },
      });
    } else {
      await finalize(doc, last.occurrenceAt, {
        ok: false,
        error: 'Execution was interrupted before it completed',
      });
    }
    recovered += 1;
  }

  return recovered;
}

/**
 * Main entry point: recover interrupted work, then run everything that is due.
 * Idempotent - running it twice, concurrently, or after a restart never
 * creates a duplicate transaction for the same occurrence.
 */
async function processDuePayments({ limit = 25 } = {}) {
  const recovered = await recoverStale();
  const now = new Date();

  const due = await ScheduledPayment.find(dueFilter(now))
    .sort({ nextRunAt: 1 })
    .limit(limit);

  const stats = { recovered, due: due.length, executed: 0, failed: 0, skipped: 0 };

  for (const doc of due) {
    try {
      const result = await executeDue(doc);
      if (result.skipped) stats.skipped += 1;
      else if (result.ok) stats.executed += 1;
      else stats.failed += 1;
    } catch (error) {
      stats.failed += 1;
      console.error(`[scheduler] scheduled payment ${doc._id} failed: ${error.message}`);
    }
  }

  return stats;
}

/** Fire-and-forget, throttled catch-up used by serverless deployments. */
function maybeRunCatchUp() {
  const now = Date.now();
  if (catchUpInFlight || now - catchUpAt < CATCH_UP_INTERVAL_MS) return;
  catchUpAt = now;
  catchUpInFlight = true;

  processDuePayments({ limit: CATCH_UP_LIMIT })
    .catch((error) => console.error(`[scheduler] catch-up failed: ${error.message}`))
    .finally(() => {
      catchUpInFlight = false;
    });
}

/**
 * Immediately runs a single schedule regardless of `nextRunAt`.
 * The occurrence is re-anchored to "now", then the normal claim path is used,
 * so duplicate protection is identical to the background scheduler.
 */
async function runNow(doc) {
  if (doc.status === 'processing') {
    return { ok: false, code: 409, message: 'This payment is already processing' };
  }
  if (doc.status === 'cancelled') {
    return { ok: false, code: 400, message: 'A cancelled payment cannot be executed' };
  }
  if (doc.status === 'completed') {
    return { ok: false, code: 400, message: 'This payment has already completed' };
  }

  const occurrenceAt = applyTime(new Date(), doc.scheduledTime);

  const prepared = await ScheduledPayment.findOneAndUpdate(
    { _id: doc._id, status: { $in: ['scheduled', 'paused', 'failed'] } },
    { $set: { status: 'scheduled', nextRunAt: occurrenceAt } },
    { new: true }
  );

  if (!prepared) {
    return { ok: false, code: 409, message: 'This payment changed state, please refresh' };
  }

  const result = await executeDue(prepared);
  if (result.skipped) {
    return { ok: false, code: 409, message: 'This payment was picked up by another runner' };
  }
  if (!result.ok) {
    return { ok: false, code: 502, message: result.error || 'Payment execution failed' };
  }
  return { ok: true, expenseId: result.expenseId };
}

/* =============================================
   Cron guard
   ============================================= */

function cronGuard(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(404).json({ message: 'Route not found' });
  }

  const header = req.get('authorization') || '';
  const provided =
    req.get('x-cron-secret') ||
    (header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '');

  const providedBuffer = Buffer.from(provided);
  const secretBuffer = Buffer.from(secret);
  const matches =
    providedBuffer.length === secretBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, secretBuffer);

  if (!matches) {
    return res.status(401).json({ message: 'Not authorized, invalid cron secret' });
  }

  next();
}

module.exports = {
  parseDateInput,
  applyTime,
  computeNext,
  firstOccurrence,
  validatePayload,
  normalizePayload,
  initialStatus,
  processDuePayments,
  maybeRunCatchUp,
  executeDue,
  runNow,
  recoverStale,
  cronGuard,
};
