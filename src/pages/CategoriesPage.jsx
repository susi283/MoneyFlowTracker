import React, { useState } from 'react';
import { categoryService } from '../services/categoryService';
import { Plus, X } from 'lucide-react';

function CategorySection({ title, items, onAdd, onRemove, color }) {
  const [newCat, setNewCat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await onAdd(newCat);
      if (result.success) setNewCat('');
      else setError(result.error || 'Failed to add.');
    } catch (err) {
      console.error('Failed to add category:', err);
      setError('Unable to add the category. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2 className="section-title mb-4">{title}</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {items.map((cat) => (
          <div key={cat} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${color} border`}>
            {cat}
            <button
              onClick={async () => {
                try {
                  const result = await onRemove(cat);
                  if (!result?.success) setError(result?.error || 'Unable to remove the category.');
                } catch (err) {
                  console.error('Failed to remove category:', err);
                  setError('Unable to remove the category. Check your connection and try again.');
                }
              }}
              className="ml-1 hover:opacity-70 transition-opacity"
              title="Remove"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={handleAdd} className="flex gap-2">
        <input className="input-field flex-1" placeholder="Add new category..." value={newCat}
          onChange={(e) => { setNewCat(e.target.value); setError(''); }} maxLength={40} />
        <button type="submit" disabled={busy} className="btn-primary flex items-center gap-1.5">
          <Plus size={16} /> {busy ? 'Adding...' : 'Add'}
        </button>
      </form>
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </div>
  );
}

export default function CategoriesPage({ userId, categories, loadError, onCategoriesChange }) {
  const cats = categories || { expense: [], income: [] };

  function updateCategories(updated) {
    onCategoriesChange?.(updated);
  }

  async function addExpense(name) {
    const result = await categoryService.addExpenseCategory(name, userId);
    if (result.success) {
      updateCategories({ ...cats, expense: [...new Set([...cats.expense, name.trim()])] });
    }
    return result;
  }

  async function addIncome(name) {
    const result = await categoryService.addIncomeCategory(name, userId);
    if (result.success) {
      updateCategories({ ...cats, income: [...new Set([...cats.income, name.trim()])] });
    }
    return result;
  }

  async function removeExpense(name) {
    const result = await categoryService.removeExpenseCategory(name, userId);
    if (result.success) updateCategories({ ...cats, expense: cats.expense.filter((category) => category !== name) });
    return result;
  }

  async function removeIncome(name) {
    const result = await categoryService.removeIncomeCategory(name, userId);
    if (result.success) updateCategories({ ...cats, income: cats.income.filter((category) => category !== name) });
    return result;
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title">Categories</h1>
      {loadError && <p role="alert" className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">{loadError}</p>}
      <CategorySection title="Expense Categories" items={cats.expense || []} onAdd={addExpense} onRemove={removeExpense} color="bg-red-50 text-red-700 border-red-200" />
      <CategorySection title="Income Categories" items={cats.income || []} onAdd={addIncome} onRemove={removeIncome} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
    </div>
  );
}
