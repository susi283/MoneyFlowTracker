import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNaturalInput } from '../src/services/parserService.js';
import { getTransactionCashImpactCents } from '../src/utils/helpers.js';
import {
  findNegativeLentBorrowedBalance,
  getLentBorrowedLedger,
  getLentBorrowedOutstandingCents,
} from '../src/utils/ledger.js';

const parseCases = [
  ['I gave back ₹500 to Rahul', 'borrowed_repaid', 'Rahul', 500],
  ['I repaid Rahul ₹500', 'borrowed_repaid', 'Rahul', 500],
  ['I returned ₹500 to Rahul', 'borrowed_repaid', 'Rahul', 500],
  ['Paid back ₹500 to Rahul', 'borrowed_repaid', 'Rahul', 500],
  ['Rahul gave back ₹500', 'lent_returned', 'Rahul', 500],
  ['Rahul returned ₹500', 'lent_returned', 'Rahul', 500],
  ['Got ₹500 back from Rahul', 'lent_returned', 'Rahul', 500],
  ['Rahul repaid ₹500', 'lent_returned', 'Rahul', 500],
  ['I gave Rahul ₹500', 'lent', 'Rahul', 500],
  ['I borrowed ₹500 from Rahul', 'borrowed', 'Rahul', 500],
];

for (const [sentence, type, person, amount] of parseCases) {
  test(`parses "${sentence}"`, () => {
    const result = parseNaturalInput(sentence);
    assert.equal(result.success, true);
    assert.equal(result.transaction.type, type);
    assert.equal(result.transaction.person, person);
    assert.equal(result.transaction.amount, amount);
  });
}

test('lent and returned transactions use one record for cash and lent outstanding', () => {
  const transactions = [
    { type: 'lent', amount: 1000, person: 'Rahul' },
    { type: 'lent_returned', amount: 300, person: 'Rahul' },
  ];
  const ledger = getLentBorrowedLedger(transactions).toReceive[0];
  const cashImpact = transactions.reduce((sum, item) => sum + getTransactionCashImpactCents(item), 0);

  assert.deepEqual(
    { lent: ledger.lent, returned: ledger.returned, remaining: ledger.remaining },
    { lent: 1000, returned: 300, remaining: 700 },
  );
  assert.equal(500000 + cashImpact, 430000);
});

test('borrowed and repaid transactions use one record for cash and borrowed outstanding', () => {
  const transactions = [
    { type: 'borrowed', amount: 1000, person: 'Rahul' },
    { type: 'borrowed_repaid', amount: 300, person: 'Rahul' },
  ];
  const ledger = getLentBorrowedLedger(transactions).toPay[0];
  const cashImpact = transactions.reduce((sum, item) => sum + getTransactionCashImpactCents(item), 0);

  assert.deepEqual(
    { borrowed: ledger.borrowed, repaid: ledger.repaid, remaining: ledger.remaining },
    { borrowed: 1000, repaid: 300, remaining: 700 },
  );
  assert.equal(500000 + cashImpact, 570000);
});

test('return or repayment cannot make a person ledger negative', () => {
  const lentTransactions = [
    { type: 'lent', amount: 1000, person: 'Rahul' },
    { type: 'lent_returned', amount: 1000.01, person: 'Rahul' },
  ];
  const borrowedTransactions = [
    { type: 'borrowed', amount: 1000, person: 'Rahul' },
    { type: 'borrowed_repaid', amount: 1000.01, person: 'Rahul' },
  ];

  assert.equal(getLentBorrowedOutstandingCents(lentTransactions, 'lent', 'Rahul'), -1);
  assert.equal(getLentBorrowedOutstandingCents(borrowedTransactions, 'borrowed', 'Rahul'), -1);
  assert.deepEqual(
    findNegativeLentBorrowedBalance(lentTransactions, [{ group: 'lent', person: 'Rahul' }]),
    { group: 'lent', person: 'Rahul' },
  );
});
