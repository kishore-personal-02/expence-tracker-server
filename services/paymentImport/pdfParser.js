// ---------------------------------------------------------------------------
// Text-based statement parser
// The extraction pipeline mirrors the bank-statement heuristics that already
// shipped in utils/pdfParser.js, but is decoupled from any PDF library: it
// accepts plain text so it can be fed by pdfjs-dist here (or anything else).

const HEADER_KEYWORDS = {
  debit: /\b(debit|withdrawal|dr)\b/i,
  credit: /\b(credit|deposit|cr)\b/i,
  balance: /\b(balance|bal)\b/i,
};

const MONEY_TOKEN_RE = /-?\d[\d,]*\.?\d*/g;

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchDate(rawLine) {
  const line = String(rawLine).trim();

  // 12/05/2024, 12-05-24, 12.05.2024, 12 May 2024, 2024-05-12
  let m = line.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length <= 2) y = Number(y) >= 50 ? `19${y}` : `20${y}`;
    return buildDate(Number(d), Number(mo), Number(y), m[0]);
  }

  m = line.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) {
      let y = m[3];
      if (y.length <= 2) y = Number(y) >= 50 ? `19${y}` : `20${y}`;
      return buildDate(Number(m[1]), mo, Number(y), m[0]);
    }
  }

  m = line.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
  if (m) {
    return buildDate(Number(m[3]), Number(m[2]), Number(m[1]), m[0]);
  }

  return null;
}

function buildDate(day, month, year, raw) {
  if (!day || !month || !year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getUTCDate() !== day || d.getUTCMonth() + 1 !== month || d.getUTCFullYear() !== year) {
    return null;
  }
  return { iso, raw, day, month, year };
}

function moneyTokens(line) {
  const tokens = [];
  let m;
  MONEY_TOKEN_RE.lastIndex = 0;
  while ((m = MONEY_TOKEN_RE.exec(line)) !== null) {
    const raw = m[0];
    const value = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;
    // Skip long reference / cheque numbers (6+ digits with no decimal part)
    if (!/[.,]/.test(raw) && raw.replace(/[^0-9]/g, '').length >= 6) continue;
    tokens.push({ raw, value, index: m.index });
  }
  return tokens;
}

function cleanNarration(line, amounts) {
  let text = ` ${line} `;
  text = text.replace(/\b(dr|cr)\b\s*$/i, '');
  for (const amt of amounts) {
    text = text.replace(new RegExp(`\\s*${escapeRegex(amt.raw)}\\s*`, 'g'), ' ');
  }
  text = text.replace(/\s{2,}/g, ' ').trim();
  text = text.replace(/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\s*/, '');
  text = text.replace(/\b(debit|credit)\b/gi, '').replace(/\s{2,}/g, ' ').trim();
  return text.replace(/^[\s\-:]+|[\s\-:]+$/g, '').trim();
}

function detectColumns(lines) {
  for (const line of lines.slice(0, 15)) {
    const hasDebit = HEADER_KEYWORDS.debit.test(line);
    const hasCredit = HEADER_KEYWORDS.credit.test(line);
    const hasBalance = HEADER_KEYWORDS.balance.test(line);
    if (hasBalance && (hasDebit || hasCredit)) {
      const cols = [];
      if (hasDebit) cols.push('debit');
      if (hasCredit) cols.push('credit');
      cols.push('balance');
      return cols;
    }
  }
  return null;
}

function detectBankName(lines) {
  const joined = lines.slice(0, 12).join(' ').toLowerCase();
  const banks = [
    ['hdfc', 'HDFC Bank'],
    ['icici', 'ICICI Bank'],
    ['state bank', 'State Bank of India'],
    ['sbi', 'State Bank of India'],
    ['axis', 'Axis Bank'],
    ['kotak', 'Kotak Mahindra Bank'],
    ['punjab national', 'Punjab National Bank'],
    ['yes bank', 'Yes Bank'],
    ['idfc', 'IDFC FIRST Bank'],
    ['indusind', 'IndusInd Bank'],
    ['bank of baroda', 'Bank of Baroda'],
    ['canara', 'Canara Bank'],
  ];
  for (const [needle, name] of banks) {
    if (joined.includes(needle)) return name;
  }
  return '';
}

/**
 * Parse plain statement text (one logical line per entry) into raw
 * transaction rows. Exposed separately so it is unit-testable without a PDF.
 */
function parseStatementText(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const columns = detectColumns(lines);
  const bankName = detectBankName(lines);
  const transactions = [];

  let pending = null;

  const flush = () => {
    if (pending) {
      transactions.push(pending);
      pending = null;
    }
  };

  for (const line of lines) {
    const date = matchDate(line);

    if (date) {
      flush();
      pending = { date, text: line };
      continue;
    }

    if (pending) {
      // Continuation line (narration wrap or amount-only line).
      pending.text += ` ${line}`;
    }
  }
  flush();

  const rows = [];
  for (const entry of transactions) {
    // Remove the leading date so its digits are not mistaken for amounts.
    const bodyText = entry.date.raw ? entry.text.replace(entry.date.raw, ' ') : entry.text;
    const amounts = moneyTokens(bodyText);
    if (!amounts.length) continue;

    // Heuristic: column detection and the explicit debit/credit word decide the
    // side; the first money token is the amount and the last is the running
    // balance when two are present.
    const explicit = /\b(debit|credit|dr|cr|withdrawal|deposit)\b/i.exec(bodyText);
    let type = null;
    if (explicit) {
      const word = explicit[0].toLowerCase();
      if (/credit|cr|deposit/.test(word)) type = 'credit';
      else if (/debit|dr|withdrawal/.test(word)) type = 'debit';
    }
    if (!type && columns) {
      type = columns[0] === 'credit' ? 'credit' : 'debit';
    }
    if (!type) type = 'debit';

    const amount = amounts[0].value;
    const balance = amounts.length > 1 ? amounts[amounts.length - 1].value : null;
    const description = cleanNarration(bodyText, amounts) || 'Bank transaction';

    rows.push({
      date: entry.date.iso,
      description,
      amount: Math.abs(amount),
      type,
      balance,
      reference: null,
    });
  }

  return { transactions: rows, bankName, detectedColumns: columns };
}

// ---------------------------------------------------------------------------
// PDF text extraction via pdfjs-dist
// ---------------------------------------------------------------------------

/**
 * Reconstruct visual lines from PDF.js text items using their y/x transforms.
 * This is what lets the column heuristics see real rows rather than a single
 * wall of text.
 */
function buildLinesFromItems(items) {
  const positioned = [];
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    const transform = item.transform || [];
    const x = typeof item.x === 'number' ? item.x : transform[4] || 0;
    const y = typeof item.y === 'number' ? item.y : transform[5] || 0;
    positioned.push({ x, y, str: item.str });
  }

  positioned.sort((a, b) => b.y - a.y || a.x - b.x);

  const tolerance = 3;
  const lines = [];
  let current = null;

  for (const item of positioned) {
    if (!current || Math.abs(current.y - item.y) > tolerance) {
      current = { y: item.y, items: [] };
      lines.push(current);
    }
    current.items.push(item);
  }

  return lines
    .map((line) =>
      line.items
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean);
}

async function extractPdfText(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;

  const lines = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    lines.push(...buildLinesFromItems(content.items));
    page.cleanup();
  }

  return { text: lines.join('\n'), pageCount: doc.numPages };
}

/**
 * Parse a PDF buffer into normalized imported payment rows.
 */
async function parsePdf(buffer) {
  let extraction;
  try {
    extraction = await extractPdfText(buffer);
  } catch (error) {
    const wrapped = new Error(
      'Could not read this PDF. It may be corrupted or password protected.'
    );
    wrapped.cause = error;
    throw wrapped;
  }

  if (!extraction.text.trim()) {
    return {
      transactions: [],
      bankName: '',
      pageCount: extraction.pageCount,
      detectedColumns: null,
      warning:
        'No selectable text was found in this PDF. It looks like a scanned image, so please upload a text-based statement or a CSV export.',
    };
  }

  const parsed = parseStatementText(extraction.text);
  const transactions = parsed.transactions;

  return {
    transactions,
    bankName: parsed.bankName,
    pageCount: extraction.pageCount,
    detectedColumns: parsed.detectedColumns,
    warning: transactions.length
      ? null
      : 'No transactions could be detected. The statement layout may not be supported yet.',
  };
}

module.exports = {
  parseStatementText,
  extractPdfText,
  parsePdf,
  matchDate,
  buildLinesFromItems,
};