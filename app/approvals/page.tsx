'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';

type Approval = {
  id: string;
  clientName: string | null;
  clientEmail: string;
  estimateJson: Record<string, unknown>;
  signature: string | null;
  signedAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  consentGiven: boolean;
  consentTimestamp: string | null;
  signedPdfHash: string | null;
  signedPdfBytes: string | null;
  envelopeId: string | null;
  createdAt: string;
};

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function formatDateTime(str: string): string {
  return new Date(str).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/approvals')
      .then((r) => r.json())
      .then((d) => setApprovals(d.approvals || []))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('Delete this signature record? This cannot be undone.')) return;
    const res = await fetch('/api/approvals', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setApprovals((prev) => prev.filter((a) => a.id !== id));
  }

  const signed = approvals.filter((a) => a.signedAt);
  const pending = approvals.filter((a) => !a.signedAt);

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Signatures</h1>
          <p className="text-sm text-gray-500 mt-1">Track estimate approvals and electronic signatures</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200/80 p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-50 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : approvals.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200/80 p-14 text-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">No signatures yet</h2>
            <p className="text-sm text-gray-400">Email an estimate to a client to get started.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending */}
            {pending.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 bg-amber-400 rounded-full" />
                  <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Awaiting Signature ({pending.length})</h2>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                  <div className="divide-y divide-gray-50">
                    {pending.map((a) => {
                      const estimate = a.estimateJson;
                      const total = estimate.total ? formatCurrency(Number(estimate.total)) : null;
                      const invNum = estimate.invoice_number ? `#${estimate.invoice_number}` : '';
                      return (
                        <div key={a.id} className="flex items-center gap-4 px-5 py-4">
                          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900 text-sm">{a.clientName || 'Unknown'}</span>
                              {invNum && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">{invNum}</span>}
                            </div>
                            <div className="text-xs text-gray-400 truncate">{a.clientEmail}</div>
                            <div className="text-xs text-gray-400 mt-0.5">Sent {formatDateTime(a.createdAt)}</div>
                          </div>
                          <div className="shrink-0 flex items-center gap-3">
                            {total && <span className="text-sm font-semibold text-[#2563eb]">{total}</span>}
                            <button
                              onClick={() => handleDelete(a.id)}
                              className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded-lg px-2.5 py-1.5 hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Signed */}
            {signed.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Signed ({signed.length})</h2>
                </div>
                <div className="space-y-3">
                  {signed.map((a) => {
                    const estimate = a.estimateJson;
                    const total = estimate.total ? formatCurrency(Number(estimate.total)) : null;
                    const invNum = estimate.invoice_number ? `#${estimate.invoice_number}` : '';
                    const signedDate = a.signedAt ? formatDateTime(a.signedAt) : '';
                    const isOpen = expanded === a.id;

                    return (
                      <div key={a.id} className="bg-white rounded-2xl border border-emerald-200/60 shadow-sm overflow-hidden">
                        {/* Main row */}
                        <div className="flex items-center gap-4 px-5 py-4">
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900 text-sm">{a.clientName || 'Unknown'}</span>
                              {invNum && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">{invNum}</span>}
                              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Signed</span>
                            </div>
                            <div className="text-xs text-gray-400 truncate">{a.clientEmail}</div>
                            <div className="text-xs text-emerald-600 mt-0.5 font-medium">{signedDate}</div>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            {total && <span className="text-sm font-semibold text-[#2563eb]">{total}</span>}
                            {a.signedPdfBytes && (
                              <a
                                href={`/api/signed-pdf?id=${a.id}`}
                                className="text-xs font-semibold bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-3 py-1.5 rounded-lg transition-colors"
                              >
                                PDF
                              </a>
                            )}
                            <button
                              onClick={() => setExpanded(isOpen ? null : a.id)}
                              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors"
                            >
                              {isOpen ? 'Less' : 'Details'}
                            </button>
                            <button
                              onClick={() => handleDelete(a.id)}
                              className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded-lg px-2.5 py-1.5 hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {/* Expandable audit trail */}
                        {isOpen && (
                          <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Audit info */}
                              <div>
                                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Audit Trail</div>
                                <div className="space-y-2">
                                  {[
                                    { label: 'Signed at', value: signedDate },
                                    a.consentTimestamp && { label: 'Consent', value: new Date(a.consentTimestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }) },
                                    a.ipAddress && { label: 'IP Address', value: a.ipAddress, mono: true },
                                    a.userAgent && { label: 'Device', value: a.userAgent.slice(0, 70) + (a.userAgent.length > 70 ? '…' : '') },
                                    { label: 'Agreed', value: a.consentGiven ? '✓ Agreed to electronic signing' : 'Not recorded', green: a.consentGiven },
                                    a.signedPdfHash && { label: 'PDF Hash', value: a.signedPdfHash.slice(0, 16) + '…', mono: true },
                                  ].filter(Boolean).map((item) => {
                                    const row = item as { label: string; value: string; mono?: boolean; green?: boolean };
                                    return (
                                      <div key={row.label} className="flex gap-3 text-xs">
                                        <span className="text-gray-400 w-20 shrink-0">{row.label}</span>
                                        <span className={`${row.mono ? 'font-mono text-gray-500' : ''} ${row.green ? 'text-emerald-600 font-medium' : 'text-gray-700'} break-all`}>
                                          {row.value}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Signature image */}
                              {a.signature && (
                                <div>
                                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Signature</div>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={a.signature}
                                    alt="Client signature"
                                    className="h-16 bg-white rounded-xl border border-gray-200 p-2 object-contain"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
