/**
 * Smart natural language parser for transaction input.
 * This is a rule-based local parser.
 * Replace the `parse` function with an AI call in the future.
 */

import { getTodayStr } from '../utils/helpers.js';

// Keywords that suggest different transaction types
const EXPENSE_KEYWORDS = [
  'spent', 'spend', 'paid', 'pay', 'bought', 'buy', 'purchased', 'purchase',
  'expense', 'cost', 'used', 'charged', 'debited',
];

const INCOME_KEYWORDS = [
  'got', 'received', 'get', 'earned', 'earn', 'income', 'salary', 'credited',
  'from', 'gained', 'deposited',
];

const BORROWED_KEYWORDS = [
  'borrowed', 'borrow', 'took from', 'taken from',
];

// Category keyword map
const CATEGORY_KEYWORDS = {
  Food: ['food', 'eat', 'lunch', 'dinner', 'breakfast', 'restaurant', 'swiggy', 'zomato', 'groceries', 'grocery', 'snack', 'coffee', 'tea', 'meal', 'hotel'],
  Transport: ['bus', 'auto', 'taxi', 'cab', 'uber', 'ola', 'metro', 'train', 'travel', 'petrol', 'fuel', 'transport', 'commute', 'ride', 'rickshaw'],
  Shopping: ['shop', 'shopping', 'clothes', 'shirt', 'shoes', 'dress', 'amazon', 'flipkart', 'mall', 'purchase'],
  Entertainment: ['movie', 'cinema', 'netflix', 'hotstar', 'game', 'concert', 'show', 'outing', 'fun', 'entertainment'],
  Education: ['book', 'course', 'school', 'college', 'fee', 'tuition', 'class', 'study', 'education'],
  Bills: ['bill', 'electricity', 'water', 'internet', 'wifi', 'phone', 'mobile', 'recharge', 'rent', 'subscription'],
  Health: ['doctor', 'medicine', 'pharmacy', 'hospital', 'clinic', 'health', 'medical', 'gym'],
  Salary: ['salary', 'wage', 'stipend'],
  Freelance: ['freelance', 'project', 'client', 'work'],
  'Pocket Money': ['pocket money', 'allowance', 'pocket'],
  Business: ['business', 'profit', 'revenue', 'sales'],
  Gift: ['gift', 'birthday', 'festival', 'bonus'],
  Refund: ['refund', 'cashback', 'return'],
};

function matchKeywords(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function extractAmount(text) {
  // Match patterns like: 200, ₹200, Rs 200, Rs. 200, 1,000, 1000.50
  const match = text.match(/(?:₹|rs\.?\s*)?(\d+(?:,\d+)*(?:\.\d+)?)/i);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }
  return null;
}

const MONEY_PATTERN = '(?:₹|rs\\.?\\s*)?\\d+(?:,\\d+)*(?:\\.\\d+)?';
const PERSON_PATTERN = "([\\p{L}][\\p{L} .'-]*?)";

function extractPerson(text, type) {
  const clean = text
    .replace(new RegExp(MONEY_PATTERN, 'giu'), ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,!?]+$/, '')
    .trim();

  const patterns = type === 'borrowed_repaid'
    ? [
      new RegExp(`^(?:i\\s+)?(?:gave\\s+back|paid\\s+back|returned)\\s+(?:to\\s+)?${PERSON_PATTERN}$`, 'iu'),
      new RegExp(`^(?:i\\s+)?repaid\\s+${PERSON_PATTERN}$`, 'iu'),
      new RegExp(`^(?:i\\s+)?(?:gave\\s+back|paid\\s+back|returned)\\s+${MONEY_PATTERN}\\s+to\\s+${PERSON_PATTERN}$`, 'iu'),
      new RegExp(`^(?:i\\s+)?repaid\\s+${PERSON_PATTERN}\\s+${MONEY_PATTERN}$`, 'iu'),
    ]
    : type === 'lent_returned'
      ? [
        new RegExp(`^${PERSON_PATTERN}\\s+(?:gave\\s+back|returned|repaid)(?:\\s+the\\s+money)?$`, 'iu'),
        new RegExp(`^(?:got|received)\\s+(?:the\\s+money\\s+)?back\\s+from\\s+${PERSON_PATTERN}$`, 'iu'),
        new RegExp(`^(?:got|received)\\s+${MONEY_PATTERN}\\s+back\\s+from\\s+${PERSON_PATTERN}$`, 'iu'),
      ]
      : type === 'borrowed'
        ? [
          new RegExp(`^(?:i\\s+)?(?:borrowed|borrow)\\s+from\\s+${PERSON_PATTERN}$`, 'iu'),
          new RegExp(`^(?:i\\s+)?(?:borrowed|borrow)\\s+${MONEY_PATTERN}\\s+from\\s+${PERSON_PATTERN}$`, 'iu'),
        ]
        : [
          new RegExp(`^(?:i\\s+)?(?:gave|give|lent|lend|loaned|loan)\\s+(?:money\\s+)?(?:to\\s+)?${PERSON_PATTERN}$`, 'iu'),
          new RegExp(`^(?:i\\s+)?(?:gave|give|lent|lend|loaned|loan)\\s+${PERSON_PATTERN}\\s+${MONEY_PATTERN}$`, 'iu'),
        ];

  for (const pattern of patterns) {
    const match = clean.match(pattern);
    const candidate = match?.[match.length - 1]?.trim().replace(/\s+/g, ' ');
    if (candidate && !['me', 'my', 'i', 'the', 'a', 'an', 'cash', 'upi', 'back'].includes(candidate.toLowerCase())) {
      return candidate;
    }
  }

  const fallbackPatterns = [
    new RegExp(`\\bfrom\\s+${PERSON_PATTERN}$`, 'iu'),
    new RegExp(`\\bto\\s+${PERSON_PATTERN}$`, 'iu'),
    new RegExp(`^${PERSON_PATTERN}\\s+(?:returned|repaid|paid\\s+back|gave\\s+back)\\b`, 'iu'),
  ];
  for (const pattern of fallbackPatterns) {
    const match = clean.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/\s+/g, ' ');
  }
  return null;
}

function detectCategory(text) {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return null;
}

function detectType(text) {
  const lower = text.toLowerCase().replace(/[₹,]/g, ' ');

  if (/\b(?:i\s+)?(?:gave\s+back|paid\s+back|returned)\b.*\bto\b/.test(lower)
    || /\b(?:i\s+)?repaid\s+[\p{L}]/u.test(lower)) {
    return 'borrowed_repaid';
  }
  if (/^[\p{L}][\p{L} .'-]*\s+(?:gave\s+back|returned|repaid)\b/u.test(lower)
    || /\b(?:got|received)\b.*\bback\s+from\b/.test(lower)
    || /\b(?:got|received)\s+.+\s+from\b/.test(lower) && /\bback\b/.test(lower)) {
    return 'lent_returned';
  }
  if (/\b(?:i\s+)?(?:borrowed|borrow)\b.*\bfrom\b/.test(lower)
    || matchKeywords(lower, BORROWED_KEYWORDS)) {
    return 'borrowed';
  }
  if (/\b(?:i\s+)?(?:gave|give|lent|lend|loaned|loan)\b/.test(lower)) {
    return 'lent';
  }
  if (matchKeywords(lower, INCOME_KEYWORDS)) {
    return 'income';
  }
  if (matchKeywords(lower, EXPENSE_KEYWORDS)) {
    return 'expense';
  }

  // Default if amount mentioned but type unclear
  return null;
}

/**
 * Main parse function.
 * Returns a result object:
 * {
 *   success: boolean,
 *   transaction: { type, amount, category, description, person, date } | null,
 *   missing: string[] (fields that need to be asked),
 *   suggestion: string (human-friendly prompt for missing info)
 * }
 */
export function parseNaturalInput(text) {
  if (!text || !text.trim()) {
    return { success: false, transaction: null, missing: ['text'], suggestion: 'Please type a transaction.' };
  }

  const trimmed = text.trim();
  const amount = extractAmount(trimmed);
  const type = detectType(trimmed);
  const person = extractPerson(trimmed, type);
  const category = detectCategory(trimmed);
  const date = getTodayStr();

  // Clean description: remove amount, leading keywords
  let description = trimmed
    .replace(/(?:₹|rs\.?\s*)?(\d+(?:,\d+)*(?:\.\d+)?)/gi, '')
    .replace(/^(i\s+)?(spent|spend|paid|pay|got|received|gave|lent|borrowed)/i, '')
    .trim();
  if (!description) description = trimmed;

  const missing = [];

  if (!amount) missing.push('amount');
  if (!type) missing.push('type');

  const needsPerson = ['lent', 'borrowed', 'lent_returned', 'borrowed_repaid'].includes(type);
  if (needsPerson && !person) missing.push('person');

  // For expense without category, ask
  if (type === 'expense' && !category) missing.push('category');

  if (missing.length > 0) {
    let suggestion = '';
    if (missing.includes('amount')) {
      suggestion = 'How much was the amount?';
    } else if (missing.includes('type')) {
      suggestion = 'Is this an expense, income, or something else?';
    } else if (missing.includes('person')) {
      suggestion = `Who did you ${type === 'lent' ? 'lend to' : type === 'borrowed' ? 'borrow from' : 'receive this from'}?`;
    } else if (missing.includes('category')) {
      suggestion = 'What did you spend it on?';
    }

    return {
      success: false,
      transaction: null,
      missing,
      suggestion,
      partial: { type, amount, category, person, date, description },
    };
  }

  // Infer category for non-expenses
  const finalCategory = ['lent', 'borrowed', 'lent_returned', 'borrowed_repaid'].includes(type)
    ? 'Other'
    : category || 'Other';

  return {
    success: true,
    transaction: {
      type,
      amount,
      category: finalCategory,
      description: description || trimmed,
      person: person || '',
      date,
      paymentMethod: 'Cash',
      status: 'completed',
    },
    missing: [],
    suggestion: '',
  };
}
