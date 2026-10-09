const { INCOME_CATEGORY, OTHER_CATEGORY } = require('./paymentNormalizer');

const MAX_IMPORT_ENTRIES = 1000;

function isValidDate(value) {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

/**
 * Validate a single normalized imported row. Returns a (possibly empty) list
 * of human readable error messages. Pure - no DB access.
 */
function validateRow(row) {
  const errors = [];

  if (!isValidDate(row.date)) {
    errors.push('Invalid or missing date');
  }

  const description = typeof row.description === 'string' ? row.description.trim() : '';
  if (!description) {
    errors.push('Description is required');
  } else if (description.length > 200) {
    errors.push('Description cannot exceed 200 characters');
  }

  const amount = Number(row.amount);
  if (row.amount === null || row.amount === undefined || Number.isNaN(amount)) {
    errors.push('Amount is missing');
  } else if (amount <= 0) {
    errors.push('Amount must be greater than zero');
  } else if (amount > 1e12) {
    errors.push('Amount is unrealistically large');
  }

  if (row.type !== 'credit' && row.type !== 'debit') {
    errors.push('Transaction type must be credit or debit');
  }

  const category = typeof row.category === 'string' ? row.category.trim() : '';
  if (!category) {
    errors.push('Category is required');
  }

  return errors;
}

/**
 * Recompute validationErrors for every row (mutates in place) and return them.
 */
function annotateRows(rows) {
  for (const row of rows) {
    row.validationErrors = validateRow(row);
  }
  return rows;
}

/**
 * Build the preview summary surfaced to the client.
 */
function summarize(rows) {
  let credits = 0;
  let debits = 0;
  let totalCredit = 0;
  let totalDebit = 0;
  let valid = 0;
  let needsReview = 0;

  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    if (row.type === 'credit') {
      credits += 1;
      totalCredit += amount;
    } else {
      debits += 1;
      totalDebit += amount;
    }

    if (Array.isArray(row.validationErrors) && row.validationErrors.length) {
      needsReview += 1;
    } else {
      valid += 1;
    }
  }

  return {
    total: rows.length,
    credits,
    debits,
    totalCredit: Math.round(totalCredit * 100) / 100,
    totalDebit: Math.round(totalDebit * 100) / 100,
    valid,
    needsReview,
  };
}

/**
 * Map a validated imported row into the shape stored by the Expense model.
 * Throws when the row is invalid.
 */
function toExpenseDocument(row, userId) {
  const errors = validateRow(row);
  if (errors.length) {
    const error = new Error(errors[0]);
    error.validationErrors = errors;
    throw error;
  }

  const isCredit = row.type === 'credit';
  const description = String(row.description).trim().slice(0, 200);

  return {
    user: userId,
    description,
    amount: Math.abs(Number(row.amount)),
    type: isCredit ? 'income' : 'expense',
    category: (isCredit ? INCOME_CATEGORY : row.category || OTHER_CATEGORY).trim(),
    paymentMethod: row.paymentMethod === 'upi' || row.paymentMethod === 'cash' ? row.paymentMethod : 'bank',
    upiApp: row.paymentMethod === 'upi' ? row.upiApp || 'Other' : null,
    bankName: row.bankName ? String(row.bankName).trim().slice(0, 120) : null,
    date: new Date(row.date),
  };
}

module.exports = {
  MAX_IMPORT_ENTRIES,
  validateRow,
  annotateRows,
  summarize,
  toExpenseDocument,
};