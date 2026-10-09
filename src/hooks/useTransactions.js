import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { transactionService } from '../services/transactionService';

const EMPTY_ROWS = [];

function toMetricsRow(transaction) {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: Number(transaction.amount),
    person: transaction.person || '',
    category: transaction.category || 'Other',
    date: transaction.date,
  };
}

function optimisticTransaction(data, existing = {}) {
  const now = new Date().toISOString();
  return {
    ...existing,
    id: existing.id || `pending-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
    type: data.type,
    amount: Number(data.amount),
    category: data.category || 'Other',
    description: data.description?.trim() || '',
    person: data.person?.trim() || '',
    date: data.date,
    paymentMethod: data.paymentMethod || 'Cash',
    status: data.status || 'completed',
    createdAt: existing.createdAt || now,
    updatedAt: now,
    relatedTransactionId: data.relatedTransactionId || null,
  };
}

function failedResult(result, fallback) {
  return result?.success ? null : result?.errors?.join(', ') || fallback;
}

export function useTransactions(userId) {
  const [transactions, setTransactions] = useState([]);
  const [metricsRows, setMetricsRows] = useState([]);
  const [dataUserId, setDataUserId] = useState(null);
  const [revision, setRevision] = useState(0);
  const transactionsRef = useRef(transactions);
  const metricsRowsRef = useRef(metricsRows);
  const loadedRef = useRef(false);
  const loadedUserIdRef = useRef(null);
  const loadRequestRef = useRef(0);

  useEffect(() => {
    transactionsRef.current = transactions;
    metricsRowsRef.current = metricsRows;
  }, [transactions, metricsRows]);

  const changeTransactions = useCallback((update) => {
    const next = typeof update === 'function' ? update(transactionsRef.current) : update;
    transactionsRef.current = next;
    setTransactions(next);
  }, []);

  const changeMetricsRows = useCallback((update) => {
    const next = typeof update === 'function' ? update(metricsRowsRef.current) : update;
    metricsRowsRef.current = next;
    setMetricsRows(next);
  }, []);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    if (!userId) {
      changeTransactions([]);
      changeMetricsRows([]);
      setDataUserId(null);
      loadedRef.current = false;
      loadedUserIdRef.current = null;
      return;
    }

    try {
      const data = await transactionService.getDashboardData(userId);
      if (requestId !== loadRequestRef.current) return;
      changeTransactions(data.transactions);
      changeMetricsRows(data.metricsRows);
      setDataUserId(userId);
      loadedRef.current = true;
      loadedUserIdRef.current = userId;
    } catch (err) {
      console.error('Failed to load dashboard transactions:', err);
    }
  }, [changeMetricsRows, changeTransactions, userId]);

  useEffect(() => {
    loadedRef.current = false;
    load();
    return () => { loadRequestRef.current += 1; };
  }, [load]);

  const addTransaction = useCallback(async (data) => {
    if (!userId) return { success: false, errors: ['You are not signed in.'] };
    const shouldReload = !loadedRef.current || loadedUserIdRef.current !== userId;
    if (shouldReload) {
      loadRequestRef.current += 1;
      if (loadedUserIdRef.current !== userId) {
        changeTransactions([]);
        changeMetricsRows([]);
      }
      setDataUserId(userId);
    }
    const optimistic = optimisticTransaction(data);
    changeMetricsRows((current) => [toMetricsRow(optimistic), ...current]);
    changeTransactions((current) => [optimistic, ...current].slice(0, 10));

    const result = await transactionService.add(userId, data);
    const error = failedResult(result, 'Failed to add transaction.');
    if (error) {
      changeMetricsRows((current) => current.filter((row) => row.id !== optimistic.id));
      changeTransactions((current) => current.filter((row) => row.id !== optimistic.id));
      if (shouldReload) void load();
      return result;
    }

    changeMetricsRows((current) => current.map((row) => (
      row.id === optimistic.id ? toMetricsRow(result.transaction) : row
    )));
    changeTransactions((current) => current.map((row) => (
      row.id === optimistic.id ? result.transaction : row
    )));
    setDataUserId(userId);
    setRevision((current) => current + 1);
    if (shouldReload) void load();
    return result;
  }, [changeMetricsRows, changeTransactions, load, userId]);

  const updateTransaction = useCallback(async (id, data) => {
    if (!userId) return { success: false, errors: ['You are not signed in.'] };
    const shouldReload = !loadedRef.current || loadedUserIdRef.current !== userId;
    if (shouldReload) loadRequestRef.current += 1;
    const priorMetrics = metricsRowsRef.current.find((row) => row.id === id);
    const priorTransaction = transactionsRef.current.find((row) => row.id === id);
    const optimistic = optimisticTransaction(data, priorTransaction || priorMetrics || { id });

    changeMetricsRows((current) => current.map((row) => (
      row.id === id ? toMetricsRow(optimistic) : row
    )));
    changeTransactions((current) => current.map((row) => (
      row.id === id ? optimistic : row
    )));

    const result = await transactionService.update(userId, id, data);
    const error = failedResult(result, 'Failed to update transaction.');
    if (error) {
      if (priorMetrics) {
        changeMetricsRows((current) => current.map((row) => row.id === id ? priorMetrics : row));
      }
      if (priorTransaction) {
        changeTransactions((current) => current.map((row) => row.id === id ? priorTransaction : row));
      }
      if (shouldReload) await load();
      return result;
    }

    changeMetricsRows((current) => current.map((row) => (
      row.id === id ? toMetricsRow(result.transaction) : row
    )));
    changeTransactions((current) => current.map((row) => (
      row.id === id ? result.transaction : row
    )));
    if (!shouldReload && (priorMetrics || priorTransaction)) setDataUserId(userId);
    setRevision((current) => current + 1);
    if (shouldReload) await load();
    return result;
  }, [changeMetricsRows, changeTransactions, load, userId]);

  const deleteTransaction = useCallback(async (id) => {
    if (!userId) return { success: false, errors: ['You are not signed in.'] };
    const shouldReload = !loadedRef.current || loadedUserIdRef.current !== userId;
    if (shouldReload) loadRequestRef.current += 1;
    const priorMetrics = metricsRowsRef.current.find((row) => row.id === id);
    const priorTransaction = transactionsRef.current.find((row) => row.id === id);
    changeMetricsRows((current) => current.filter((row) => row.id !== id));
    changeTransactions((current) => current.filter((row) => row.id !== id));

    const result = await transactionService.delete(userId, id);
    const error = failedResult(result, 'Failed to delete transaction.');
    if (error) {
      if (priorMetrics) changeMetricsRows((current) => [priorMetrics, ...current]);
      if (priorTransaction) changeTransactions((current) => [priorTransaction, ...current].slice(0, 10));
    } else {
      setRevision((current) => current + 1);
    }
    if (shouldReload) await load();
    return result;
  }, [changeMetricsRows, changeTransactions, load, userId]);

  const resetTransactions = useCallback(async () => {
    if (!userId) throw new Error('You are not signed in.');
    loadRequestRef.current += 1;
    const previousTransactions = transactionsRef.current;
    const previousMetricsRows = metricsRowsRef.current;
    const previousDataUserId = dataUserId;
    const previousLoaded = loadedRef.current;
    const previousLoadedUserId = loadedUserIdRef.current;
    changeTransactions([]);
    changeMetricsRows([]);
    setDataUserId(userId);
    loadedRef.current = true;
    loadedUserIdRef.current = userId;
    setRevision((current) => current + 1);
    try {
      return await transactionService.clearAll(userId);
    } catch (error) {
      changeTransactions(previousTransactions);
      changeMetricsRows(previousMetricsRows);
      setDataUserId(previousDataUserId);
      loadedRef.current = previousLoaded;
      loadedUserIdRef.current = previousLoadedUserId;
      setRevision((current) => current + 1);
      void load();
      throw error;
    }
  }, [changeMetricsRows, changeTransactions, dataUserId, load, userId]);

  const userTransactions = dataUserId === userId ? transactions : EMPTY_ROWS;
  const userMetricsRows = dataUserId === userId ? metricsRows : EMPTY_ROWS;
  const userSummary = useMemo(() => transactionService.getSummary(userMetricsRows), [userMetricsRows]);
  const userLedger = useMemo(() => transactionService.getLentBorrowedLedger(userMetricsRows), [userMetricsRows]);
  const availableMonths = useMemo(() => (
    [...new Set(userMetricsRows.map((row) => row.date?.slice(0, 7)).filter(Boolean))]
      .sort((a, b) => b.localeCompare(a))
  ), [userMetricsRows]);

  return {
    transactions: userTransactions,
    metricsRows: userMetricsRows,
    availableMonths,
    revision,
    summary: userSummary,
    ledger: userLedger,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    resetTransactions,
    reload: load,
  };
}
