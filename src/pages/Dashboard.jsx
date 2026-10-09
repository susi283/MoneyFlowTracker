import React, { useMemo, useState } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import SummaryCards from '../components/SummaryCards';
import SmartInput from '../components/SmartInput';
import CategoryChart from '../components/CategoryChart';
import RecentTransactions from '../components/RecentTransactions';
import { transactionService } from '../services/transactionService';
import { getCurrentMonth, getMonthName } from '../utils/helpers';

export default function Dashboard({ transactions, metricsRows, availableMonths, summary, onAdd, onReset, categories }) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetError, setResetError] = useState('');

  const months = [...availableMonths];
  if (!months.includes(selectedMonth)) months.unshift(selectedMonth);

  const categoryData = useMemo(
    () => transactionService.getCategoryBreakdown(metricsRows, selectedMonth),
    [metricsRows, selectedMonth],
  );

  async function handleReset() {
    setResetError('');
    try {
      await onReset?.();
      setShowResetConfirm(false);
    } catch (error) {
      console.error('Failed to reset transactions:', error);
      setResetError('Unable to reset transactions. Please try again.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">Dashboard</h1>
        <div className="flex items-center gap-2">
          <p className="text-sm text-slate-400 hidden sm:block">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          {/* Reset Button */}
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 text-sm font-semibold px-3 py-2 rounded-xl border border-slate-200 hover:border-red-200 transition-colors"
            title="Reset all transactions"
          >
            <RotateCcw size={15} />
            <span className="hidden sm:inline">Reset Data</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards summary={summary} />

      {/* Smart Input */}
      <SmartInput onAdd={onAdd} categories={categories} />

      {/* Category Chart */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Expenses by Category</h2>
          <select
            className="select-field w-auto text-sm"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {months.map((m) => (
              <option key={m} value={m}>{getMonthName(m)}</option>
            ))}
          </select>
        </div>
        <CategoryChart data={categoryData} title="" />
      </div>

      {/* Recent Transactions (collapsed by default) */}
      <RecentTransactions
        transactions={transactions}
        collapsible={true}
        title="Recent Transactions"
      />

      {/* Reset Confirm Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Reset All Transactions?</h3>
            </div>
            <p className="text-sm text-slate-500 mb-5">
              This will <strong>permanently delete all your transactions</strong>. Your totals will return to zero. This cannot be undone.
            </p>
            {resetError && <p className="text-sm text-red-600 mb-4">{resetError}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
              >
                Yes, Clear All
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
