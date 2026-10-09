import React from 'react';
import LentBorrowedWidget from '../components/LentBorrowedWidget';
import LedgerHistory from '../components/LedgerHistory';
import { formatCurrency } from '../utils/helpers';

const HISTORY_TYPES = ['lent', 'lent_returned'];

function SummaryCard({ title, amount, color }) {
  return (
    <div className="card">
      <p className={`text-sm font-semibold ${color} mb-1`}>{title}</p>
      <p className={`text-2xl font-bold ${color}`}>{formatCurrency(amount)}</p>
    </div>
  );
}

export default function LentPage({ userId, ledger, onAddTransaction, revision }) {
  const people = ledger?.toReceive || [];
  const totalLent = people.reduce((sum, item) => sum + item.lent, 0);
  const totalReturned = people.reduce((sum, item) => sum + item.returned, 0);
  const totalOutstanding = people.reduce((sum, item) => sum + item.remaining, 0);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Lent</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard title="Total Lent" amount={totalLent} color="text-orange-600" />
        <SummaryCard title="Total Returned" amount={totalReturned} color="text-emerald-600" />
        <SummaryCard title="Total Outstanding Lent" amount={totalOutstanding} color="text-red-500" />
      </div>

      <LentBorrowedWidget
        ledger={{ toReceive: people, toPay: [] }}
        onAddTransaction={onAddTransaction}
        compact
      />
      <LedgerHistory userId={userId} types={HISTORY_TYPES} revision={revision} title="Complete Lent History" />
    </div>
  );
}
