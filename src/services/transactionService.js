import { supabase } from '../lib/supabase';
import { getTransactionCashImpactCents } from '../utils/helpers';
import { findNegativeLentBorrowedBalance, getLentBorrowedLedger } from '../utils/ledger';

const PERSON_TYPES = ['lent', 'borrowed', 'lent_returned', 'borrowed_repaid'];
const TRANSACTION_COLUMNS = 'id, type, amount, category, description, person, transaction_date, payment_method, status, created_at, updated_at, related_transaction_id';
const pendingQueries = new Map();

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

function toCents(amount) {
  return Math.round((Number(amount) || 0) * 100);
}

function fromCents(amount) {
  return amount / 100;
}

function validateTransaction(data) {
  const errors = [];
  if (!data.type) errors.push('Transaction type is required');
  if (!data.amount || isNaN(Number(data.amount)) || Number(data.amount) <= 0) {
    errors.push('A valid positive amount is required');
  }
  if (!data.date) errors.push('Date is required');
  if (PERSON_TYPES.includes(data.type) && !data.person?.trim()) {
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
  const { data: rows, error } = await supabase
    .from('transactions')
    .select('id, type, amount, person')
    .eq('user_id', userId)
    .in('type', relevantTypes);
  if (error) throw error;

  const existing = (rows || []).find((row) => row.id === excludeId);
  const candidateTransactions = (rows || []).filter((row) => row.id !== excludeId);
  candidateTransactions.push(data);
  const affected = new Map();
  if (ledgerGroup(data.type) && data.person?.trim()) {
    affected.set(
      `${ledgerGroup(data.type)}:${data.person.trim().toLocaleLowerCase()}`,
      { group: ledgerGroup(data.type), person: data.person },
    );
  }
  if (existing) {
    const group = ledgerGroup(existing.type);
    if (group && existing.person?.trim()) {
      affected.set(`${group}:${existing.person.trim().toLocaleLowerCase()}`, {
        group,
        person: existing.person,
      });
    }
  }

  const negativeBalance = findNegativeLentBorrowedBalance(candidateTransactions, [...affected.values()]);
  if (negativeBalance) {
    return {
      success: false,
      errors: [`This change exceeds ${negativeBalance.person}'s outstanding ${negativeBalance.group} balance.`],
    };
  }
  return { success: true, errors: [] };
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
    const [metricsResult, recentResult] = await Promise.all([
      supabase
      .from('transactions')
      .select('id, type, amount, person, category, transaction_date')
      .eq('user_id', userId),
      supabase
        .from('transactions')
        .select(TRANSACTION_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (metricsResult.error) throw metricsResult.error;
    if (recentResult.error) throw recentResult.error;

    const metricsRows = (metricsResult.data || []).map((row) => ({
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
      return supabase
        .from('transactions')
        .select('type, amount, category')
        .eq('user_id', userId)
        .gte('transaction_date', start)
        .lte('transaction_date', getMonthEnd(selectedMonth));
    };

    const [currentResult, previousResult] = await Promise.all([
      fetchMonth(month),
      fetchMonth(previousMonth),
    ]);
    if (currentResult.error) throw currentResult.error;
    if (previousResult.error) throw previousResult.error;

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
      report: buildReport(currentResult.data),
      previousReport: buildReport(previousResult.data),
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
      return { success: false, errors: [err.message || 'Failed to add transaction.'] };
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
      return { success: false, errors: [err.message || 'Failed to update transaction.'] };
    }
  },

  async delete(userId, id) {
    invalidateRequest(`dashboard:${userId}`);
    try {
      const ledgerValidation = await validateLedgerBalance(userId, { type: '', amount: 0, person: '' }, id);
      if (!ledgerValidation.success) return ledgerValidation;
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      invalidateUserQueries(userId);
      return { success: true };
    } catch (err) {
      return { success: false, errors: [err.message || 'Failed to delete transaction.'] };
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
    if (!Array.isArray(transactions)) return 0;
    const balanceCents = transactions.reduce((sum, t) => {
      return sum + getTransactionCashImpactCents(t);
    }, 0);
    return fromCents(balanceCents);
  },

  getSummary(transactions) {
    if (!Array.isArray(transactions)) {
      return { balance: 0, totalIncome: 0, totalExpenses: 0, netLent: 0 };
    }

    let totalIncome = 0;
    let totalExpenses = 0;
    let totalLent = 0;
    let totalLentReturned = 0;
    let totalBorrowed = 0;
    let totalBorrowedRepaid = 0;
    let balance = 0;

    transactions.forEach((t) => {
      const amt = toCents(t.amount);
      balance += getTransactionCashImpactCents(t);
      switch (t.type) {
        case 'income': totalIncome += amt; break;
        case 'expense': totalExpenses += amt; break;
        case 'lent': totalLent += amt; break;
        case 'lent_returned': totalLentReturned += amt; break;
        case 'borrowed': totalBorrowed += amt; break;
        case 'borrowed_repaid': totalBorrowedRepaid += amt; break;
      }
    });

    return {
      balance: fromCents(balance),
      totalIncome: fromCents(totalIncome),
      totalExpenses: fromCents(totalExpenses),
      netLent: fromCents(Math.max(0, totalLent - totalLentReturned)),
      totalLent: fromCents(totalLent),
      totalLentReturned: fromCents(totalLentReturned),
      totalBorrowed: fromCents(totalBorrowed),
      totalBorrowedRepaid: fromCents(totalBorrowedRepaid),
    };
  },

  getLentBorrowedLedger(transactions) {
    return getLentBorrowedLedger(transactions);
  },

  getCategoryBreakdown(transactions, month) {
    const filtered = month
      ? transactions.filter((t) => t.date && t.date.startsWith(month))
      : transactions;

    const map = {};
    filtered.filter((t) => t.type === 'expense').forEach((t) => {
      const cat = t.category || 'Other';
      map[cat] = (map[cat] || 0) + (Number(t.amount) || 0);
    });

    return Object.entries(map)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  },

  getMonthlyReport(transactions, month) {
    const filtered = transactions.filter((t) => t.date && t.date.startsWith(month));
    return {
      ...this.getSummary(filtered),
      categoryBreakdown: this.getCategoryBreakdown(filtered, null),
      transactionCount: filtered.length,
    };
  },
};
