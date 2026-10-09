const crypto = require('crypto');

const INCOME_CATEGORY = 'Income';
const OTHER_CATEGORY = 'Other';
const DATE_FIELD = 'date';

function makeTempId() {
  return `imp_${crypto.randomBytes(9).toString('hex')}`;
}

function toIsoDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeType(value, fallback) {
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (/^(credit|cr|deposit|in|income|received|receipt)$/.test(v)) return 'credit';
    if (/^(debit|dr|withdrawal|withdraw|out|expense|payment|paid|spent)$/.test(v)) {
      return 'debit';
    }
  }
  return fallback === 'credit' || fallback === 'debit' ? fallback : 'debit';
}

function normalizeDescription(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

// Converts a raw parser row into the shared imported-payment structure used by
// both the CSV and PDF pipelines. Pure: does not validate (see paymentValidator).
function normalizeRow(raw, source) {
  const type = normalizeType(raw.type, raw.side);
  const numericAmount = toNumber(raw.amount);
  const amount = numericAmount === null ? null : Math.abs(numericAmount);
  const balance = toNumber(raw.balance);
  const category = String(raw.category || '').trim() || (type === 'credit' ? 'Income' : 'Other');

  const paymentMethod = ['cash', 'upi', 'bank'].includes(raw.paymentMethod)
    ? raw.paymentMethod
    : 'bank';

  return {
    id: raw.id || makeTempId(),
    date: toIsoDate(raw.parsedDate || raw.date || raw.rawDate),
    description: normalizeDescription(raw.description || raw.narration, type),
    reference: raw.reference ? String(raw.reference).trim().slice(0, 120) : null,
    amount: Number.isFinite(amount) ? amount : null,
    type,
    balance: Number.isFinite(balance) ? balance : null,
    category,
    paymentMethod,
    upiApp: raw.upiApp ? String(raw.upiApp).trim().slice(0, 60) : null,
    bankName: raw.bankName ? String(raw.bankName).trim().slice(0, 120) : null,
    source,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : null,
    validationErrors: [],
  };
}

function normalizeRows(rows, source) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && typeof row === 'object')
    .map((row) => normalizeRow(row, source));
}

module.exports = {
  makeTempId,
  toIsoDate,
  toNumber,
  normalizeType,
  normalizeRow,
  normalizeRows,
  INCOME_CATEGORY,
  OTHER_CATEGORY,
  DATE_FIELD,
};