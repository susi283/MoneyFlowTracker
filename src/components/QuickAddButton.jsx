import React, { memo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import TransactionForm from './TransactionForm';

function QuickAddButton({ onAdd, categories }) {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(data) {
    setError('');
    const result = await onAdd(data);
    if (result?.success) {
      setSuccess('Transaction added!');
      setTimeout(() => {
        setSuccess('');
        setOpen(false);
      }, 1500);
    } else {
      setError(result?.errors?.join(', ') || 'Failed to add.');
    }
    return result;
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        id="quick-add-btn"
        onClick={() => { setOpen(true); setSuccess(''); setError(''); }}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
        title="Quick Add Transaction"
        aria-label="Quick add transaction"
      >
        <Plus size={26} />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl sm:rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Add Transaction</h2>
                <p className="text-xs text-slate-400 mt-0.5">Quick manual entry</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5">
              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-semibold text-center">
                  ✅ {success}
                </div>
              )}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  {error}
                </div>
              )}
              {!success && (
                <TransactionForm
                  categories={categories}
                  onSubmit={handleSubmit}
                  onCancel={() => setOpen(false)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(QuickAddButton);
