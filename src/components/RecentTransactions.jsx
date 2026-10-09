import React, { useState } from 'react';
import {
  ChevronDown, ChevronUp, Pencil, Trash2,
} from 'lucide-react';
import {
  formatCurrency, formatDate, getTypeLabel, getTypeBadgeClass,
} from '../utils/helpers';

function TransactionRow({ txn, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`badge text-xs ${getTypeBadgeClass(txn.type)}`}>
            {getTypeLabel(txn.type)}
          </span>
          <span className="text-sm font-semibold text-slate-800 truncate">
            {txn.description || txn.category || '—'}
          </span>
          {txn.person && (
            <span className="text-xs text-slate-400">· {txn.person}</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-slate-400">{formatDate(txn.date)}</span>
          {txn.category && (
            <span className="text-xs text-slate-400">{txn.category}</span>
          )}
          {txn.paymentMethod && (
            <span className="text-xs text-slate-400">{txn.paymentMethod}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-base font-bold ${
          ['income', 'borrowed', 'lent_returned'].includes(txn.type)
            ? 'text-green-600'
            : 'text-red-500'
        }`}>
          {['income', 'borrowed', 'lent_returned'].includes(txn.type) ? '+' : '-'}
          {formatCurrency(txn.amount)}
        </span>
        {onEdit && (
          <button
            onClick={() => onEdit(txn)}
            className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(txn.id)}
            className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function RecentTransactions({ transactions, onEdit, onDelete, collapsible = false, title = 'Recent Transactions' }) {
  const [open, setOpen] = useState(!collapsible);
  const display = transactions.slice().sort((a, b) => {
    return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
  }).slice(0, 10);

  return (
    <div className="card">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => collapsible && setOpen(!open)}
        style={{ cursor: collapsible ? 'pointer' : 'default' }}
      >
        <h2 className="section-title">{title}</h2>
        {collapsible && (
          open ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />
        )}
      </button>

      {open && (
        <div className="mt-4">
          {display.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No transactions yet.</p>
          ) : (
            display.map((txn) => (
              <TransactionRow
                key={txn.id}
                txn={txn}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export { TransactionRow };
