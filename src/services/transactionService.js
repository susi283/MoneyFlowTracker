import { supabase } from '../lib/supabase';
import {
  calculateBalance,
  getCategoryBreakdown,
  getMonthlyReport,
  getSummary,
} from '../utils/finance';
import { getLentBorrowedLedger, validateLedgerChange } from '../utils/ledger';
import { fetchAllPages } from '../utils/pagination';

const PERSON_TYPES = ['lent', 'borrowed', 'lent_returned', 'borrowed_repaid'];
const TRANSACTION_TYPES = ['income', 'expense', ...PERSON_TYPES];
const TRANSACTION_COLUMNS = 'id, type, amount, category, description, person, transaction_date, payment_method, status, created_at, updated_at, related_transaction_id';
const pendingQueries = new Map();
const METRICS_PAGE_SIZE = 1000;

function dedupeRequest(key, request) {
  if (pendingQueries.has(key)) return pendingQueries.get(key);
  const promise = Promise.resolve()
    .then(request)
    .finally(() => {
      if (pendingQueries.get(key) === promise) pendingQueries.delete(key);
    });
  pendingQueries.set(key, promise);
  return promise;
}

function invalidateRequest(key) {
  pendingQueries.delete(key);
}

function invalidateUserQueries(userId) {
  for (const key of pendingQueries.keys()) {
    if (key.startsWith(`reports:${userId}:`) || key.startsWith(`history:${userId}:`)) {
      pendingQueries.delete(key);
    }
  }
}

function getMonthEnd(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

function validateTransaction(data) {
  const errors = [];
  if (!data || typeof data !== 'object') {
    return ['Transaction details are required'];
  }
  if (!TRANSACTION_TYPES.includes(data.type)) errors.push('A valid transaction type is required');
  const amount = Number(data.amount);
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(cents)
    || amount <= 0 || cents <= 0 || Math.abs(amount * 100 - cents) >= 1e-7) {
    errors.push('A valid positive amount is required');
  }
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(data.date || '')
    ? Date.parse(`${data.date}T00:00:00Z`)
    : NaN;
  if (!Number.isFinite(parsedDate) || new Date(parsedDate).toISOString().slice(0, 10) !== data.date) {
    errors.push('A valid date is required');
  }
  if (PERSON_TYPES.includes(data.type) && (typeof data.person !== 'string' || !data.person.trim())) {
    errors.push('Person name is required for this transaction type');
  }
  return errors;
}

function ledgerGroup(type) {
  if (type === 'lent' || type === 'lent_returned') return 'lent';
  if (type === 'borrowed' || type === 'borrowed_repaid') return 'borrowed';
  return null;
}

async function validateLedgerBalance(userId, data, excludeId) {
  const relevantTypes = ['lent', 'lent_returned', 'borrowed', 'borrowed_repaid'];
  const rows = await fetchAllPages((offset, pageSize) => supabase
    .from('transactions')
    .select('id, type, amount, person')
    .eq('user_id', userId)
    .in('type', relevantTypes)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(offset, offset + pageSize - 1), METRICS_PAGE_SIZE);
  return validateLedgerChange(rows, data, excludeId);
}

async function getAllMetricRows(userId) {
  return fetchAllPages((offset, pageSize) => supabase
      .from('transactions')
      .select('id, type, amount, person, category, transaction_date')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1), METRICS_PAGE_SIZE);
}

function fromDb(row) {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    category: row.category || 'Other',
    description: row.description || '',
    person: row.person || '',
    date: row.transaction_date,
    paymentMethod: row.payment_method || 'Cash',
    status: row.status || 'completed',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    relatedTransactionId: row.related_transaction_id || null,
  };
}

function toDb(data, userId) {
  return {
    user_id: userId,
    type: data.type,
    amount: Number(data.amount),
    category: data.category || 'Other',
    description: data.description?.trim() || '',
    person: data.person?.trim() || '',
    payment_method: data.paymentMethod || 'Cash',
    status: data.status || 'completed',
    transaction_date: data.date,
    related_transaction_id: data.relatedTransactionId || null,
  };
}

export const transactionService = {
  getDashboardData(userId) {
    return dedupeRequest(`dashboard:${userId}`, async () => {
    const [metricRows, recentResult] = await Promise.all([
      getAllMetricRows(userId),
      supabase
        .from('transactions')
        .select(TRANSACTION_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (recentResult.error) throw recentResult.error;

    const metricsRows = metricRows.map((row) => ({
      id: row.id,
      type: row.type,
      amount: Number(row.amount),
      person: row.person || '',
      category: row.category || 'Other',
      date: row.transaction_date,
    }));

    return {
      metricsRows,
      transactions: (recentResult.data || []).map(fromDb),
    };
    });
  },

  getMonthlyReports(userId, month, previousMonth) {
    return dedupeRequest(`reports:${userId}:${month}:${previousMonth}`, async () => {
    const fetchMonth = (selectedMonth) => {
      const start = `${selectedMonth}-01`;
      return fetchAllPages((offset, pageSize) => supabase
        .from('transactions')
        .select('type, amount, category')
        .eq('user_id', userId)
        .gte('transaction_date', start)
        .lte('transaction_date', getMonthEnd(selectedMonth))
        .order('transaction_date', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1), METRICS_PAGE_SIZE);
    };

    const [currentRows, previousRows] = await Promise.all([
      fetchMonth(month),
      fetchMonth(previousMonth),
    ]);

    const buildReport = (rows) => {
      const transactions = (rows || []).map((row) => ({
        type: row.type,
        amount: Number(row.amount),
        category: row.category || 'Other',
      }));
      return {
        ...this.getSummary(transactions),
        categoryBreakdown: this.getCategoryBreakdown(transactions, null),
        transactionCount: transactions.length,
      };
    };

    return {
      report: buildReport(currentRows),
      previousReport: buildReport(previousRows),
    };
    });
  },

  getHistoryPage(userId, { page, pageSize, type, types, category, month, search }) {
    const requestKey = `history:${userId}:${page}:${pageSize}:${type}:${JSON.stringify(types || [])}:${category}:${month}:${search}`;
    return dedupeRequest(requestKey, async () => {
    const startIndex = (page - 1) * pageSize;
    let query = supabase
      .from('transactions')
      .select('id, type, amount, category, description, person, transaction_date, payment_method, status, created_at, updated_at, related_transaction_id', { count: 'exact' })
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (types?.length) query = query.in('type', types);
    else if (type) query = query.eq('type', type);
    if (category) query = query.eq('category', category);
    if (month) {
      const start = `${month}-01`;
      query = query.gte('transaction_date', start).lte('transaction_date', getMonthEnd(month));
    }
    if (search) {
      const safeSearch = search.replace(/[^a-zA-Z0-9 .@+-]/g, '').trim();
      if (safeSearch) {
        const pattern = `*${safeSearch}*`;
        const searchFilters = [
          `description.ilike.${pattern}`,
          `person.ilike.${pattern}`,
          `category.ilike.${pattern}`,
        ];
        if (Number.isFinite(Number(safeSearch))) {
          searchFilters.push(`amount.eq.${Number(safeSearch)}`);
        }
        query = query.or(searchFilters.join(','));
      } else {
        return { transactions: [], total: 0 };
      }
    }

    const { data, error, count } = await query.range(startIndex, startIndex + pageSize - 1);
    if (error) throw error;
    return {
      transactions: (data || []).map(fromDb),
      total: count || 0,
    };
    });
  },

  async add(userId, data) {
    invalidateRequest(`dashboard:${userId}`);
    const errors = validateTransaction(data);
    if (errors.length) return { success: false, errors };

    try {
      if (ledgerGroup(data.type)) {
        const ledgerValidation = await validateLedgerBalance(userId, data);
        if (!ledgerValidation.success) return ledgerValidation;
      }
      const { data: row, error } = await supabase
        .from('transactions')
        .insert(toDb(data, userId))
        .select(TRANSACTION_COLUMNS)
        .single();

      if (error) throw error;
      invalidateUserQueries(userId);
      return { success: true, transaction: fromDb(row) };
    } catch (err) {
      console.error('Failed to add transaction:', err);
      return { success: false, errors: ['Could not save the transaction. Check your connection and database permissions.'] };
    }
  },

  async update(userId, id, data) {
    invalidateRequest(`dashboard:${userId}`);
    const errors = validateTransaction(data);
    if (errors.length) return { success: false, errors };

    try {
      const ledgerValidation = await validateLedgerBalance(userId, data, id);
      if (!ledgerValidation.success) return ledgerValidation;
      const { data: row, error } = await supabase
        .from('transactions')
        .update(toDb(data, userId))
        .eq('id', id)
        .eq('user_id', userId)
        .select(TRANSACTION_COLUMNS)
        .single();

      if (error) throw error;
      invalidateUserQueries(userId);
      return { success: true, transaction: fromDb(row) };
    } catch (err) {
      console.error('Failed to update transaction:', err);
      return { success: false, errors: ['Could not update the transaction. Check your connection and database permissions.'] };
    }
  },

  async delete(userId, id) {
    invalidateRequest(`dashboard:${userId}`);
    try {
      const ledgerValidation = await validateLedgerBalance(userId, null, id);
      if (!ledgerValidation.success) return ledgerValidation;
      const { data: deleted, error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!deleted) return { success: false, errors: ['Transaction was not found or is no longer accessible.'] };
      invalidateUserQueries(userId);
      return { success: true };
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      return { success: false, errors: ['Could not delete the transaction. Check your connection and database permissions.'] };
    }
  },

  async clearAll(userId) {
    invalidateRequest(`dashboard:${userId}`);
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
    invalidateUserQueries(userId);
    return { success: true };
  },

  calculateBalance(transactions) {
    return calculateBalance(transactions);
  },

  getSummary(transactions) {
    return getSummary(transactions);
  },

  getLentBorrowedLedger(transactions) {
    return getLentBorrowedLedger(transactions);
  },

  getCategoryBreakdown(transactions, month) {
    return getCategoryBreakdown(transactions, month);
  },

  getMonthlyReport(transactions, month) {
    return getMonthlyReport(transactions, month);
  },
};
