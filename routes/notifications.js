const express = require('express');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// @route   GET /api/notifications
// @desc    List the current user's notifications + last monthly-report month
// @access  Private
router.get('/', async (req, res) => {
  try {
    const [notifications, user] = await Promise.all([
      Notification.find({ user: req.user._id }).sort({ createdAt: -1 }),
      User.findById(req.user._id),
    ]);

    res.json({
      notifications,
      lastSentMonth: user?.lastMonthlyNotificationMonth || null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/notifications
// @desc    Create a notification
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { title, message, kind, reportMonth } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    // Guard against duplicate monthly-report notifications for the same month.
    if (kind === 'monthly-report' && reportMonth) {
      const existing = await Notification.findOne({
        user: req.user._id,
        kind: 'monthly-report',
        reportMonth,
      });
      if (existing) return res.json(existing);
    }

    const notification = await Notification.create({
      user: req.user._id,
      title: title.trim(),
      message: message?.trim() || '',
      kind: kind === 'monthly-report' ? 'monthly-report' : 'system',
      reportMonth: reportMonth || null,
    });

    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/notifications/last-sent-month
// @desc    Record the latest month a monthly report was created for
// @access  Private
router.put('/last-sent-month', async (req, res) => {
  try {
    const { month } = req.body;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: 'month must look like "YYYY-MM"' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Never move the marker backwards if clocks/requests arrive out of order.
    if (!user.lastMonthlyNotificationMonth || month > user.lastMonthlyNotificationMonth) {
      user.lastMonthlyNotificationMonth = month;
      await user.save();
    }

    res.json({ message: 'ok' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark a single notification as read
// @access  Private
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    if (notification.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to access this notification' });
    }

    notification.read = true;
    await notification.save();
    res.json(notification);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid notification id' });
    }
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    if (notification.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this notification' });
    }

    await notification.deleteOne();
    res.json({ message: 'Notification removed' });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid notification id' });
    }
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
