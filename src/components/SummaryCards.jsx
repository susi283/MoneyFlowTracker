import React from 'react';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

export default function SummaryCards({ summary }) {
  const {
    balance = 0,
    totalIncome = 0,
    totalExpenses = 0,
  } = summary || {};

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="card bg-blue-600 border-0">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-100 mb-1">Current Balance</p>
            <p className="text-2xl font-bold text-white leading-tight">
              {formatCurrency(balance)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500">
            <Wallet size={20} className="text-white" />
          </div>
        </div>
      </div>

      <div className="card bg-emerald-50 border-emerald-100">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-700 mb-1">Total Income</p>
            <p className="text-2xl font-bold text-emerald-700 leading-tight">
              {formatCurrency(totalIncome)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-100">
            <TrendingUp size={20} className="text-emerald-600" />
          </div>
        </div>
      </div>

      <div className="card bg-red-50 border-red-100">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-600 mb-1">Total Expenses</p>
            <p className="text-2xl font-bold text-red-600 leading-tight">
              {formatCurrency(totalExpenses)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-100">
            <TrendingDown size={20} className="text-red-500" />
          </div>
        </div>
      </div>

    </div>
  );
}
