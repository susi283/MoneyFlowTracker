import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Menu, LogOut, User } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import AuthPage from './pages/AuthPage';
import IntroPage from './pages/IntroPage';
import QuickAddButton from './components/QuickAddButton';
import { useTransactions } from './hooks/useTransactions';
import { categoryService } from './services/categoryService';
import { supabase } from './lib/supabase';

const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const LentPage = lazy(() => import('./pages/LentPage'));
const BorrowedPage = lazy(() => import('./pages/BorrowedPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const EMPTY_CATEGORIES = { expense: [], income: [] };

function isPasswordRecoveryRedirect() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  return searchParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery';
}

let initialSessionRequest;

function getInitialSession() {
  if (!initialSessionRequest) initialSessionRequest = supabase.auth.getSession();
  return initialSessionRequest;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(isPasswordRecoveryRedirect);
  const [showIntro, setShowIntro] = useState(() => !isPasswordRecoveryRedirect());
  const [activePage, setActivePage] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [categoryState, setCategoryState] = useState({ userId: null, categories: EMPTY_CATEGORIES });
  const categoryVersionRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    getInitialSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setAuthLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);

      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setShowIntro(false);
      } else if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user || null;
  const userId = user?.id;
  const categories = categoryState.userId === userId ? categoryState.categories : EMPTY_CATEGORIES;

  useEffect(() => {
    if (!userId) return undefined;

    let active = true;
    const version = categoryVersionRef.current;
    categoryService.getAll(userId)
      .then((data) => {
        if (active && version === categoryVersionRef.current) {
          setCategoryState({ userId, categories: data });
        }
      })
      .catch((err) => console.error('Failed to load categories:', err));

    return () => { active = false; };
  }, [userId]);

  const {
    transactions,
    metricsRows,
    availableMonths,
    revision,
    summary,
    ledger,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    resetTransactions,
  } = useTransactions(userId);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const refreshCategories = useCallback(
    (updated) => {
      categoryVersionRef.current += 1;
      setCategoryState({ userId, categories: updated });
    },
    [userId],
  );

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Loading...</div>;
  }

  if (passwordRecovery) {
    return <AuthPage initialMode="reset" onRecoveryComplete={() => setPasswordRecovery(false)} />;
  }

  if (!session) {
    if (showIntro) return <IntroPage onComplete={() => setShowIntro(false)} />;
    return <AuthPage />;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  function renderPage() {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard transactions={transactions} metricsRows={metricsRows} availableMonths={availableMonths} summary={summary} ledger={ledger} onAdd={addTransaction} onReset={resetTransactions} categories={categories} />;
      case 'transactions':
        return <TransactionsPage userId={userId} availableMonths={availableMonths} revision={revision} onAdd={addTransaction} onUpdate={updateTransaction} onDelete={deleteTransaction} categories={categories} />;
      case 'lent':
        return <LentPage userId={userId} ledger={ledger} onAddTransaction={addTransaction} revision={revision} />;
      case 'borrowed':
        return <BorrowedPage userId={userId} ledger={ledger} onAddTransaction={addTransaction} revision={revision} />;
      case 'reports':
        return <ReportsPage userId={userId} availableMonths={availableMonths} revision={revision} />;
      case 'categories':
        return <CategoriesPage userId={userId} categories={categories} onCategoriesChange={refreshCategories} />;
      case 'settings':
        return <SettingsPage onResetData={resetTransactions} />;
      default:
        return null;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar activePage={activePage} onNavigate={setActivePage} mobileOpen={mobileOpen} onMobileClose={closeMobile} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <Menu size={22} className="text-slate-700" />
          </button>
          <span className="font-bold text-slate-800 text-base">Money Tracker</span>
        </header>

        <div className="bg-white border-b border-slate-100 px-4 sm:px-6 lg:px-8 py-2 flex justify-end items-center gap-3">
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <User size={14} /> {user.email}
          </span>
          <button onClick={signOut} className="text-xs font-semibold text-slate-600 hover:text-red-600 flex items-center gap-1.5">
            <LogOut size={14} /> Sign out
          </button>
        </div>

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Suspense fallback={<div className="flex items-center justify-center h-40"><div className="text-slate-400 text-sm">Loading...</div></div>}>
              {renderPage()}
            </Suspense>
          </div>
        </main>
      </div>

      <QuickAddButton onAdd={addTransaction} categories={categories} />
    </div>
  );
}
