const { buildRouter } = require('./scheduledPayments');

// Auto pays are the same scheduled-payment rules with `isAutoPay` pinned to
// true; the shared router keeps both families byte-for-byte consistent.
module.exports = buildRouter({ isAutoPay: true, resourceKey: 'autoPays' });
