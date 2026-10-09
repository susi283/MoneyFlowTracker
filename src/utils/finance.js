import { getTransactionCashImpactCents } from './helpers.js';

function toCents(amount) {
  return Math.round((Number(amount) || 0) * 100);
}

function fromCents(amount) {
  return amount / 100;
}

export function calculateBalance(transactions) {
  if (!Array.isArray(transactions)) return 0;
  return fromCents(transactions.reduce(
    (sum, transaction) => sum + getTransactionCashImpactCents(transaction),
    0,
  ));
}

export function getSummary(transactions) {
  if (!Array.isArray(transactions)) {
    return { balance: 0, totalIncome: 0, totalExpenses: 0, netLent: 0 };
  }

  let totalIncome = 0;
  let totalExpenses = 0;
  let totalLent = 0;
  let totalLentReturned = 0;
  let totalBorrowed = 0;
  let totalBorrowedRepaid = 0;
  let balance = 0;

  transactions.forEach((transaction) => {
    const amount = toCents(transaction.amount);
    balance += getTransactionCashImpactCents(transaction);
    switch (transaction.type) {
      case 'income': totalIncome += amount; break;
      case 'expense': totalExpenses += amount; break;
      case 'lent': totalLent += amount; break;
      case 'lent_returned': totalLentReturned += amount; break;
      case 'borrowed': totalBorrowed += amount; break;
      case 'borrowed_repaid': totalBorrowedRepaid += amount; break;
    }
  });

  return {
    balance: fromCents(balance),
    totalIncome: fromCents(totalIncome),
    totalExpenses: fromCents(totalExpenses),
    netLent: fromCents(Math.max(0, totalLent - totalLentReturned)),
    totalLent: fromCents(totalLent),
    totalLentReturned: fromCents(totalLentReturned),
    totalBorrowed: fromCents(totalBorrowed),
    totalBorrowedRepaid: fromCents(totalBorrowedRepaid),
  };
}

export function getCategoryBreakdown(transactions, month) {
  if (!Array.isArray(transactions)) return [];
  const filtered = month
    ? transactions.filter((transaction) => transaction.date && transaction.date.startsWith(month))
    : transactions;
  const totals = new Map();

  filtered.filter((transaction) => transaction.type === 'expense').forEach((transaction) => {
    const category = transaction.category || 'Other';
    totals.set(category, (totals.get(category) || 0) + (Number(transaction.amount) || 0));
  });

  return Array.from(totals, ([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function getMonthlyReport(transactions, month) {
  const filtered = (Array.isArray(transactions) ? transactions : [])
    .filter((transaction) => transaction.date && transaction.date.startsWith(month));
  return {
    ...getSummary(filtered),
    categoryBreakdown: getCategoryBreakdown(filtered),
    transactionCount: filtered.length,
  };
}
