const { parsePdf } = require('./pdfParser');
const { parseCsv } = require('./csvParser');
const { normalizeRows } = require('./paymentNormalizer');
const { annotateRows, summarize } = require('./paymentValidator');

const SUPPORTED_TYPES = ['pdf', 'csv'];

function detectFileType(file) {
  const name = String(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();

  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (
    mime === 'text/csv' ||
    mime === 'application/csv' ||
    mime === 'application/vnd.ms-excel' ||
    name.endsWith('.csv')
  ) {
    return 'csv';
  }
  return null;
}

function unsupportedTypeError() {
  const error = new Error('Only PDF and CSV files are supported');
  error.statusCode = 400;
  return error;
}

/**
 * Parse an uploaded PDF or CSV buffer into normalized, validated preview rows.
 * This NEVER writes to the database.
 */
async function parseImportFile(file) {
  if (!file || !file.buffer) {
    const error = new Error('Please upload a file');
    error.statusCode = 400;
    throw error;
  }

  const fileType = detectFileType(file);
  if (!fileType || !SUPPORTED_TYPES.includes(fileType)) throw unsupportedTypeError();

  const parsed = fileType === 'pdf' ? await parsePdf(file.buffer) : parseCsv(file.buffer);

  const transactions = annotateRows(normalizeRows(parsed.transactions, fileType));

  return {
    fileName: file.originalname,
    size: file.size,
    fileType,
    bankName: parsed.bankName || '',
    pageCount: parsed.pageCount || null,
    warning: parsed.warning || null,
    transactions,
    summary: summarize(transactions),
  };
}

module.exports = {
  detectFileType,
  parseImportFile,
  SUPPORTED_TYPES,
};