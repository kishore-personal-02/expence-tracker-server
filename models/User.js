const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    customCategories: {
      type: [String],
      default: [],
      trim: true,
    },
    customUpiApps: {
      type: [String],
      default: [],
      trim: true,
    },
    // Opening balance is stored in integer minor units (paise) so the
    // available-balance maths never accumulates floating-point drift.
    openingBalanceMinor: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
      uppercase: true,
    },
    // Highest month for which the monthly report notification was created.
    // Persisted so the month-end rule can never fire twice for one month,
    // even across restarts or timezone changes.
    lastMonthlyNotificationMonth: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);