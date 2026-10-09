import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { transactionService } from '../services/transactionService';

const EMPTY_ROWS = [];

export function useTransactions(userId) {
  const [transactions, setTransactions] = useState([]);
  const [metricsRows, setMetricsRows] = useState([]);
  const [dataUserId, setDataUserId] = useState(null);
  const [revision, setRevision] = useState(0);
  const [loadErrorState, setLoadErrorState] = useState({ userId: null, message: '' });
  const requestRef = useRef(0);
  const scopeRef = useRef({ userId: null, version: 0 });

  useLayoutEffect(() => {
    if (scopeRef.current.userId !== userId) {
      scopeRef.current = { userId, version: scopeRef.current.version + 1 };
    }
  }, [userId]);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!userId) return;
    const version = scopeRef.current.version;

    try {
      const data = await transactionService.getDashboardData(userId);
      if (requestId !== requestRef.current || scopeRef.current.version !== version) return;
      setTransactions(data.transactions);
      setMetricsRows(data.metricsRows);
      setDataUserId(userId);
      setLoadErrorState({ userId, message: '' });
    } catch (err) {
      console.error('Failed to load dashboard transactions:', err);
      if (requestId === requestRef.current && scopeRef.current.version === version) {
        setTransactions([]);
        setMetricsRows([]);
        setDataUserId(userId);
        setLoadErrorState({
          userId,
          message: 'Unable to load transactions. Check your connection and database permissions.',
        });
      }
    }
  }, [userId]);

  useEffect(() => {
    Promise.resolve().then(load);
    return () => { requestRef.current += 1; };
  }, [load]);

  const addTransaction = useCallback(async (data) => {
    if (!userId) return { success: false, errors: ['You are not signed in.'] };
    const version = scopeRef.current.version;
    const result = await transactionService.add(userId, data);
    if (version !== scopeRef.current.version || !result.success) return result;
    await load();
    if (version === scopeRef.current.version) setRevision((current) => current + 1);
    return result;
  }, [load, userId]);

  const updateTransaction = useCallback(async (id, data) => {
    if (!userId) return { success: false, errors: ['You are not signed in.'] };
    const version = scopeRef.current.version;
    const result = await transactionService.update(userId, id, data);
    if (version !== scopeRef.current.version || !result.success) return result;
    await load();
    if (version === scopeRef.current.version) setRevision((current) => current + 1);
    return result;
  }, [load, userId]);

  const deleteTransaction = useCallback(async (id) => {
    if (!userId) return { success: false, errors: ['You are not signed in.'] };
    const version = scopeRef.current.version;
    const result = await transactionService.delete(userId, id);
    if (version !== scopeRef.current.version || !result.success) return result;
    await load();
    if (version === scopeRef.current.version) setRevision((current) => current + 1);
    return result;
  }, [load, userId]);

  const resetTransactions = useCallback(async () => {
    if (!userId) throw new Error('You are not signed in.');
    const version = scopeRef.current.version;
    await transactionService.clearAll(userId);
    if (version !== scopeRef.current.version) return;
    setTransactions([]);
    setMetricsRows([]);
    setDataUserId(userId);
    setLoadErrorState({ userId, message: '' });
    setRevision((current) => current + 1);
  }, [userId]);

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
    loadError: loadErrorState.userId === userId ? loadErrorState.message : '',
    addTransaction,
    updateTransaction,
    deleteTransaction,
    resetTransactions,
    reload: load,
  };
}
