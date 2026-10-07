const mongoose = require('mongoose');

const FREQUENCIES = ['one-time', 'daily', 'weekly', 'monthly', 'yearly'];
const STATUSES = ['scheduled', 'processing', 'completed', 'failed', 'cancelled', 'paused'];

const executionSchema = new mongoose.Schema(
  {
    occurrenceAt: { type: Date, required: true },
    executedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
    },
    expense: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', default: null },
    error: { type: String, default: null, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const scheduledPaymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    payee: {
      type: String,
      required: [true, 'Payee is required'],
      trim: true,
      maxlength: [120, 'Payee cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than zero'],
    },
    type: {
      type: String,
      enum: ['expense', 'income'],
      default: 'expense',
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'bank'],
      default: 'cash',
    },
    upiApp: {
      type: String,
      trim: true,
      default: null,
    },
    bankName: {
      type: String,
      trim: true,
      default: null,
    },
    frequency: {
      type: String,
      enum: FREQUENCIES,
      default: 'one-time',
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    scheduledTime: {
      type: String,
      default: '00:00',
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format'],
    },
    endDate: {
      type: Date,
      default: null,
    },
    maxOccurrences: {
      type: Number,
      default: null,
      min: [1, 'Max occurrences must be at least 1'],
    },
    nextRunAt: {
      type: Date,
      default: null,
    },
    lastRunAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: STATUSES,
      default: 'scheduled',
    },
    isAutoPay: {
      type: Boolean,
      default: false,
    },
    occurrenceCount: {
      type: Number,
      default: 0,
      min: [0, 'Occurrence count cannot be negative'],
    },
    failureCount: {
      type: Number,
      default: 0,
      min: [0, 'Failure count cannot be negative'],
    },
    lastExecutionStatus: {
      type: String,
      enum: ['completed', 'failed', null],
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
      maxlength: [500, 'Failure reason cannot exceed 500 characters'],
    },
    executions: {
      type: [executionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Owner-scoped listing (status / auto-pay tabs).
scheduledPaymentSchema.index({ user: 1, isAutoPay: 1, createdAt: -1 });
// Scheduler scan: "what is due next".
scheduledPaymentSchema.index({ status: 1, nextRunAt: 1 });
// Per-owner dashboard of upcoming schedules.
scheduledPaymentSchema.index({ user: 1, status: 1, nextRunAt: 1 });

module.exports = mongoose.model('ScheduledPayment', scheduledPaymentSchema);
module.exports.FREQUENCIES = FREQUENCIES;
module.exports.STATUSES = STATUSES;
