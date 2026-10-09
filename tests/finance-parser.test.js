import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { parseNaturalInput } from '../src/services/parserService.js';
import {
  formatDate,
  getTodayStr,
  getYearMonth,
  getTransactionCashImpactCents,
  isValidAmount,
} from '../src/utils/helpers.js';
import {
  calculateBalance,
  getMonthlyReport,
  getSummary,
} from '../src/utils/finance.js';
import { validateLedgerChange } from '../src/utils/ledger.js';
import { fetchAllPages } from '../src/utils/pagination.js';

test('today uses local calendar fields and preserves YYYY-MM-DD', () => {
  const localDate = new Date(2026, 9, 9, 23, 59, 59);
  assert.equal(getTodayStr(localDate), '2026-10-09');
  assert.equal(getYearMonth(getTodayStr(localDate)), '2026-10');
  assert.equal(formatDate('2026-10-09'), new Date(2026, 9, 9).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }));
});

test('today does not shift to UTC when the local calendar date is still the previous day', () => {
  const helpersUrl = new URL('../src/utils/helpers.js', import.meta.url).href;
  const date = execFileSync(process.execPath, [
    '--input-type=module',
    '-e',
    `import { getTodayStr } from '${helpersUrl}'; process.stdout.write(getTodayStr(new Date('2026-10-09T02:00:00.000Z')));`,
  ], {
    encoding: 'utf8',
    env: { ...process.env, TZ: 'America/Los_Angeles' },
  });
  assert.equal(date, '2026-10-08');
});

test('monthly report filters date strings and keeps expense breakdowns in the same month', () => {
  const transactions = [
    { type: 'income', amount: 1000, date: '2026-10-01', category: 'Salary' },
    { type: 'expense', amount: 200.25, date: '2026-10-31', category: 'Food' },
    { type: 'expense', amount: 300, date: '2026-09-30', category: 'Bills' },
  ];
  const report = getMonthlyReport(transactions, '2026-10');

  assert.equal(report.totalIncome, 1000);
  assert.equal(report.totalExpenses, 200.25);
  assert.equal(report.transactionCount, 2);
  assert.deepEqual(report.categoryBreakdown, [{ category: 'Food', amount: 200.25 }]);
});

test('pagination reads every page rather than truncating results at the service limit', async () => {
  const records = Array.from({ length: 1001 }, (_, index) => index);
  const requestedOffsets = [];
  const result = await fetchAllPages(async (offset, pageSize) => {
    requestedOffsets.push(offset);
    return { data: records.slice(offset, offset + pageSize), error: null };
  }, 1000);

  assert.deepEqual(requestedOffsets, [0, 1000]);
  assert.equal(result.length, 1001);
  assert.equal(result.at(-1), 1000);
});

test('pagination propagates database errors instead of returning partial results', async () => {
  const databaseError = new Error('query failed');
  await assert.rejects(
    fetchAllPages(async () => ({ data: [], error: databaseError })),
    databaseError,
  );
});

test('cash balance includes lent returns and all borrowed/repayment effects in cents', () => {
  const transactions = [
    { type: 'income', amount: 1000 },
    { type: 'expense', amount: 200 },
    { type: 'lent', amount: 400 },
    { type: 'lent_returned', amount: 150 },
    { type: 'borrowed', amount: 300 },
    { type: 'borrowed_repaid', amount: 50 },
  ];

  assert.equal(calculateBalance(transactions), 800);
  assert.deepEqual(getSummary(transactions), {
    balance: 800,
    totalIncome: 1000,
    totalExpenses: 200,
    netLent: 250,
    totalLent: 400,
    totalLentReturned: 150,
    totalBorrowed: 300,
    totalBorrowedRepaid: 50,
  });
  assert.equal(getTransactionCashImpactCents({ type: 'borrowed_repaid', amount: 1.25 }), -125);
});

test('positive amounts must be finite and have at most two decimal places', () => {
  assert.equal(isValidAmount('1250.75'), true);
  assert.equal(isValidAmount('1,250.75'), false);
  assert.equal(isValidAmount('0.001'), false);
  assert.equal(isValidAmount('Infinity'), false);
  assert.equal(isValidAmount('12oops'), false);
});

test('ledger validation accepts exact repayment and rejects overpayment', () => {
  const existing = [{ id: 'loan', type: 'borrowed', amount: 1000, person: 'Rahul' }];
  assert.equal(validateLedgerChange(existing, {
    type: 'borrowed_repaid',
    amount: 1000,
    person: 'rahul',
  }).success, true);
  const overpayment = validateLedgerChange(existing, {
    type: 'borrowed_repaid',
    amount: 1000.01,
    person: 'RAHUL',
  });
  assert.equal(overpayment.success, false);
  assert.match(overpayment.errors[0], /Rahul's outstanding borrowed balance/i);
});

test('ledger validation catches deleting or editing the transaction that funded a return', () => {
  const rows = [
    { id: 'loan', type: 'lent', amount: 1000, person: 'Priya' },
    { id: 'return', type: 'lent_returned', amount: 250, person: 'Priya' },
  ];
  assert.equal(validateLedgerChange(rows, null, 'loan').success, false);
  assert.equal(validateLedgerChange(rows, {
    type: 'expense',
    amount: 1000,
    person: '',
  }, 'loan').success, false);
});

const parserCases = [
  ['I spent ₹1,000.50 on groceries', 'expense', 1000.5, 'Food'],
  ['Received Rs. 1,250.75 from Rahul', 'income', 1250.75, 'Other'],
  ['I lent ₹1,000.50 to Priya', 'lent', 1000.5, 'Priya'],
  ['I borrowed 2,000 from Rahul', 'borrowed', 2000, 'Rahul'],
  ['Rahul returned ₹500', 'lent_returned', 500, 'Rahul'],
  ['I repaid ₹500 to Rahul', 'borrowed_repaid', 500, 'Rahul'],
];

for (const [text, type, amount, categoryOrPerson] of parserCases) {
  test(`parses amount and transaction details for "${text}"`, () => {
    const result = parseNaturalInput(text);
    assert.equal(result.success, true);
    assert.equal(result.transaction.type, type);
    assert.equal(result.transaction.amount, amount);
    assert.equal(
      ['lent', 'borrowed', 'lent_returned', 'borrowed_repaid'].includes(type)
        ? result.transaction.person
        : result.transaction.category,
      categoryOrPerson,
    );
  });
}

test('parser asks for an amount and type when they are missing or ambiguous', () => {
  assert.deepEqual(parseNaturalInput('I spent on groceries').missing, ['amount']);
  assert.deepEqual(parseNaturalInput('500').missing, ['type']);
  assert.deepEqual(parseNaturalInput('I got paid 500 for work').missing, ['type']);
});

test('parser rejects negative and malformed comma-grouped amounts', () => {
  assert.deepEqual(parseNaturalInput('I spent -₹200 on food').missing, ['amount']);
  assert.deepEqual(parseNaturalInput('I spent 1,2 on food').missing, ['amount']);
});

test('a word "from" alone does not classify an expense as income', () => {
  const result = parseNaturalInput('I spent 200 from Rahul');
  assert.equal(result.partial.type, 'expense');
  assert.equal(result.partial.amount, 200);
});
