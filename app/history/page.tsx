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

  const filtered = history.filter((e) =>
    !search || e.clientName?.toLowerCase().includes(search.toLowerCase()) || e.invoiceNumber?.includes(search)
  );

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
            <p className="text-sm text-gray-500 mt-1">All created estimates and conversations</p>
          </div>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 bg-[#4DA8DA] hover:bg-[#3d96c8] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Estimate
          </Link>
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
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4DA8DA]/30 focus:border-[#4DA8DA]"
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
            <Link href="/chat" className="inline-flex items-center gap-2 bg-[#4DA8DA] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#3d96c8] transition-colors">
              Create Estimate
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200/80 p-10 text-center shadow-sm">
            <p className="text-sm text-gray-400">No results for &ldquo;{search}&rdquo;</p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-400 mb-3 font-medium">{filtered.length} estimate{filtered.length !== 1 ? 's' : ''}</p>
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-50">
                {filtered.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors group">
                    {/* Left: avatar */}
                    <div className="w-9 h-9 rounded-xl bg-[#4DA8DA]/10 flex items-center justify-center shrink-0">
                      <span className="text-[#4DA8DA] font-bold text-sm">
                        {(entry.clientName || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Middle: info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{entry.clientName || 'Unnamed'}</span>
                        {entry.invoiceNumber && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                            #{entry.invoiceNumber}
                          </span>
                        )}
                        {entry.total !== null && entry.total !== undefined && (
                          <span className="text-sm font-semibold text-[#4DA8DA]">{formatCurrency(entry.total)}</span>
                        )}
                      </div>
                      {entry.summary && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{entry.summary}</p>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">
                        Updated {formatDate(entry.updatedAt)}
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/chat/${entry.id}`}
                        className="text-xs font-semibold text-[#4DA8DA] border border-[#4DA8DA]/30 rounded-lg px-3 py-1.5 hover:bg-[#4DA8DA]/5 transition-colors"
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
                    <Link href={`/chat/${entry.id}`} className="lg:hidden text-xs font-semibold text-[#4DA8DA]">
                      Open →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
