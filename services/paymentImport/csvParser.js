const { matchDate } = require('./pdfParser');

// Column aliases. Order matters within each list (most specific first).
const HEADER_ALIASES = {
  date: [
    'transaction date', 'txn date', 'trx date', 'trans date', 'value date',
    'value dt', 'posting date', 'booking date', 'date',
  ],
  description: [
    'transaction details', 'transaction description', 'narration', 'particulars',
    'description', 'details', 'remarks', 'memo', 'payee', 'name',
  ],
  reference: [
    'reference no', 'reference number', 'ref no', 'ref number', 'cheque no',
    'cheque number', 'chq no', 'txn id', 'transaction id', 'utr', 'utr no',
    'reference', 'ref', 'cheque', 'chq',
  ],
  debit: [
    'withdrawal amount', 'withdrawal amt', 'debit amount', 'debit amt',
    'paid out', 'withdrawal', 'debit', 'dr amount', 'dr',
  ],
  credit: [
    'deposit amount', 'deposit amt', 'credit amount', 'credit amt',
    'paid in', 'deposit', 'credit', 'cr amount', 'cr',
  ],
  amount: ['transaction amount', 'txn amount', 'amount', 'value', 'amt'],
  balance: [
    'closing balance', 'running balance', 'available balance', 'balance',
    'bal',
  ],
  category: ['category', 'tag', 'expense type'],
  type: ['transaction type', 'txn type', 'cr/dr', 'dr/cr', 'type'],
};

function normalizeHeader(value) {
  return String(value || '')
    .replace(/\uFEFF/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^(inr|rs|indian rupees?|rupees?)\s+/i, '')
    .replace(/\s+(inr|rs|indian rupees?|rupees?)$/i, '')
    .trim();
}

function detectDelimiter(sample) {
  const firstLine = sample.split(/\r?\n/).find((l) => l.trim());
  if (!firstLine) return ',';
  const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  for (const ch of firstLine) {
    if (counts[ch] !== undefined) counts[ch] += 1;
  }
  let best = ',';
  let bestCount = -1;
  for (const [ch, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = ch;
      bestCount = count;
    }
  }
  return best;
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // swallow; handled by \n
    } else {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function buildColumnMap(headerRow) {
  const map = {};

  const exactHeaders = headerRow.map((rawHeader) => normalizeHeader(rawHeader));

  // Pass 1: exact match against the known aliases.
  exactHeaders.forEach((header, index) => {
    if (!header) return;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[field] !== undefined) continue;
      if (aliases.includes(header)) {
        map[field] = index;
        return;
      }
    }
  });

  // Pass 2: substring match, so headers that carry extra words or units
  // (e.g. "Withdrawal Amt (INR)", "Transaction Amount Rs") still resolve.
  exactHeaders.forEach((header, index) => {
    if (!header) return;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[field] !== undefined) continue;
      // Skip if this header already claimed a different column.
      if (Object.values(map).includes(index)) continue;
      const alias = aliases.find((a) => a.length >= 4 && header.includes(a));
      if (alias) {
        map[field] = index;
        return;
      }
    }
  });

  return map;
}

function parseAmount(value) {
  if (value === null || value === undefined) return null;
  let str = String(value).trim();
  if (!str) return null;

  let negative = false;
  if (/^\(.*\)$/.test(str)) {
    negative = true;
    str = str.slice(1, -1);
  }
  if (/\bdr\b|\bdebit\b/i.test(str)) {
    // trailing DR marker
    str = str.replace(/\bdr\b|\bdebit\b/gi, '');
  }
  if (/^\-/.test(str) || /-$/.test(str)) negative = true;

  const cleaned = str.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num)) return null;
  return negative ? -num : num;
}

function cell(row, index) {
  if (index === undefined || index === null) return '';
  const value = row[index];
  return value === undefined || value === null ? '' : String(value).trim();
}

function isEmptyRow(row) {
  return row.every((value) => String(value || '').trim() === '');
}

function resolveType(explicit, amount) {
  if (explicit) {
    const v = explicit.trim().toLowerCase();
    if (/^(cr|credit|deposit|in|income)$/.test(v)) return 'credit';
    if (/^(dr|debit|withdrawal|withdraw|out|expense|payment)$/.test(v)) return 'debit';
  }
  if (typeof amount === 'number' && amount < 0) return 'debit';
  return null;
}

/**
 * Parse a CSV buffer into raw imported-payment rows. Handles quoted fields,
 * commas inside descriptions, arbitrary column order, extra/missing columns and
 * a handful of date and amount formats.
 */
function parseCsv(buffer) {
  const text = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer || '');
  if (!text.trim()) {
    return { transactions: [], warning: 'The CSV file appears to be empty.' };
  }

  const delimiter = detectDelimiter(text);
  const rows = parseDelimited(text, delimiter).filter((row) => !isEmptyRow(row));

  if (rows.length < 2) {
    return {
      transactions: [],
      warning: 'The CSV needs a header row followed by at least one transaction.',
    };
  }

  const headerRow = rows[0];
  const columns = buildColumnMap(headerRow);

  if (columns.date === undefined && columns.amount === undefined &&
      columns.debit === undefined && columns.credit === undefined) {
    return {
      transactions: [],
      warning:
        'Could not recognise the CSV columns. Expected at least a date and an amount (or debit/credit) column.',
    };
  }

  const transactions = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const dateCell = cell(row, columns.date);
    const description =
      cell(row, columns.description) || cell(row, columns.reference) || '';
    const reference = cell(row, columns.reference) || null;
    const balance = parseAmount(cell(row, columns.balance));
    const explicitType = cell(row, columns.type);
    const category = cell(row, columns.category) || null;

    const debit = columns.debit !== undefined ? parseAmount(cell(row, columns.debit)) : null;
    const credit = columns.credit !== undefined ? parseAmount(cell(row, columns.credit)) : null;
    const amountCell = columns.amount !== undefined ? parseAmount(cell(row, columns.amount)) : null;

    let amount = null;
    let type = null;

    if (debit !== null && debit !== 0) {
      amount = debit;
      type = 'debit';
    } else if (credit !== null && credit !== 0) {
      amount = credit;
      type = 'credit';
    } else if (amountCell !== null) {
      amount = Math.abs(amountCell);
      type = resolveType(explicitType, amountCell);
    }

    if (type === null) {
      type = resolveType(explicitType, amountCell === null ? debit : amountCell) || 'debit';
    }

    const dateMatch = dateCell ? matchDate(dateCell) : null;

    // Skip rows that carry neither an amount nor a recognisable date - these
    // are blank/padding rows. Rows with a date but a missing amount are kept
    // so the user can see and fix them in the preview.
    if (amount === null && !dateMatch) continue;

    transactions.push({
      date: dateCell || null,
      parsedDate: dateMatch ? dateMatch.iso : null,
      description: description || '',
      reference,
      amount: amount === null ? null : Math.abs(amount),
      type,
      balance,
      category,
    });
  }

  return {
    transactions,
    bankName: '',
    detectedColumns: columns,
    warning: transactions.length
      ? null
      : 'No transactions could be read from this CSV. Please check the file format.',
  };
}

module.exports = {
  parseCsv,
  parseDelimited,
  buildColumnMap,
  normalizeHeader,
  detectDelimiter,
};