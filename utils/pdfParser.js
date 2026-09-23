const pdf = require('pdf-parse');

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// Matches a leading date: 01/04/2024, 01-04-24, 01.04.2024, 1/4/2024, 2024-04-01
const NUMERIC_DATE_RE =
  /^(\d{1,2})([\/\-.])(\d{1,2})\2(\d{2,4})|^(\d{4})([\/\-.])(\d{1,2})\6(\d{1,2})/;

// Matches a leading named-month date: 02-Sep-2026, 01 Sep 2026, 2 Sep 26
const NAMED_DATE_RE = /^(\d{1,2})\s*[,\-/.]?\s*([A-Za-z]{3,9})\s*[,\-/.]?\s*(\d{2,4})/;

// Matches money-like tokens and their position in the line.
// Comma-grouped numbers are unambiguous money signals (no clean-start
// requirement: an amount like 1,250.00 can sit flush against 43,950.50).
const MONEY_TOKEN_RE =
  /\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?/g;

const HEADER_KEYWORDS = {
  debit: /\b(dr|debit|withdrawal|paid out)\b/i,
  credit: /\b(cr|credit|deposit|paid in)\b/i,
  balance: /\b(bal(ance)?|closing|cl balance)\b/i,
};

const HEADER_LINE_RE = /debit|credit|withdrawal|deposit|balance/i;

const BREAK_LINE_RE =
  /^(opening balance|closing balance|total|balance|statement|account|page|debit|credit|date|transaction|particulars|narration|value|ref|cheque|chq|important|note|disclaimer|generated)/i;

const BANK_NAMES = [
  { re: /state bank of india|\bsbi\b/i, name: 'SBI' },
  { re: /\bhdfc\b/i, name: 'HDFC Bank' },
  { re: /\bicici\b/i, name: 'ICICI Bank' },
  { re: /\baxis\b/i, name: 'Axis Bank' },
  { re: /\bkotak\b/i, name: 'Kotak Mahindra Bank' },
  { re: /\bpnb\b|punjab national bank/i, name: 'PNB' },
  { re: /canara\b|canara bank/i, name: 'Canara Bank' },
  { re: /\bidfc\b/i, name: 'IDFC First Bank' },
  { re: /\bidbi\b/i, name: 'IDBI Bank' },
  { re: /bank of baroda/i, name: 'Bank of Baroda' },
  { re: /union bank/i, name: 'Union Bank of India' },
  { re: /indusind\b|indus ind\b/i, name: 'IndusInd Bank' },
  { re: /\byes bank\b/i, name: 'Yes Bank' },
  { re: /\bfederal\b/i, name: 'Federal Bank' },
  { re: /south indian bank/i, name: 'South Indian Bank' },
  { re: /\bdbs\b/i, name: 'DBS Bank' },
  { re: /\brbl\b/i, name: 'RBL Bank' },
  { re: /bandhan bank/i, name: 'Bandhan Bank' },
  { re: /bank of india/i, name: 'Bank of India' },
];

function detectBankName(lines) {
  const header = lines.slice(0, 10).join(' ');
  for (const { re, name } of BANK_NAMES) {
    if (re.test(header)) return name;
  }
  return null;
}

function matchDate(line) {
  const m = line.match(NUMERIC_DATE_RE);
  if (m) {
    if (m[1]) {
      return {
        raw: m[0],
        day: parseInt(m[1], 10),
        month: parseInt(m[3], 10),
        year: parseInt(m[4], 10),
      };
    }
    return {
      raw: m[0],
      day: parseInt(m[8], 10),
      month: parseInt(m[7], 10),
      year: parseInt(m[5], 10),
    };
  }
  const n = line.match(NAMED_DATE_RE);
  if (n) {
    const month = MONTHS[n[2].slice(0, 3).toLowerCase()];
    if (month) {
      return {
        raw: n[0],
        day: parseInt(n[1], 10),
        month,
        year: parseInt(n[3], 10),
      };
    }
  }
  return null;
}

function parseDate(match) {
  let year = match.year;
  if (year < 100) year += year >= 50 ? 1900 : 2000;
  const date = new Date(Date.UTC(year, match.month - 1, match.day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== match.month - 1 ||
    date.getUTCDate() !== match.day
  ) {
    return null; // invalid calendar date
  }
  return date.toISOString();
}

function extractMoneyTokens(line) {
  const tokens = [];
  let m;
  MONEY_TOKEN_RE.lastIndex = 0;
  while ((m = MONEY_TOKEN_RE.exec(line)) !== null) {
    // Ignore long reference / cheque numbers
    if (/\d{6,}/.test(m[0]) && !m[0].includes(',')) continue;
    tokens.push({ raw: m[0], index: m.index });
  }
  return tokens;
}

function toNumber(raw) {
  const n = parseFloat(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function detectColumns(lines) {
  const headerLines = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => HEADER_LINE_RE.test(line));

  for (const { line } of headerLines.slice(0, 12)) {
    const order = [];
    let hasBalance = false;
    for (const key of ['debit', 'credit', 'balance']) {
      const re = HEADER_KEYWORDS[key];
      const pos = line.search(re);
      if (pos !== -1) {
        order.push({ key, pos });
        if (key === 'balance') hasBalance = true;
      }
    }
    // "Dr"/"Cr" in a date/narration line is unreliable; require balance to anchor
    if (hasBalance && order.length >= 2) {
      order.sort((a, b) => a.pos - b.pos);
      return order.map((o) => o.key);
    }
  }
  return null;
}

function cleanNarration(line, amounts) {
  let text = line;
  // strip balance-side indicator suffixes (Dr/Cr) that some banks append
  text = text.replace(/\b(dr|cr)\b\s*$/i, '');
  // remove the parsed money tokens from the narration, also swallowing the
  // stray currency-glyph "n" some PDFs render right before an amount
  for (const amt of amounts) {
    text = text.replace(new RegExp(`n?${escapeRegex(amt.raw)}`), ' ');
  }
  // drop the explicit Debit/Credit "type" column word glued to the narration
  // (e.g. "Online ShoppingDebit" -> "Online Shopping") — only the final one,
  // and only when it is glued to the previous word (no space), so that a real
  // narration like "SALARY CREDIT" keeps its last word
  text = text.replace(/(?<=[A-Za-z])(credit|debit)\s*$/i, '');
  // drop leftover date-like fragments and long digit runs (ref/cheque numbers)
  text = text.replace(/\d{4,}/g, ' ');
  // drop transaction-id markers left behind ("TXN260902001" -> "TXN")
  text = text.replace(/\bTXN\b/gi, ' ');
  text = text.replace(/[#*\-_|]+/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  // drop pure punctuation leftovers
  return text.replace(/^[^A-Za-z0-9₹]+|[^A-Za-z0-9₹]+$/g, '').trim();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeDescription(narration) {
  const desc = (narration || 'Bank transaction').slice(0, 200).trim();
  return desc || 'Bank transaction';
}

function parseTransaction(text, date, header, prevBalance) {
  // Remove the leading date first so its digits don't look like money values
  const bodyText = date ? text.replace(date.raw, ' ') : text;
  const moneyTokens = extractMoneyTokens(bodyText);
  const tokens = moneyTokens.filter((t) => toNumber(t.raw) !== null);
  const amounts = tokens.map((t) => ({ raw: t.raw, value: toNumber(t.raw) }));

  if (!amounts.length) return null;

  // The closing balance is (almost always) the last money value on the line.
  const balance = amounts[amounts.length - 1].value;
  const candidateTokens = amounts.slice(0, -1);

  let txnAmount = null;
  let side = null;

  // Prefer the last candidate that reproduces the balance from the previous one
  const matches = (value) => {
    if (prevBalance === null) return null;
    const a = prevBalance;
    const check = [];
    if (Math.abs(a + value - balance) < 0.005) check.push('credit');
    if (Math.abs(a - value - balance) < 0.005) check.push('debit');
    return check;
  };

  for (let i = candidateTokens.length - 1; i >= 0; i--) {
    const cand = matches(candidateTokens[i].value);
    if (cand && cand.length === 1) {
      side = cand[0];
      txnAmount = candidateTokens[i].value;
      break;
    }
    if (cand && cand.length === 2 && txnAmount === null) {
      // ambiguous (zero-balance scenarios); lean on header order below
      txnAmount = candidateTokens[i].value;
      break;
    }
  }

  if (side === null) {
    // Explicit "Debit"/"Credit" type-column word (last occurrence wins),
    // e.g. "...Salary CreditCredit 75,000.00 2,00,000.00"
    const words = bodyText.match(/credit|debit/gi);
    const explicit = words ? words[words.length - 1].toLowerCase() : null;
    if (explicit === 'credit' || explicit === 'debit') {
      side = explicit;
      txnAmount = txnAmount !== null ? txnAmount : candidateTokens[candidateTokens.length - 1]?.value;
    }
  }

  if (side === null) {
    // Fall back to header column order when available
    const pick = header
      ? header.filter((key) => key !== 'balance')
      : null;
    if (pick && pick[0]) {
      side = pick[0] === 'debit' ? 'debit' : 'credit';
      txnAmount = txnAmount !== null ? txnAmount : candidateTokens[candidateTokens.length - 1]?.value;
    } else if (candidateTokens.length) {
      // No header info: default to debit so nothing silently becomes income
      side = 'debit';
      txnAmount = candidateTokens[candidateTokens.length - 1].value;
    }
  }

  if (txnAmount === null || txnAmount <= 0) return null;

  const narration = cleanNarration(bodyText, amounts);

  return {
    date: parseDate(date),
    rawDate: date ? date.raw : null,
    narration,
    description: makeDescription(narration),
    amount: txnAmount,
    type: side,
    balance,
  };
}

/**
 * Extract text and parse bank statement transactions from a PDF buffer.
 * Returns a normalized list plus a small report so callers can surface warnings.
 */
async function parseStatementPdf(buffer) {
  const data = await pdf(buffer);
  const text = data.text || '';

  if (!text.trim()) {
    return {
      transactions: [],
      textLength: 0,
      detectedColumns: null,
      warning:
        'No text could be extracted from this PDF. It may be a scanned image; please export a text-based statement or use a passbook PDF.',
    };
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const columns = detectColumns(lines);

  // Seed the running balance from an opening balance line if present
  let prevBalance = null;
  for (const line of lines.slice(0, 20)) {
    if (/opening\s+(?:balance|bal)\b/i.test(line)) {
      const tokens = extractMoneyTokens(line);
      const money = tokens.filter((t) => t.raw.includes('.') || t.raw.includes(','));
      if (money.length) {
        prevBalance = toNumber(money[money.length - 1].raw);
        break;
      }
    }
  }

  const transactions = [];
  let i = 0;

  while (i < lines.length) {
    const dateMatch = matchDate(lines[i]);
    if (!dateMatch) {
      i++;
      continue;
    }

    // Gather continuation lines (wrapped narration / amount rows) until the
    // next date line or an obvious header / totals line.
    const fullText = [];
    let j = i;
    while (j < lines.length) {
      const next = lines[j];
      if (j > i && matchDate(next)) break;
      if (j > i && BREAK_LINE_RE.test(next)) break;
      fullText.push(lines[j]);
      j++;
    }

    const chunkText = fullText.join(' ');
    const txn = parseTransaction(chunkText, dateMatch, columns, prevBalance);

    if (txn) {
      if (txn.balance !== null) prevBalance = txn.balance;
      transactions.push(txn);
    }

    i = j;
  }

  return {
    transactions,
    textLength: text.length,
    detectedColumns: columns,
    bankName: detectBankName(lines),
    warning:
      transactions.length === 0
        ? 'No transactions could be detected. The statement layout may not be supported yet.'
        : null,
  };
}

module.exports = { parseStatementPdf };