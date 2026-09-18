'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/chat" className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Estimate Signatures</h1>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : approvals.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
            No estimates sent yet. Email an estimate to a customer to get started.
          </div>
        ) : (
          <div className="space-y-6">
            {signed.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  ✅ Signed ({signed.length})
                </h2>
                <div className="space-y-4">
                  {signed.map((a) => {
                    const estimate = a.estimateJson;
                    const total = estimate.total
                      ? `$${Number(estimate.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : null;
                    const invNum = estimate.invoice_number ? `#${estimate.invoice_number}` : '';
                    const signedDate = a.signedAt
                      ? new Date(a.signedAt).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: 'numeric', minute: '2-digit',
                        })
                      : '';

                    return (
                      <div key={a.id} className="bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden">
                        <div className="p-4 flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-gray-900">
                              {a.clientName || 'Unknown Client'}
                              {invNum && <span className="text-gray-400 font-normal ml-2">{invNum}</span>}
                            </div>
                            <div className="text-sm text-gray-500 mt-0.5">{a.clientEmail}</div>
                            <div className="text-xs text-green-600 font-medium mt-1">Signed {signedDate}</div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {total && <div className="text-lg font-bold text-gray-900">{total}</div>}
                            <div className="flex gap-2">
                              {a.signedPdfBytes && (
                                <a
                                  href={`/api/signed-pdf?id=${a.id}`}
                                  className="text-xs bg-[#4DA8DA] hover:bg-[#3d96c8] text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                                >
                                  Download
                                </a>
                              )}
                              <button
                                onClick={() => handleDelete(a.id)}
                                className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Audit Trail</div>
                          <div className="space-y-1.5">
                            <div className="flex gap-3 text-xs">
                              <span className="text-gray-400 w-20 shrink-0">Signed at</span>
                              <span className="text-gray-700">{signedDate}</span>
                            </div>
                            {a.consentTimestamp && (
                              <div className="flex gap-3 text-xs">
                                <span className="text-gray-400 w-20 shrink-0">Consent</span>
                                <span className="text-gray-700">
                                  {new Date(a.consentTimestamp).toLocaleString('en-US', {
                                    month: 'short', day: 'numeric', year: 'numeric',
                                    hour: 'numeric', minute: '2-digit', second: '2-digit',
                                  })}
                                </span>
                              </div>
                            )}
                            {a.ipAddress && (
                              <div className="flex gap-3 text-xs">
                                <span className="text-gray-400 w-20 shrink-0">IP Address</span>
                                <span className="text-gray-700 font-mono">{a.ipAddress}</span>
                              </div>
                            )}
                            {a.userAgent && (
                              <div className="flex gap-3 text-xs">
                                <span className="text-gray-400 w-20 shrink-0">Device</span>
                                <span className="text-gray-700 break-all">{a.userAgent.slice(0, 80)}{a.userAgent.length > 80 ? '…' : ''}</span>
                              </div>
                            )}
                            {a.signedPdfHash && (
                              <div className="flex gap-3 text-xs">
                                <span className="text-gray-400 w-20 shrink-0">PDF Hash</span>
                                <span className="text-gray-500 font-mono break-all">{a.signedPdfHash}</span>
                              </div>
                            )}
                            <div className="flex gap-3 text-xs">
                              <span className="text-gray-400 w-20 shrink-0">Agreed</span>
                              <span className="text-green-600 font-medium">{a.consentGiven ? '✓ Agreed to electronic signing' : 'Not recorded'}</span>
                            </div>
                          </div>
                        </div>

                        {a.signature && (
                          <div className="border-t border-gray-100 px-4 py-3">
                            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Signature</div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.signature} alt="Client signature" className="h-14 bg-white rounded border border-gray-100 p-1" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {pending.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  ⏳ Awaiting Signature ({pending.length})
                </h2>
                <div className="space-y-3">
                  {pending.map((a) => {
                    const estimate = a.estimateJson;
                    const total = estimate.total
                      ? `$${Number(estimate.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : null;
                    const invNum = estimate.invoice_number ? `#${estimate.invoice_number}` : '';
                    const sentDate = new Date(a.createdAt).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    });

                    return (
                      <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-gray-900">
                              {a.clientName || 'Unknown Client'}
                              {invNum && <span className="text-gray-400 font-normal ml-2">{invNum}</span>}
                            </div>
                            <div className="text-sm text-gray-500 mt-0.5">{a.clientEmail}</div>
                            <div className="text-xs text-gray-400 mt-1">Sent {sentDate}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {total && <div className="text-lg font-bold text-gray-900">{total}</div>}
                            <button
                              onClick={() => handleDelete(a.id)}
                              className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
