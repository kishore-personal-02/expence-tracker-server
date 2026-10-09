const mongoose = require('mongoose');

// Records a confirmed import batch so a repeated submit (double click, network
// retry, page refresh after confirmation) cannot create duplicate entries.
const importBatchSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    batchId: {
      type: String,
      required: true,
      trim: true,
      maxlength: [128, 'Batch id is too long'],
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

importBatchSchema.index({ user: 1, batchId: 1 }, { unique: true });

module.exports = mongoose.model('ImportBatch', importBatchSchema);