const Expense = require('../../models/Expense');
const ImportBatch = require('../../models/ImportBatch');
const { toExpenseDocument, MAX_IMPORT_ENTRIES } = require('./paymentValidator');

/**
 * Confirmation core shared by the /confirm and legacy /expenses routes.
 *
 * Always re-validates the incoming rows server-side (never trusts the client),
 * then inserts them behind a durable idempotency guard keyed on
 * (user, batchId) so a refresh or double submit cannot create duplicates.
 */
async function confirmImport(userId, batchId, entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    const error = new Error('No transactions to import');
    error.status = 400;
    throw error;
  }

  if (entries.length > MAX_IMPORT_ENTRIES) {
    const error = new Error(`A single import is limited to ${MAX_IMPORT_ENTRIES} transactions`);
    error.status = 400;
    throw error;
  }

  const documents = [];
  const rowErrors = [];
  entries.forEach((entry, index) => {
    try {
      documents.push(toExpenseDocument(entry, userId));
    } catch (error) {
      rowErrors.push({ index, errors: error.validationErrors || [error.message] });
    }
  });

  if (rowErrors.length) {
    const error = new Error(
      'Some transactions are invalid. Please review the highlighted rows.'
    );
    error.status = 422;
    error.details = rowErrors;
    throw error;
  }

  // Claim the batch first. A duplicate key means this exact batch already
  // exists, so return the recorded result instead of inserting again.
  let claimed = false;
  if (batchId) {
    try {
      await ImportBatch.create({ user: userId, batchId, count: 0, status: 'pending' });
      claimed = true;
    } catch (error) {
      if (error.code === 11000) {
        const existing = await ImportBatch.findOne({ user: userId, batchId });
        return { imported: existing ? existing.count : 0, duplicate: true, expenses: [] };
      }
      throw error;
    }
  }

  let created;
  try {
    created = await Expense.insertMany(documents, { ordered: true });
  } catch (error) {
    if (claimed) {
      await ImportBatch.deleteOne({ user: userId, batchId }).catch(() => {});
    }
    throw error;
  }

  if (claimed) {
    await ImportBatch.updateOne(
      { user: userId, batchId },
      { $set: { count: created.length, status: 'completed' } }
    ).catch(() => {});
  }

  return { imported: created.length, duplicate: false, expenses: created };
}

module.exports = { confirmImport };