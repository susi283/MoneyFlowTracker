import React from 'react';
import LentBorrowedWidget from '../components/LentBorrowedWidget';
import LedgerHistory from '../components/LedgerHistory';
import { formatCurrency } from '../utils/helpers';

const HISTORY_TYPES = ['borrowed', 'borrowed_repaid'];

function SummaryCard({ title, amount, color }) {
  return (
    <div className="card">
      <p className={`text-sm font-semibold ${color} mb-1`}>{title}</p>
      <p className={`text-2xl font-bold ${color}`}>{formatCurrency(amount)}</p>
    </div>
  );
}

export default function BorrowedPage({ userId, ledger, onAddTransaction, revision }) {
  const people = ledger?.toPay || [];
  const totalBorrowed = people.reduce((sum, item) => sum + item.borrowed, 0);
  const totalRepaid = people.reduce((sum, item) => sum + item.repaid, 0);
  const totalOutstanding = people.reduce((sum, item) => sum + item.remaining, 0);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Borrowed</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard title="Total Borrowed" amount={totalBorrowed} color="text-blue-600" />
        <SummaryCard title="Total Repaid" amount={totalRepaid} color="text-emerald-600" />
        <SummaryCard title="Total Outstanding Borrowed" amount={totalOutstanding} color="text-red-500" />
      </div>

      <LentBorrowedWidget
        ledger={{ toReceive: [], toPay: people }}
        onAddTransaction={onAddTransaction}
        compact
      />
      <LedgerHistory userId={userId} types={HISTORY_TYPES} revision={revision} title="Complete Borrowed History" />
    </div>
  );
}
