const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    message: {
      type: String,
      default: '',
      trim: true,
    },
    kind: {
      type: String,
      enum: ['monthly-report', 'system'],
      default: 'system',
    },
    read: {
      type: Boolean,
      default: false,
    },
    // Set only for monthly-report notifications, e.g. "2026-09".
    reportMonth: {
      type: String,
      default: null,
    },
    reportState: {
      type: String,
      enum: ['idle', 'preparing', 'ready', 'error'],
      default: 'idle',
    },
    reportFileName: {
      type: String,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
