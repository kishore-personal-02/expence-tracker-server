const express = require('express');
const Expense = require('../models/Expense');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// @route   GET /api/expenses
// @desc    Get all expenses for the logged in user
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { category, startDate, endDate, month } = req.query;

    const filter = { user: req.user._id };

    if (category) filter.category = category;

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    if (month) {
      const start = new Date(`${month}-01`);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      filter.date = { ...filter.date, $gte: start, $lt: end };
    }

    const all = await Expense.find(filter).sort({ date: -1 });

    const expenses = all.filter((e) => e.type !== 'income');
    const incomes = all.filter((e) => e.type === 'income');

    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalIncome = incomes.reduce((sum, e) => sum + e.amount, 0);

    res.json({ expenses: all, totalAmount, totalIncome });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/expenses/summary
// @desc    Get expense summary grouped by category / payment method
// @access  Private
router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = { user: req.user._id, type: 'expense' };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(filter);

    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalCount = expenses.length;

    const incomeAgg = await Expense.aggregate([
      { $match: { user: req.user._id, type: 'income', ...(filter.date ? { date: filter.date } : {}) } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    const byCategory = {};
    const byPaymentMethod = { cash: 0, upi: 0, bank: 0 };
    const byDay = {};

    expenses.forEach((e) => {
      if (!byCategory[e.category]) byCategory[e.category] = 0;
      byCategory[e.category] += e.amount;

      if (byPaymentMethod[e.paymentMethod] !== undefined) {
        byPaymentMethod[e.paymentMethod] += e.amount;
      }

      const day = e.date.toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = 0;
      byDay[day] += e.amount;
    });

    res.json({
      totalAmount,
      totalCount,
      totalIncome: incomeAgg[0]?.total || 0,
      incomeCount: incomeAgg[0]?.count || 0,
      byCategory,
      byPaymentMethod,
      byDay,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/expenses/:id
// @desc    Get a single expense
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to access this expense' });
    }

    res.json(expense);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid expense id' });
    }
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/expenses
// @desc    Create a new expense
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { description, amount, category, date, paymentMethod, upiApp } = req.body;

    if (!description || !amount || !category) {
      return res.status(400).json({
        message: 'Please provide description, amount and category',
      });
    }

    const expense = await Expense.create({
      user: req.user._id,
      description,
      amount,
      category,
      date: date ? new Date(date) : undefined,
      paymentMethod,
      upiApp: paymentMethod === 'upi' ? upiApp || 'Other' : null,
    });

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/expenses/:id
// @desc    Update an expense
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    let expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this expense' });
    }

    const { description, amount, category, date, paymentMethod, upiApp, type } = req.body;

    expense.description = description || expense.description;
    expense.amount = amount !== undefined ? amount : expense.amount;
    expense.category = category || expense.category;
    if (type) expense.type = type;
    if (date) expense.date = new Date(date);
    if (paymentMethod) {
      expense.paymentMethod = paymentMethod;
      expense.upiApp = paymentMethod === 'upi' ? upiApp || 'Other' : null;
    }

    const updated = await expense.save();

    res.json(updated);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid expense id' });
    }
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/expenses/:id
// @desc    Delete an expense
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this expense' });
    }

    await expense.deleteOne();

    res.json({ message: 'Expense removed' });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid expense id' });
    }
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
