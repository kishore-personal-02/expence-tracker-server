const { processDuePayments } = require('../services/scheduledPaymentService');

const DEFAULT_INTERVAL_MS = 60 * 1000;

let timer = null;
let tickInFlight = false;

async function tick() {
  // Overlap guard: a slow drain never starts a second one.
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    const stats = await processDuePayments();
    if (stats.due || stats.recovered) {
      console.log(
        `[scheduler] due=${stats.due} executed=${stats.executed} ` +
          `failed=${stats.failed} skipped=${stats.skipped} recovered=${stats.recovered}`
      );
    }
  } catch (error) {
    console.error(`[scheduler] run failed: ${error.message}`);
  } finally {
    tickInFlight = false;
  }
}

/**
 * In-process loop for the long-running host (`node index.js` / nodemon).
 * Serverless invocations never call this — they rely on the throttled
 * catch-up inside the API plus POST /api/scheduler/run from an external cron.
 */
function startScheduler() {
  if (timer) return;

  const interval = Number(process.env.SCHEDULER_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
  timer = setInterval(tick, interval);
  if (typeof timer.unref === 'function') timer.unref();

  const first = setTimeout(tick, 3000);
  if (typeof first.unref === 'function') first.unref();

  console.log(`Scheduled-payment scheduler running every ${Math.round(interval / 1000)}s`);
}

function stopScheduler() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

module.exports = { startScheduler, stopScheduler, tick };
