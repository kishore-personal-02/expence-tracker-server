const express = require('express');
const multer = require('multer');
const Expense = require('../models/Expense');
const { protect } = require('../middleware/auth');
const { parseStatementPdf } = require('../utils/pdfParser');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isPdf =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');
    if (isPdf) return cb(null, true);
    cb(new Error('Only PDF files are allowed'));
  },
});

router.use(protect);

// @route   POST /api/import/parse
// @desc    Upload a bank statement / passbook PDF and return detected transactions
// @access  Private
router.post('/parse', (req, res) => {
  upload.single('file')(req, res, async (uploadError) => {
    if (uploadError) {
      const message =
        uploadError.message === 'Only PDF files are allowed'
          ? uploadError.message
          : 'File upload failed. Please upload a PDF under 15 MB.';
      return res.status(400).json({ message });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a PDF file' });
    }

    try {
      const result = await parseStatementPdf(req.file.buffer);

      res.json({
        fileName: req.file.originalname,
        size: req.file.size,
        ...result,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
});

// @route   POST /api/import/expenses
// @desc    Save confirmed entries (from the parse preview) to the database
// @access  Private
router.post('/expenses', async (req, res) => {
  try {
    const rawEntries = Array.isArray(req.body.entries) ? req.body.entries : [];

    if (!rawEntries.length) {
      return res.status(400).json({ message: 'No entries to import' });
    }

    const created = [];

    for (const entry of rawEntries) {
      const type = entry.type === 'income' ? 'income' : 'expense';
      const amount = Math.abs(Number(entry.amount));
      const date = new Date(entry.date);

      if (!amount || Number.isNaN(date.getTime())) continue;

      const description = String(entry.description || '').slice(0, 200).trim();

      const expense = await Expense.create({
        user: req.user._id,
        description: description || (type === 'income' ? 'Bank credit' : 'Bank debit'),
        amount,
        type,
        category: type === 'income' ? 'Income' : entry.category || 'Other',
        paymentMethod: 'bank',
        upiApp: null,
        bankName: entry.bankName || null,
        date,
      });

      created.push(expense);
    }

    res.status(201).json({ imported: created.length, expenses: created });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;