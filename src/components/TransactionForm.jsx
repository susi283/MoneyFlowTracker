import React, { useState } from 'react';
import { getTodayStr } from '../utils/helpers';

const TRANSACTION_TYPES = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'lent', label: 'Lent (Given to someone)' },
  { value: 'borrowed', label: 'Borrowed (From someone)' },
  { value: 'lent_returned', label: 'Lent Returned (Received back)' },
  { value: 'borrowed_repaid', label: 'Borrowed Repaid (Paid back)' },
];

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'];

const PERSON_TYPES = ['lent', 'borrowed', 'lent_returned', 'borrowed_repaid'];

export default function TransactionForm({ categories, onSubmit, onCancel, initial }) {
  const [form, setForm] = useState({
    type: initial?.type || 'expense',
    amount: initial?.amount || '',
    category: initial?.category || '',
    description: initial?.description || '',
    person: initial?.person || '',
    date: initial?.date || getTodayStr(),
    paymentMethod: initial?.paymentMethod || 'Cash',
    status: initial?.status || 'completed',
  });
  const [errors, setErrors] = useState([]);

  const needsPerson = PERSON_TYPES.includes(form.type);
  const isIncome = form.type === 'income';
  const expenseCats = categories?.expense || [];
  const incomeCats = categories?.income || [];
  const catList = isIncome ? incomeCats : expenseCats;

  function update(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Reset category when type changes
      if (field === 'type') next.category = '';
      return next;
    });
    setErrors([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors([]);

    const errs = [];
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      errs.push('Please enter a valid positive amount.');
    }
    if (!form.date) errs.push('Date is required.');
    if (needsPerson && !form.person.trim()) {
      errs.push('Person name is required for this transaction type.');
    }
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }

    const result = await onSubmit({
      ...form,
      amount: Number(form.amount),
      category: form.category || 'Other',
    });

    if (result && !result.success && result.errors) {
      setErrors(result.errors);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
          {errors.map((e, i) => (
            <p key={i} className="text-sm text-red-600">{e}</p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Type */}
        <div className="sm:col-span-2">
          <label className="label">Transaction Type</label>
          <select
            className="select-field"
            value={form.type}
            onChange={(e) => update('type', e.target.value)}
          >
            {TRANSACTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="label">Amount (₹)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className="input-field"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => update('amount', e.target.value)}
          />
        </div>

        {/* Date */}
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            className="input-field"
            value={form.date}
            onChange={(e) => update('date', e.target.value)}
            max={getTodayStr()}
          />
        </div>

        {/* Category */}
        <div>
          <label className="label">Category</label>
          <select
            className="select-field"
            value={form.category}
            onChange={(e) => update('category', e.target.value)}
          >
            <option value="">Select category</option>
            {catList.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Payment Method */}
        <div>
          <label className="label">Payment Method</label>
          <select
            className="select-field"
            value={form.paymentMethod}
            onChange={(e) => update('paymentMethod', e.target.value)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Person (conditional) */}
        {needsPerson && (
          <div className="sm:col-span-2">
            <label className="label">
              Person Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Rahul, Priya..."
              value={form.person}
              onChange={(e) => update('person', e.target.value)}
            />
          </div>
        )}

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="label">Description (optional)</label>
          <input
            type="text"
            className="input-field"
            placeholder="Brief note about this transaction..."
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary">
          {initial ? 'Update Transaction' : 'Add Transaction'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
