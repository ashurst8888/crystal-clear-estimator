'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

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
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleDownloadPDF(entry: HistoryEntry) {
    window.location.href = `/chat/${entry.id}`;
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
        <Link
          href="/chat"
          className="text-[#4DA8DA] hover:text-[#3d96c8] flex items-center gap-1.5 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Chat
        </Link>
        <div className="h-5 w-px bg-gray-300" />
        <h1 className="font-bold text-gray-900">Estimate History</h1>
        <div className="ml-auto">
          <Link href="/references" className="text-gray-500 hover:text-gray-700 text-sm">
            References
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">No estimates yet</h2>
            <p className="text-gray-500 text-sm mb-5">
              Start a conversation to create your first estimate.
            </p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 bg-[#4DA8DA] text-white px-5 py-2.5 rounded-xl font-medium hover:bg-[#3d96c8] transition-colors"
            >
              New Estimate
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              {history.length} estimate{history.length !== 1 ? 's' : ''} found
            </p>
            <div className="space-y-3">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#4DA8DA]/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">
                          {entry.clientName}
                        </span>
                        {entry.invoiceNumber && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            #{entry.invoiceNumber}
                          </span>
                        )}
                        {entry.total !== null && entry.total !== undefined && (
                          <span className="font-bold text-[#4DA8DA]">
                            {formatCurrency(entry.total)}
                          </span>
                        )}
                      </div>
                      {entry.summary && (
                        <p className="text-sm text-gray-500 line-clamp-2 mb-2">
                          {entry.summary}
                        </p>
                      )}
                      <div className="text-xs text-gray-400">
                        Updated {formatDate(entry.updatedAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/chat/${entry.id}`}
                        className="text-sm text-[#4DA8DA] hover:text-[#3d96c8] font-medium px-3 py-1.5 border border-[#4DA8DA]/30 rounded-lg hover:bg-[#4DA8DA]/5 transition-colors"
                      >
                        Continue
                      </Link>
                      <button
                        onClick={() => handleDownloadPDF(entry)}
                        className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        title="Open conversation"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-sm text-red-400 hover:text-red-600 font-medium px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
