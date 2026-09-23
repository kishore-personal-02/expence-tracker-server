const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Expense = require('../models/Expense');
const { protect } = require('../middleware/auth');

const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const DEFAULT_CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Utilities',
  'Entertainment',
  'Healthcare',
  'Shopping',
  'Education',
  'Other',
];

const DEFAULT_UPI_APPS = ['GPay', 'PhonePe', 'Paytm', 'Amazon Pay', 'BHIM', 'Other'];

const getPreferences = (user) => ({
  categories: [...DEFAULT_CATEGORIES, ...(user.customCategories || [])],
  upiApps: [...DEFAULT_UPI_APPS, ...(user.customUpiApps || [])],
  customCategories: user.customCategories || [],
  customUpiApps: user.customUpiApps || [],
});

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email and password' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({ name, email, password });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user and get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/auth/profile
// @desc    Get current user profile + account stats
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const [totalExpenses, totalSpent, categoryAgg, totalIncome] = await Promise.all([
      Expense.countDocuments({ user: req.user._id, type: 'expense' }),
      Expense.aggregate([
        { $match: { user: req.user._id, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: { user: req.user._id, type: 'expense' } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
        { $limit: 1 },
      ]),
      Expense.aggregate([
        { $match: { user: req.user._id, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    res.json({
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      createdAt: req.user.createdAt,
      stats: {
        totalExpenses,
        totalSpent: totalSpent[0]?.total || 0,
        totalIncome: totalIncome[0]?.total || 0,
        topCategory: categoryAgg[0]?._id || 'None yet',
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/auth/password
// @desc    Change the current user's password
// @access  Private
router.put('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide current and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update the current user's name
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    req.user.name = name.trim();
    await req.user.save();

    res.json({
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/auth/account
// @desc    Permanently delete account and all its expenses
// @access  Private
router.delete('/account', protect, async (req, res) => {
  try {
    await Expense.deleteMany({ user: req.user._id });
    await User.findByIdAndDelete(req.user._id);
    res.json({ message: 'Account deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/auth/preferences
// @desc    Get default + custom categories and UPI apps
// @access  Private
router.get('/preferences', protect, async (req, res) => {
  try {
    res.json(getPreferences(req.user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/auth/preferences/categories
// @desc    Add a custom category
// @access  Private
router.post('/preferences/categories', protect, async (req, res) => {
  try {
    const name = req.body.name?.trim();
    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    if (name.length > 24) {
      return res.status(400).json({ message: 'Category name must be 24 characters or less' });
    }
    const existing = getPreferences(req.user).categories.some(
      (c) => c.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      return res.status(400).json({ message: `Category "${name}" already exists` });
    }
    req.user.customCategories = req.user.customCategories || [];
    req.user.customCategories.push(name);
    await req.user.save();
    res.status(201).json(getPreferences(req.user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/auth/preferences/categories/:name
// @desc    Remove a custom category
// @access  Private
router.delete('/preferences/categories/:name', protect, async (req, res) => {
  try {
    req.user.customCategories = (req.user.customCategories || []).filter(
      (c) => c !== req.params.name
    );
    await req.user.save();
    res.json(getPreferences(req.user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/auth/preferences/upi-apps
// @desc    Add a custom UPI app
// @access  Private
router.post('/preferences/upi-apps', protect, async (req, res) => {
  try {
    const name = req.body.name?.trim();
    if (!name) {
      return res.status(400).json({ message: 'UPI app name is required' });
    }
    if (name.length > 24) {
      return res.status(400).json({ message: 'UPI app name must be 24 characters or less' });
    }
    const existing = getPreferences(req.user).upiApps.some(
      (a) => a.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      return res.status(400).json({ message: `UPI app "${name}" already exists` });
    }
    req.user.customUpiApps = req.user.customUpiApps || [];
    req.user.customUpiApps.push(name);
    await req.user.save();
    res.status(201).json(getPreferences(req.user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/auth/preferences/upi-apps/:name
// @desc    Remove a custom UPI app
// @access  Private
router.delete('/preferences/upi-apps/:name', protect, async (req, res) => {
  try {
    req.user.customUpiApps = (req.user.customUpiApps || []).filter(
      (a) => a !== req.params.name
    );
    await req.user.save();
    res.json(getPreferences(req.user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;