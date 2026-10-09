import React, { useState } from 'react';
import { formatCurrency, getTodayStr } from '../utils/helpers';
import { CheckCircle2, Plus } from 'lucide-react';

function StatusBadge({ status }) {
  const map = {
    pending: 'bg-yellow-100 text-yellow-700',
    partial: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`badge ${map[status] || 'bg-gray-100 text-gray-700'}`}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : ''}
    </span>
  );
}

// Card for "Money I Should Receive" (lent entries)
function LentPersonCard({ item, onMarkComplete, onRecordPartial, busy }) {
  const { person, lent, returned, remaining } = item;
  const status = remaining <= 0 ? 'completed' : returned > 0 ? 'partial' : 'pending';
  const isCompleted = status === 'completed';

  return (
    <div className={`border-l-4 ${isCompleted ? 'border-green-400' : 'border-orange-400'} bg-white rounded-xl p-4 shadow-sm`}>
      <div className="flex items-start justify-between mb-2 gap-2">
        <div>
          <p className="font-bold text-slate-800 text-base">{person}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm mt-3 mb-4">
        <div>
          <p className="text-xs text-slate-400 font-medium">Given</p>
          <p className="font-bold text-slate-700">{formatCurrency(lent)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 font-medium">Returned</p>
          <p className="font-bold text-slate-700">{formatCurrency(returned)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 font-medium">Remaining</p>
          <p className={`font-bold ${remaining > 0 ? 'text-orange-500' : 'text-green-500'}`}>
            {formatCurrency(Math.max(0, remaining))}
          </p>
        </div>
      </div>

      {!isCompleted && (
        <div className="flex gap-2 flex-wrap">
          {/* Mark full amount as returned */}
          <button
            onClick={() => onMarkComplete(person, remaining, 'lent_returned')}
            disabled={busy}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <CheckCircle2 size={14} />
            Mark Fully Returned
          </button>
          {/* Record partial return */}
          <button
            onClick={() => onRecordPartial(person, 'lent_returned')}
            disabled={busy}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Partial Return
          </button>
        </div>
      )}

      {isCompleted && (
        <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
          <CheckCircle2 size={13} /> Fully returned
        </p>
      )}
    </div>
  );
}

// Card for "Money I Owe" (borrowed entries)
function BorrowedPersonCard({ item, onMarkComplete, onRecordPartial, busy }) {
  const { person, borrowed, repaid, remaining } = item;
  const status = remaining <= 0 ? 'completed' : repaid > 0 ? 'partial' : 'pending';
  const isCompleted = status === 'completed';

  return (
    <div className={`border-l-4 ${isCompleted ? 'border-green-400' : 'border-blue-400'} bg-white rounded-xl p-4 shadow-sm`}>
      <div className="flex items-start justify-between mb-2 gap-2">
        <div>
          <p className="font-bold text-slate-800 text-base">{person}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm mt-3 mb-4">
        <div>
          <p className="text-xs text-slate-400 font-medium">Borrowed</p>
          <p className="font-bold text-slate-700">{formatCurrency(borrowed)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 font-medium">Repaid</p>
          <p className="font-bold text-slate-700">{formatCurrency(repaid)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 font-medium">Remaining</p>
          <p className={`font-bold ${remaining > 0 ? 'text-red-500' : 'text-green-500'}`}>
            {formatCurrency(Math.max(0, remaining))}
          </p>
        </div>
      </div>

      {!isCompleted && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => onMarkComplete(person, remaining, 'borrowed_repaid')}
            disabled={busy}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <CheckCircle2 size={14} />
            Mark Fully Repaid
          </button>
          <button
            onClick={() => onRecordPartial(person, 'borrowed_repaid')}
            disabled={busy}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Partial Repayment
          </button>
        </div>
      )}

      {isCompleted && (
        <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
          <CheckCircle2 size={13} /> Fully repaid
        </p>
      )}
    </div>
  );
}

// Partial amount input modal
function PartialModal({ person, type, remaining, onConfirm, onClose, busy }) {
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState('');

  function handle(e) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || Math.round(n * 100) <= 0) {
      setErr('Enter a valid positive amount.');
      return;
    }
    if (Math.round(n * 100) > Math.round(remaining * 100)) {
      setErr(`Amount cannot exceed the remaining ${formatCurrency(remaining)}.`);
      return;
    }
    onConfirm(person, n, type);
  }

  const label = type === 'lent_returned' ? 'amount returned by' : 'amount repaid to';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
        <h3 className="text-lg font-bold text-slate-800 mb-1">Record Partial Amount</h3>
        <p className="text-sm text-slate-500 mb-4">
          Enter the {label} <strong>{person}</strong>:
        </p>
        <form onSubmit={handle} className="space-y-3">
          <div>
            <label className="label">Amount (₹)</label>
            <input
              type="number"
              min="0.01"
              max={remaining}
              step="0.01"
              className="input-field"
              placeholder="e.g. 500"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setErr(''); }}
              autoFocus
            />
            {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={busy} className="btn-primary flex-1 disabled:opacity-50">Confirm</button>
            <button type="button" onClick={onClose} disabled={busy} className="btn-secondary flex-1">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LentBorrowedWidget({ ledger, onAddTransaction, compact = false }) {
  const { toReceive = [], toPay = [] } = ledger || {};
  const hasData = toReceive.length > 0 || toPay.length > 0;
  const [partialModal, setPartialModal] = useState(null); // { person, type }
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);
  const [pendingAction, setPendingAction] = useState('');

  function showToast(msg, isError = false) {
    setToast(msg);
    setToastError(isError);
    setTimeout(() => setToast(''), 3000);
  }

  async function recordAmount(person, amount, type, description) {
    if (!onAddTransaction) return { success: false, errors: ['Unable to record this payment.'] };
    return onAddTransaction({
      type,
      amount,
      category: 'Other',
      description,
      person,
      date: getTodayStr(),
      paymentMethod: 'Cash',
      status: 'completed',
    });
  }

  async function handleMarkComplete(person, amount, type) {
    if (amount <= 0 || pendingAction) return;
    const key = `${type}:${person.toLowerCase()}`;
    setPendingAction(key);
    try {
      const result = await recordAmount(
        person,
        amount,
        type,
        type === 'lent_returned'
          ? `${person} returned full amount`
          : `Repaid full amount to ${person}`,
      );
      if (!result?.success) {
        showToast(result?.errors?.join(', ') || 'Unable to record the payment.', true);
        return;
      }
      showToast(type === 'lent_returned'
        ? `Marked ${person}'s full return as recorded.`
        : `Full repayment to ${person} recorded.`
      );
    } catch (error) {
      console.error('Failed to record completed lent/borrowed payment:', error);
      showToast(error.message || 'Unable to record the payment.', true);
    } finally {
      setPendingAction('');
    }
  }

  function handleRecordPartial(person, type) {
    const items = type === 'lent_returned' ? toReceive : toPay;
    const item = items.find((entry) => entry.person.toLowerCase() === person.toLowerCase());
    if (item?.remaining > 0) setPartialModal({ person, type, remaining: item.remaining });
  }

  async function handlePartialConfirm(person, amount, type) {
    const items = type === 'lent_returned' ? toReceive : toPay;
    const item = items.find((entry) => entry.person.toLowerCase() === person.toLowerCase());
    if (!item || amount <= 0 || amount > item.remaining || pendingAction) return;
    const key = `${type}:${person.toLowerCase()}`;
    setPendingAction(key);
    try {
      const result = await recordAmount(
        person,
        amount,
        type,
        type === 'lent_returned'
          ? `${person} returned ₹${amount}`
          : `Repaid ₹${amount} to ${person}`,
      );
      if (!result?.success) {
        showToast(result?.errors?.join(', ') || 'Unable to record the payment.', true);
        return;
      }
      setPartialModal(null);
      showToast(`₹${amount} recorded for ${person}`);
    } catch (error) {
      console.error('Failed to record partial lent/borrowed payment:', error);
      showToast(error.message || 'Unable to record the payment.', true);
    } finally {
      setPendingAction('');
    }
  }

  if (!hasData) {
    return (
      <div className="card">
        <h2 className="section-title mb-3">Lent &amp; Borrowed</h2>
        <p className="text-slate-400 text-sm text-center py-6">No active lent or borrowed transactions.</p>
      </div>
    );
  }

  return (
    <div className="card">
      {!compact && <h2 className="section-title mb-4">Lent &amp; Borrowed</h2>}

      {toast && (
        <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${
          toastError ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'
        }`}>
          {toast}
        </div>
      )}

      {toReceive.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
            💰 Money I Should Receive
          </h3>
          <div className="space-y-3">
            {toReceive.map((item) => (
              <LentPersonCard
                key={item.person}
                item={item}
                onMarkComplete={handleMarkComplete}
                onRecordPartial={handleRecordPartial}
                busy={Boolean(pendingAction)}
              />
            ))}
          </div>
        </div>
      )}

      {toPay.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
            💸 Money I Owe
          </h3>
          <div className="space-y-3">
            {toPay.map((item) => (
              <BorrowedPersonCard
                key={item.person}
                item={item}
                onMarkComplete={handleMarkComplete}
                onRecordPartial={handleRecordPartial}
                busy={Boolean(pendingAction)}
              />
            ))}
          </div>
        </div>
      )}

      {partialModal && (
        <PartialModal
          person={partialModal.person}
          type={partialModal.type}
          remaining={partialModal.remaining}
          onConfirm={handlePartialConfirm}
          onClose={() => setPartialModal(null)}
          busy={Boolean(pendingAction)}
        />
      )}
    </div>
  );
}
