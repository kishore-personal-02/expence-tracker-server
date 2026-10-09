const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/auth');
const { parseImportFile } = require('../services/paymentImport');
const { confirmImport } = require('../services/paymentImport/confirmImport');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const isPdf = mime === 'application/pdf' || name.endsWith('.pdf');
    const isCsv =
      mime === 'text/csv' ||
      mime === 'application/csv' ||
      mime === 'application/vnd.ms-excel' ||
      name.endsWith('.csv');
    if (isPdf || isCsv) return cb(null, true);
    cb(new Error('Only PDF and CSV files are allowed'));
  },
});

router.use(protect);

function multerErrorResponse(uploadError) {
  if (uploadError.message === 'Only PDF and CSV files are allowed') {
    return uploadError.message;
  }
  if (uploadError.code === 'LIMIT_FILE_SIZE') {
    return 'File is too large. Please upload a PDF or CSV under 15 MB.';
  }
  return 'File upload failed. Please upload a PDF or CSV under 15 MB.';
}

// @route   POST /api/import/parse
// @desc    Upload a PDF/CSV statement and return normalized preview rows.
//          Nothing is written to the database here.
// @access  Private
router.post('/parse', (req, res) => {
  upload.single('file')(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ message: multerErrorResponse(uploadError) });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a PDF or CSV file' });
    }

    try {
      const result = await parseImportFile(req.file);
      return res.json({
        fileName: req.file.originalname,
        size: req.file.size,
        ...result,
      });
    } catch (error) {
      return res.status(error.status || 400).json({ message: error.message });
    }
  });
});

/**
 * Shared confirmation core. Validates every row server-side, then inserts them
 * with a durable idempotency guard keyed on (user, batchId).
 */
// @route   POST /api/import/confirm
// @desc    Create payment entries after the user reviewed the preview.
// @access  Private
router.post('/confirm', async (req, res) => {
  const { entries, batchId } = req.body || {};

  if (typeof batchId !== 'string' || !batchId.trim()) {
    return res.status(400).json({ message: 'A batch id is required to import transactions' });
  }

  try {
    const result = await confirmImport(req.user._id, batchId.trim(), entries);
    return res.status(201).json(result);
  } catch (error) {
    const body = { message: error.message };
    if (error.details) body.details = error.details;
    return res.status(error.status || 500).json(body);
  }
});

// @route   POST /api/import/expenses
// @desc    Legacy alias kept for backward compatibility. Accepts the old
//          { entries: [{ type: 'expense' | 'income' }] } payload.
// @access  Private
router.post('/expenses', async (req, res) => {
  const { entries, batchId } = req.body || {};

  const normalized = Array.isArray(entries)
    ? entries.map((entry) => ({
        date: entry.date,
        description: entry.description,
        amount: entry.amount,
        type: entry.type === 'income' || entry.type === 'credit' ? 'credit' : 'debit',
        category: entry.category,
        paymentMethod: entry.paymentMethod || 'bank',
        upiApp: entry.upiApp || null,
        bankName: entry.bankName || null,
      }))
    : [];

  try {
    const result = await confirmImport(req.user._id, batchId, normalized);
    if (result.duplicate) {
      return res.status(200).json(result);
    }
    return res.status(201).json(result);
  } catch (error) {
    const body = { message: error.message };
    if (error.details) body.details = error.details;
    return res.status(error.status || 500).json(body);
  }
});

module.exports = router;