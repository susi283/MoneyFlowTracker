import { supabase } from '../lib/supabase';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from '../data/seedData';

const pendingCategoryQueries = new Map();

export const categoryService = {
  getAll(userId) {
    if (pendingCategoryQueries.has(userId)) return pendingCategoryQueries.get(userId);
    const request = (async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('name, kind')
      .eq('user_id', userId)
      .order('name');

    if (error) throw error;

    const customExpense = (data || []).filter((c) => c.kind === 'expense').map((c) => c.name);
    const customIncome = (data || []).filter((c) => c.kind === 'income').map((c) => c.name);

    return {
      expense: [...new Set([...DEFAULT_EXPENSE_CATEGORIES, ...customExpense])],
      income: [...new Set([...DEFAULT_INCOME_CATEGORIES, ...customIncome])],
    };
    })().finally(() => {
      if (pendingCategoryQueries.get(userId) === request) pendingCategoryQueries.delete(userId);
    });
    pendingCategoryQueries.set(userId, request);
    return request;
  },

  async addExpenseCategory(name, userId) {
    return this.addCategory(name, 'expense', userId);
  },

  async addIncomeCategory(name, userId) {
    return this.addCategory(name, 'income', userId);
  },

  async addCategory(name, kind, userId) {
    pendingCategoryQueries.delete(userId);
    if (!name?.trim()) return { success: false, error: 'Name is required' };
    try {
      const trimmed = name.trim();
      const { error } = await supabase.from('categories').insert({
        user_id: userId,
        name: trimmed,
        kind,
      });
      if (error) {
        if (error.code === '23505') return { success: false, error: 'Category already exists' };
        throw error;
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to add category.' };
    }
  },

  async removeExpenseCategory(name, userId) {
    return this.removeCategory(name, 'expense', userId);
  },

  async removeIncomeCategory(name, userId) {
    return this.removeCategory(name, 'income', userId);
  },

  async removeCategory(name, kind, userId) {
    pendingCategoryQueries.delete(userId);
    const defaults = kind === 'expense' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;
    if (defaults.includes(name)) {
      return { success: false, error: 'Default categories cannot be removed.' };
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('user_id', userId)
        .eq('name', name)
        .eq('kind', kind);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to remove category.' };
    }
  },
};
