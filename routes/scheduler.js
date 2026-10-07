const express = require('express');
const { processDuePayments, cronGuard } = require('../services/scheduledPaymentService');

const router = express.Router();

// @route   POST /api/scheduler/run
// @desc    Drain the due-schedule queue. Intended for an external cron
//          (e.g. a Vercel Cron job) — guarded by CRON_SECRET rather than a
//          user token, because no user context exists for a scheduled call.
// @access  Private (CRON_SECRET)
router.post('/run', cronGuard, async (req, res) => {
  try {
    const stats = await processDuePayments({ limit: 50 });
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/scheduler/health
// @desc    Liveness probe for the scheduler configuration (no secrets).
// @access  Private (CRON_SECRET)
router.get('/health', cronGuard, (req, res) => {
  res.json({
    status: 'ok',
    cronEnabled: Boolean(process.env.CRON_SECRET),
    intervalMs: Number(process.env.SCHEDULER_INTERVAL_MS) || 60000,
  });
});

module.exports = router;
