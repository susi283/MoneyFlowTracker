import React, { useEffect, useState } from 'react';
import { Plus, Search, X, Pencil, Trash2 } from 'lucide-react';
import {
  formatCurrency, formatDate, getTypeLabel, getTypeBadgeClass, getTodayStr,
} from '../utils/helpers';
import TransactionForm from '../components/TransactionForm';
import { transactionService } from '../services/transactionService';

const PAGE_SIZE = 20;

function optimisticRecord(data, original = {}) {
  return {
    ...original,
    id: original.id || `pending-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
    type: data.type,
    amount: Number(data.amount),
    category: data.category || 'Other',
    description: data.description?.trim() || '',
    person: data.person?.trim() || '',
    date: data.date || getTodayStr(),
    paymentMethod: data.paymentMethod || 'Cash',
    status: data.status || 'completed',
    createdAt: original.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function matchesFilters(transaction, { type, category, month, search }) {
  if (type && transaction.type !== type) return false;
  if (category && transaction.category !== category) return false;
  if (month && !transaction.date?.startsWith(month)) return false;
  if (search) {
    const query = search.toLowerCase();
    return [transaction.description, transaction.person, transaction.category, String(transaction.amount)]
      .some((value) => String(value || '').toLowerCase().includes(query));
  }
  return true;
}

function sortHistory(rows) {
  return rows.sort((a, b) => {
    const dateDiff = new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`);
    return dateDiff || new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

const ALL_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'lent', label: 'Lent' },
  { value: 'borrowed', label: 'Borrowed' },
  { value: 'lent_returned', label: 'Lent Returned' },
  { value: 'borrowed_repaid', label: 'Borrowed Repaid' },
];

export default function TransactionsPage({
  userId, availableMonths, revision, onAdd, onUpdate, onDelete, categories,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingTxn, setEditingTxn] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const months = availableMonths;
  const allCats = [...new Set([
    ...(categories?.expense || []),
    ...(categories?.income || []),
    ...transactions.map((transaction) => transaction.category).filter(Boolean),
  ])].sort();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    const timer = setTimeout(() => {
      transactionService.getHistoryPage(userId, {
        page,
        pageSize: PAGE_SIZE,
        type: filterType,
        category: filterCategory,
        month: filterMonth,
        search,
      }).then((result) => {
        if (!active) return;
        setTransactions(result.transactions);
        setTotal(result.total);
      }).catch((err) => {
        console.error('Failed to load transaction history:', err);
        if (active) setLoadError('Unable to load transactions.');
      }).finally(() => { if (active) setLoading(false); });
    }, search ? 250 : 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [userId, page, filterType, filterCategory, filterMonth, search, revision]);

  async function handleAdd(data) {
    setFormError('');
    const optimistic = optimisticRecord(data);
    const filters = { type: filterType, category: filterCategory, month: filterMonth, search };
    const matches = matchesFilters(optimistic, filters);
    if (matches) {
      if (page === 1) setTransactions((current) => sortHistory([optimistic, ...current]).slice(0, PAGE_SIZE));
      setTotal((current) => current + 1);
    }
    setShowForm(false);
    setFormSuccess('Transaction added!');
    const resultPromise = onAdd(data);
    resultPromise.then((result) => {
      if (result.success) {
        setTransactions((current) => sortHistory(current.map((transaction) => (
          transaction.id === optimistic.id ? result.transaction : transaction
        ))));
        setFormSuccess('Transaction added!');
        setTimeout(() => setFormSuccess(''), 3000);
        return;
      }
      setTransactions((current) => current.filter((transaction) => transaction.id !== optimistic.id));
      if (matches) setTotal((current) => Math.max(0, current - 1));
      setFormSuccess('');
      setFormError(result.errors?.join(', ') || 'Failed to add.');
      setShowForm(true);
    }).catch((err) => {
      setTransactions((current) => current.filter((transaction) => transaction.id !== optimistic.id));
      if (matches) setTotal((current) => Math.max(0, current - 1));
      setFormSuccess('');
      setFormError(err.message || 'Failed to add.');
      setShowForm(true);
    });
    const result = await resultPromise;
    return result;
  }

  async function handleUpdate(data) {
    setFormError('');
    const original = editingTxn;
    const optimistic = optimisticRecord(data, original);
    const filters = { type: filterType, category: filterCategory, month: filterMonth, search };
    const oldMatch = matchesFilters(original, filters);
    const newMatch = matchesFilters(optimistic, filters);
    setTransactions((current) => {
      const updated = current.filter((transaction) => transaction.id !== original.id);
      if (newMatch) updated.unshift(optimistic);
      return sortHistory(updated).slice(0, PAGE_SIZE);
    });
    if (oldMatch !== newMatch) setTotal((current) => Math.max(0, current + (newMatch ? 1 : -1)));
    setEditingTxn(null);
    setFormSuccess('Transaction updated!');
    const resultPromise = onUpdate(original.id, data);
    resultPromise.then((result) => {
      if (result.success) {
        setTransactions((current) => sortHistory(current.map((transaction) => (
          transaction.id === original.id ? result.transaction : transaction
        ))));
        setFormSuccess('Transaction updated!');
        setTimeout(() => setFormSuccess(''), 3000);
        return;
      }
      setTransactions((current) => {
        const updated = current.filter((transaction) => transaction.id !== original.id);
        if (oldMatch) updated.unshift(original);
        return sortHistory(updated).slice(0, PAGE_SIZE);
      });
      if (oldMatch !== newMatch) setTotal((current) => Math.max(0, current + (oldMatch ? 1 : -1)));
      setFormSuccess('');
      setFormError(result.errors?.join(', ') || 'Failed to update.');
      setEditingTxn(original);
    }).catch((err) => {
      setTransactions((current) => {
        const updated = current.filter((transaction) => transaction.id !== original.id);
        if (oldMatch) updated.unshift(original);
        return sortHistory(updated).slice(0, PAGE_SIZE);
      });
      if (oldMatch !== newMatch) setTotal((current) => Math.max(0, current + (oldMatch ? 1 : -1)));
      setFormSuccess('');
      setFormError(err.message || 'Failed to update.');
      setEditingTxn(original);
    });
    const result = await resultPromise;
    return result;
  }

  async function handleDelete(id) {
    const original = transactions.find((transaction) => transaction.id === id);
    const filters = { type: filterType, category: filterCategory, month: filterMonth, search };
    if (original) {
      setTransactions((current) => current.filter((transaction) => transaction.id !== id));
      setTotal((current) => Math.max(0, current - 1));
    }
    setDeleteConfirm(null);
    const result = await onDelete(id);
    if (!result.success && original) {
      setTransactions((current) => [original, ...current].slice(0, PAGE_SIZE));
      if (matchesFilters(original, filters)) setTotal((current) => current + 1);
      setFormError(result.errors?.join(', ') || 'Failed to delete.');
    } else if (result.success && page > 1 && total - 1 <= (page - 1) * PAGE_SIZE) {
      setPage(Math.max(1, Math.ceil((total - 1) / PAGE_SIZE)));
    }
  }

  function clearFilters() {
    setSearch('');
    setFilterType('');
    setFilterCategory('');
    setFilterMonth('');
    setPage(1);
  }

  const hasFilters = search || filterType || filterCategory || filterMonth;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Transactions</h1>
        <button
          onClick={() => { setShowForm(true); setEditingTxn(null); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} /> Add
        </button>
      </div>

      {formSuccess && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
          {formSuccess}
        </div>
      )}
      {formError && !showForm && !editingTxn && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{formError}</div>
      )}

      {/* Add Form */}
      {showForm && (
        <div className="card">
          <h2 className="section-title mb-4">New Transaction</h2>
          {formError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{formError}</div>
          )}
          <TransactionForm
            categories={categories}
            onSubmit={handleAdd}
            onCancel={() => { setShowForm(false); setFormError(''); }}
          />
        </div>
      )}

      {/* Edit Form */}
      {editingTxn && (
        <div className="card">
          <h2 className="section-title mb-4">Edit Transaction</h2>
          {formError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{formError}</div>
          )}
          <TransactionForm
            categories={categories}
            initial={editingTxn}
            onSubmit={handleUpdate}
            onCancel={() => { setEditingTxn(null); setFormError(''); }}
          />
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="input-field pl-9"
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select className="select-field w-full sm:w-40" value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}>
            {ALL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="select-field w-full sm:w-36" value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}>
            <option value="">All Categories</option>
            {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="select-field w-full sm:w-36" value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setPage(1); }}>
            <option value="">All Months</option>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="btn-ghost flex items-center gap-1 whitespace-nowrap">
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Transaction List */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-600">
            {total} transaction{total !== 1 ? 's' : ''} found
          </p>
        </div>
        {loadError ? (
          <div className="py-16 text-center">
            <p className="text-red-500 text-sm">{loadError}</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-400 text-sm">{loading ? 'Loading transactions...' : 'No transactions found.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {transactions.map((txn) => (
              <div key={txn.id} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge ${getTypeBadgeClass(txn.type)}`}>
                      {getTypeLabel(txn.type)}
                    </span>
                    <span className="text-sm font-semibold text-slate-800 truncate">
                      {txn.description || txn.category || '—'}
                    </span>
                    {txn.person && (
                      <span className="text-xs text-slate-400">· {txn.person}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span>{formatDate(txn.date)}</span>
                    {txn.category && <span>{txn.category}</span>}
                    {txn.paymentMethod && <span>{txn.paymentMethod}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-base font-bold ${
                    ['income', 'borrowed', 'lent_returned'].includes(txn.type)
                      ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {['income', 'borrowed', 'lent_returned'].includes(txn.type) ? '+' : '−'}
                    {formatCurrency(txn.amount)}
                  </span>
                  <button
                    onClick={() => { setEditingTxn(txn); setShowForm(false); }}
                    className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(txn.id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1 || loading}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((current) => current + 1)}
              disabled={page >= Math.ceil(total / PAGE_SIZE) || loading}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Transaction?</h3>
            <p className="text-sm text-slate-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger flex-1">
                Delete
              </button>
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
