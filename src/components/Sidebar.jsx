import React, { memo } from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  HandCoins,
  Banknote,
  BarChart2,
  Tag,
  Settings,
  Wallet,
  X,
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'lent', label: 'Lent', icon: HandCoins },
  { id: 'borrowed', label: 'Borrowed', icon: Banknote },
  { id: 'reports', label: 'Reports', icon: BarChart2 },
  { id: 'categories', label: 'Categories', icon: Tag },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function Sidebar({ activePage, onNavigate, mobileOpen, onMobileClose }) {
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-100 z-30
          flex flex-col shadow-sm
          transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:shadow-none
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Wallet size={20} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-base leading-tight">Money Tracker</div>
            <div className="text-xs text-slate-400">Personal Finance</div>
          </div>
          {/* Mobile close */}
          <button
            onClick={onMobileClose}
            className="ml-auto lg:hidden p-1 rounded-lg hover:bg-slate-100"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activePage === id;
            return (
              <button
                key={id}
                onClick={() => { onNavigate(id); onMobileClose(); }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                  transition-colors duration-150
                  ${isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }
                `}
              >
                <Icon size={20} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-slate-100">
          <p className="text-xs text-slate-400 text-center">Money Tracker v1.0</p>
        </div>
      </aside>
    </>
  );
}

export default memo(Sidebar);
