import React, { useEffect, useState } from 'react';
import CategoryChart from '../components/CategoryChart';
import { transactionService } from '../services/transactionService';
import {
  formatCurrency, getCurrentMonth, getMonthName,
} from '../utils/helpers';

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card">
      <p className={`text-sm font-semibold ${color || 'text-slate-500'} mb-1`}>{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-slate-800'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function ReportsPage({ userId, availableMonths, revision }) {
  const months = [...availableMonths];
  const current = getCurrentMonth();
  const [selectedMonth, setSelectedMonth] = useState(current);
  const [reportData, setReportData] = useState({
    report: { totalIncome: 0, totalExpenses: 0, categoryBreakdown: [], transactionCount: 0 },
    previousReport: { totalIncome: 0, totalExpenses: 0 },
  });
  const [error, setError] = useState('');

  if (!months.includes(selectedMonth)) months.unshift(selectedMonth);

  useEffect(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const previousDate = new Date(year, month - 2, 1);
    const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
    let active = true;

    transactionService.getMonthlyReports(userId, selectedMonth, previousMonth)
      .then((data) => {
        if (!active) return;
        setReportData(data);
        setError('');
      })
      .catch((err) => {
        console.error('Failed to load monthly reports:', err);
        if (active) setError('Unable to load this report.');
      });

    return () => { active = false; };
  }, [selectedMonth, userId, revision]);

  const { report, previousReport: prevReport } = reportData;
  const netFlow = report.totalIncome - report.totalExpenses;
  const topCategory = report.categoryBreakdown[0];

  const expenseDiff = report.totalExpenses - prevReport.totalExpenses;
  const incomeDiff = report.totalIncome - prevReport.totalIncome;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Monthly Reports</h1>
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
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Key Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Income"
          value={formatCurrency(report.totalIncome)}
          color="text-emerald-600"
          sub={incomeDiff !== 0 ? `${incomeDiff > 0 ? '+' : ''}${formatCurrency(incomeDiff)} vs prev month` : 'No previous data'}
        />
        <StatCard
          label="Total Expenses"
          value={formatCurrency(report.totalExpenses)}
          color="text-red-500"
          sub={expenseDiff !== 0 ? `${expenseDiff > 0 ? '+' : ''}${formatCurrency(expenseDiff)} vs prev month` : 'No previous data'}
        />
        <StatCard
          label="Net Cash Flow"
          value={formatCurrency(netFlow)}
          color={netFlow >= 0 ? 'text-emerald-600' : 'text-red-500'}
          sub={netFlow >= 0 ? 'Positive flow 👍' : 'Spent more than earned'}
        />
        <StatCard
          label="Transactions"
          value={report.transactionCount}
          sub="in this month"
        />
      </div>

      {/* Top category callout */}
      {topCategory && (
        <div className="card bg-violet-50 border-violet-100">
          <p className="text-sm font-semibold text-violet-600">🏆 Highest Spending Category</p>
          <p className="text-xl font-bold text-violet-800 mt-1">{topCategory.category}</p>
          <p className="text-sm text-violet-500 mt-1">{formatCurrency(topCategory.amount)} spent</p>
        </div>
      )}

      {/* Income vs Expense visual */}
      <div className="card">
        <h3 className="section-title mb-4">Income vs Expenses</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-emerald-700">Income</span>
              <span className="font-bold text-emerald-700">{formatCurrency(report.totalIncome)}</span>
            </div>
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full"
                style={{
                  width: report.totalIncome + report.totalExpenses > 0
                    ? `${(report.totalIncome / (report.totalIncome + report.totalExpenses)) * 100}%`
                    : '0%'
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-red-600">Expenses</span>
              <span className="font-bold text-red-600">{formatCurrency(report.totalExpenses)}</span>
            </div>
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-400 rounded-full"
                style={{
                  width: report.totalIncome + report.totalExpenses > 0
                    ? `${(report.totalExpenses / (report.totalIncome + report.totalExpenses)) * 100}%`
                    : '0%'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <CategoryChart data={report.categoryBreakdown} title="Category-wise Expenses" />
    </div>
  );
}
