import React, { useEffect, useState } from 'react';
import { Plus, Search, X, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate, getTypeLabel, getTypeBadgeClass } from '../utils/helpers';
import TransactionForm from '../components/TransactionForm';
import { transactionService } from '../services/transactionService';

const PAGE_SIZE = 20;

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
  const [historyState, setHistoryState] = useState({
    key: '',
    transactions: [],
    total: 0,
    loading: true,
    error: '',
  });
  const [page, setPage] = useState(1);
  const requestKey = JSON.stringify([
    userId, page, filterType, filterCategory, filterMonth, search, revision,
  ]);
  const currentHistory = historyState.key === requestKey ? historyState : null;
  const transactions = currentHistory?.transactions || [];
  const total = currentHistory?.total || 0;
  const loading = !currentHistory || currentHistory.loading;
  const loadError = currentHistory?.error || '';
  const months = availableMonths;
  const allCats = [...new Set([
    ...(categories?.expense || []),
    ...(categories?.income || []),
    ...transactions.map((transaction) => transaction.category).filter(Boolean),
  ])].sort();

  useEffect(() => {
    let active = true;
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
        setHistoryState({
          key: requestKey,
          transactions: result.transactions,
          total: result.total,
          loading: false,
          error: '',
        });
      }).catch((err) => {
        console.error('Failed to load transaction history:', err);
        if (active) {
          setHistoryState({
            key: requestKey,
            transactions: [],
            total: 0,
            loading: false,
            error: 'Unable to load transactions.',
          });
        }
      });
    }, search ? 250 : 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [userId, page, filterType, filterCategory, filterMonth, search, revision, requestKey]);

  async function handleAdd(data) {
    setFormError('');
    try {
      const result = await onAdd(data);
      if (result.success) {
        setShowForm(false);
        setFormSuccess('Transaction added!');
        setTimeout(() => setFormSuccess(''), 3000);
      } else {
        setFormError(result.errors?.join(', ') || 'Failed to add.');
      }
      return result;
    } catch (err) {
      setFormError(err.message || 'Failed to add.');
      return { success: false, errors: [err.message || 'Failed to add.'] };
    }
  }

  async function handleUpdate(data) {
    setFormError('');
    const original = editingTxn;
    try {
      const result = await onUpdate(original.id, data);
      if (result.success) {
        setEditingTxn(null);
        setFormSuccess('Transaction updated!');
        setTimeout(() => setFormSuccess(''), 3000);
      } else {
        setFormError(result.errors?.join(', ') || 'Failed to update.');
      }
      return result;
    } catch (err) {
      setFormError(err.message || 'Failed to update.');
      return { success: false, errors: [err.message || 'Failed to update.'] };
    }
  }

  async function handleDelete(id) {
    setDeleteConfirm(null);
    setFormError('');
    try {
      const result = await onDelete(id);
      if (!result.success) setFormError(result.errors?.join(', ') || 'Failed to delete.');
      else if (page > 1 && total - 1 <= (page - 1) * PAGE_SIZE) {
        setPage(Math.max(1, Math.ceil((total - 1) / PAGE_SIZE)));
      }
    } catch (err) {
      setFormError(err.message || 'Failed to delete.');
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
