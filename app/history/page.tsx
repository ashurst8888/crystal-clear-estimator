'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';

interface HistoryEntry {
  id: string;
  clientName: string;
  total: number | null;
  createdAt: string;
  updatedAt: string;
  summary?: string;
  invoiceNumber?: string;
  date?: string;
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data.history || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const filtered = history.filter((e) =>
    !search || e.clientName?.toLowerCase().includes(search.toLowerCase()) || e.invoiceNumber?.includes(search)
  );

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(e => e.id)));
    }
  }

  async function deleteSelected() {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} estimate${selected.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      setHistory(prev => prev.filter(e => !selected.has(e.id)));
      setSelected(new Set());
    } catch {
      alert('Failed to delete.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this estimate and chat? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setHistory((prev) => prev.filter((e) => e.id !== id));
    } catch {
      alert('Failed to delete. Please try again.');
    }
  }

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
            <p className="text-sm text-gray-500 mt-1">All created estimates and conversations</p>
          </div>
          <div className="flex items-center gap-3">
            {selected.size > 0 && (
              <button
                onClick={deleteSelected}
                disabled={deleting}
                className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete {selected.size} selected
              </button>
            )}
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Estimate
            </Link>
          </div>
        </div>

        {/* Search */}
        {history.length > 0 && (
          <div className="relative mb-4">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by client name or invoice #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb]"
            />
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200/80 p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/4 mb-2" />
                <div className="h-3 bg-gray-50 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200/80 p-14 text-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">No estimates yet</h2>
            <p className="text-sm text-gray-400 mb-5">Start a conversation to create your first estimate.</p>
            <Link href="/chat" className="inline-flex items-center gap-2 bg-[#2563eb] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#1d4ed8] transition-colors">
              Create Estimate
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200/80 p-10 text-center shadow-sm">
            <p className="text-sm text-gray-400">No results for &ldquo;{search}&rdquo;</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            {/* Select all header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-gray-300 text-[#2563eb] focus:ring-[#2563eb]/30 cursor-pointer"
              />
              <span className="text-xs font-medium text-gray-500">
                {selected.size > 0 ? `${selected.size} selected` : `${filtered.length} estimate${filtered.length !== 1 ? 's' : ''}`}
              </span>
            </div>

            <div className="divide-y divide-gray-50">
              {filtered.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-4 px-5 py-4 transition-colors group ${selected.has(entry.id) ? 'bg-[#2563eb]/3' : 'hover:bg-gray-50/60'}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(entry.id)}
                    onChange={() => toggleSelect(entry.id)}
                    className="w-4 h-4 rounded border-gray-300 text-[#2563eb] focus:ring-[#2563eb]/30 cursor-pointer shrink-0"
                  />

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-xl bg-[#2563eb]/10 flex items-center justify-center shrink-0">
                    <span className="text-[#2563eb] font-bold text-sm">
                      {(entry.clientName || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{entry.clientName || 'Unnamed'}</span>
                      {entry.invoiceNumber && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                          #{entry.invoiceNumber}
                        </span>
                      )}
                      {entry.total !== null && entry.total !== undefined && (
                        <span className="text-sm font-semibold text-[#2563eb]">{formatCurrency(entry.total)}</span>
                      )}
                    </div>
                    {entry.summary && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{entry.summary}</p>
                    )}
                    <div className="text-xs text-gray-400 mt-0.5">
                      Updated {formatDate(entry.updatedAt)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      href={`/chat/${entry.id}`}
                      className="text-xs font-semibold text-[#2563eb] border border-[#2563eb]/30 rounded-lg px-3 py-1.5 hover:bg-[#2563eb]/5 transition-colors"
                    >
                      Open
                    </Link>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  {/* Always-visible open link for mobile */}
                  <Link href={`/chat/${entry.id}`} className="lg:hidden text-xs font-semibold text-[#2563eb]">
                    Open →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
