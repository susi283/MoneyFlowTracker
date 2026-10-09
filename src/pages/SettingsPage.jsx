import React, { useState } from 'react';
import { Trash2, Database, Info } from 'lucide-react';

export default function SettingsPage({ onResetData }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleClearAll() {
    if (window.confirm('This will erase ALL your cloud transactions permanently. Are you sure?')) {
      setBusy(true);
      setError('');
      setMessage('');
      try {
        await onResetData();
        setMessage('All transactions have been cleared.');
        setTimeout(() => setMessage(''), 4000);
      } catch (err) {
        console.error('Failed to clear transactions:', err);
        setError('Unable to clear transactions. Check your connection and database permissions, then try again.');
      } finally {
        setBusy(false);
      }
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title">Settings</h1>

      {message && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
          {message}
        </div>
      )}
      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
          {error}
        </div>
      )}

      {/* App Info */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Info size={20} className="text-blue-600" />
          </div>
          <h2 className="section-title">About</h2>
        </div>
        <div className="space-y-2 text-sm text-slate-600">
          <p><span className="font-semibold">Built by:</span> Susindran S</p>
          <p><span className="font-semibold">App:</span> Personal Money Tracker</p>
          <p><span className="font-semibold">Storage:</span> Supabase Cloud Database</p>
          <p><span className="font-semibold">Currency:</span> Indian Rupee (₹)</p>
        </div>
      </div>

      {/* Data Management */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <Database size={20} className="text-amber-600" />
          </div>
          <h2 className="section-title">Data Management</h2>
        </div>

        <div className="space-y-4">
          {/* Clear all */}
          <div className="p-4 bg-red-50 rounded-xl border border-red-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-red-700">Clear All Data</p>
                <p className="text-sm text-red-500 mt-1">
                  Permanently delete all transactions. Your categories and account settings are not changed.
                </p>
              </div>
              <button
                onClick={handleClearAll}
                disabled={busy}
                className="btn-danger flex items-center gap-2 whitespace-nowrap flex-shrink-0"
              >
                <Trash2 size={16} /> {busy ? 'Clearing...' : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Architecture note */}
      <div className="card bg-blue-50 border-blue-100">
        <p className="text-sm font-semibold text-blue-700 mb-2">🔧 Developer Notes</p>
        <ul className="text-sm text-blue-600 space-y-1 list-disc list-inside">
          <li>Data is stored securely in the Supabase cloud database</li>
          <li>Authentication and Row Level Security isolate each user's data</li>
          <li>Parser in <code className="bg-blue-100 px-1 rounded">parserService.js</code> can be replaced with AI API</li>
          <li>Balance is always calculated from transactions — never stored separately</li>
        </ul>
      </div>
    </div>
  );
}
