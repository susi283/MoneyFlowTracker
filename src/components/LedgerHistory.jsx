import React, { useEffect, useState } from 'react';
import { transactionService } from '../services/transactionService';
import { TransactionRow } from './RecentTransactions';

const PAGE_SIZE = 20;

export default function LedgerHistory({ userId, types, revision, title }) {
  const [page, setPage] = useState(1);
  const [historyState, setHistoryState] = useState({
    key: '',
    rows: [],
    total: 0,
    loading: true,
    error: '',
  });
  const requestKey = JSON.stringify([userId, types, page, revision, title]);
  const currentHistory = historyState.key === requestKey ? historyState : null;
  const rows = currentHistory?.rows || [];
  const total = currentHistory?.total || 0;
  const loading = !currentHistory || currentHistory.loading;
  const error = currentHistory?.error || '';

  useEffect(() => {
    let active = true;
    transactionService.getHistoryPage(userId, { page, pageSize: PAGE_SIZE, types })
      .then((result) => {
        if (!active) return;
        setHistoryState({
          key: requestKey,
          rows: result.transactions,
          total: result.total,
          loading: false,
          error: '',
        });
      })
      .catch((err) => {
        console.error(`Failed to load ${title.toLowerCase()}:`, err);
        if (active) {
          setHistoryState({
            key: requestKey,
            rows: [],
            total: 0,
            loading: false,
            error: `Unable to load ${title.toLowerCase()}.`,
          });
        }
      });

    return () => { active = false; };
  }, [page, revision, title, types, userId, requestKey]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-2">
        <h2 className="section-title">{title}</h2>
        <span className="text-xs text-slate-400">{total} transaction{total === 1 ? '' : 's'}</span>
      </div>
      {error ? (
        <p className="py-6 text-center text-sm text-red-500">{error}</p>
      ) : loading && rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading history...</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No transactions yet.</p>
      ) : (
        <div>
          {rows.map((transaction) => (
            <TransactionRow key={transaction.id} txn={transaction} />
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-400">Page {page} of {pageCount}</span>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={page >= pageCount || loading}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
