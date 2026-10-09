import React, { useState } from 'react';
import { Send, Loader2, AlertCircle, CheckCircle2, Edit3 } from 'lucide-react';
import { parseNaturalInput } from '../services/parserService';
import { getTypeLabel } from '../utils/helpers';
import TransactionForm from './TransactionForm';

export default function SmartInput({ onAdd, categories }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState(null); // null | 'asking' | 'preview' | 'success' | 'error'
  const [message, setMessage] = useState('');
  const [parsed, setParsed] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [clarification, setClarification] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setStatus(null);
    setMessage('');
    setParsed(null);

    // Small delay for UX feel
    setTimeout(() => {
      const result = parseNaturalInput(text);
      setLoading(false);

      if (!result.success) {
        if (result.missing && result.missing.length > 0) {
          setStatus('asking');
          setMessage(result.suggestion);
          setParsed(result.partial || null);
        } else {
          setStatus('error');
          setMessage(result.suggestion || 'Could not understand. Try being more specific.');
        }
      } else {
        setStatus('preview');
        setParsed(result.transaction);
      }
    }, 200);
  }

  function handleClarificationSubmit(e) {
    e.preventDefault();
    if (!clarification.trim() || !parsed) return;

    // Re-parse with clarification appended
    const combined = text + ' on ' + clarification;
    const result = parseNaturalInput(combined);
    setClarification('');

    if (!result.success) {
      setStatus('error');
      setMessage('Still could not parse. Please use the manual form below.');
    } else {
      setStatus('preview');
      setParsed(result.transaction);
    }
  }

  async function handleConfirm() {
    if (!parsed || submitting) return;
    setSubmitting(true);
    try {
      const result = await onAdd(parsed);
      if (result.success) {
        setText('');
        setParsed(null);
        setStatus('success');
        setMessage('Transaction added successfully!');
        setTimeout(() => { setStatus(null); setMessage(''); }, 2500);
      } else {
        setStatus('error');
        setMessage(result.errors?.join(', ') || 'Failed to add transaction.');
      }
    } catch (error) {
      console.error('Failed to add parsed transaction:', error);
      setStatus('error');
      setMessage('Unable to add the transaction. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    setStatus(null);
    setParsed(null);
    setMessage('');
    setText('');
    setClarification('');
  }

  const examples = [
    'I spent 200 on food',
    'Got 500 from dad',
    'Gave Rahul 1000',
    'Rahul returned 500',
    'Paid 300 for bus',
  ];

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Edit3 size={20} className="text-blue-600" />
        <h2 className="section-title">Add Transaction</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Type naturally, e.g. <span className="italic">"I spent 200 on food"</span> or use the manual form below.
      </p>

      {/* Natural Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          className="input-field flex-1 text-base"
          placeholder="I spent 200 on food..."
          value={text}
          onChange={(e) => { setText(e.target.value); setStatus(null); }}
          disabled={loading || status === 'preview' || status === 'asking'}
        />
        <button
          type="submit"
          className="btn-primary flex items-center gap-2 whitespace-nowrap"
          disabled={loading || !text.trim() || status === 'preview' || status === 'asking'}
        >
          {loading
            ? <Loader2 size={18} className="animate-spin" />
            : <Send size={18} />
          }
          <span className="hidden sm:inline">Parse</span>
        </button>
      </form>

      {/* Example chips */}
      <div className="flex flex-wrap gap-2 mt-3">
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => { setText(ex); setStatus(null); }}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Clarification prompt */}
      {status === 'asking' && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={18} className="text-amber-500" />
            <p className="text-sm font-semibold text-amber-700">{message}</p>
          </div>
          <form onSubmit={handleClarificationSubmit} className="flex gap-2">
            <input
              type="text"
              className="input-field flex-1"
              placeholder="Your answer..."
              value={clarification}
              onChange={(e) => setClarification(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-primary">OK</button>
            <button type="button" onClick={handleCancel} className="btn-secondary">Cancel</button>
          </form>
        </div>
      )}

      {/* Preview parsed transaction */}
      {status === 'preview' && parsed && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm font-semibold text-blue-700 mb-3">Confirm this transaction:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <p className="text-xs text-blue-500 font-medium">Type</p>
              <p className="text-sm font-bold text-blue-800">{getTypeLabel(parsed.type)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-500 font-medium">Amount</p>
              <p className="text-sm font-bold text-blue-800">₹{parsed.amount}</p>
            </div>
            <div>
              <p className="text-xs text-blue-500 font-medium">Category</p>
              <p className="text-sm font-bold text-blue-800">{parsed.category}</p>
            </div>
            <div>
              <p className="text-xs text-blue-500 font-medium">Description</p>
              <p className="text-sm font-bold text-blue-800">{parsed.description || '—'}</p>
            </div>
            {parsed.person && (
              <div>
                <p className="text-xs text-blue-500 font-medium">Person</p>
                <p className="text-sm font-bold text-blue-800">{parsed.person}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-blue-500 font-medium">Date</p>
              <p className="text-sm font-bold text-blue-800">{parsed.date}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleConfirm} disabled={submitting} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {submitting ? 'Adding...' : 'Confirm & Add'}
            </button>
            <button onClick={handleCancel} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Success */}
      {status === 'success' && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle2 size={18} className="text-green-500" />
          <p className="text-sm font-semibold text-green-700">{message}</p>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle size={18} className="text-red-500" />
          <p className="text-sm font-semibold text-red-700">{message}</p>
        </div>
      )}

      {/* Manual form toggle */}
      <div className="mt-5 pt-4 border-t border-slate-100">
        <button
          onClick={() => setShowManual(!showManual)}
          className="text-sm text-blue-600 hover:underline font-medium"
        >
          {showManual ? 'Hide manual form' : 'Or use manual form →'}
        </button>
        {showManual && (
          <div className="mt-4">
            <TransactionForm
              categories={categories}
              onSubmit={async (data) => {
                const result = await onAdd(data);
                if (result.success) {
                  setShowManual(false);
                  setStatus('success');
                  setMessage('Transaction added successfully!');
                  setTimeout(() => { setStatus(null); setMessage(''); }, 2500);
                }
                return result;
              }}
              onCancel={() => setShowManual(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
