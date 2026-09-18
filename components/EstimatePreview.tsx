'use client';

import { useState, useEffect } from 'react';
import { EmailModal } from './EmailModal';

interface LineItem {
  description: string;
  rate: number;
  quantity: number;
  total: number;
  details?: string;
  includes_labor?: boolean;
  includes_material?: boolean;
  labor_only?: boolean;
  customer_pays_material?: boolean;
  notes?: string[];
  price_source?: string;
}

interface PaymentScheduleItem {
  milestone: string;
  amount: number;
}

interface EstimateData {
  client_name?: string;
  client_address?: string;
  client_city_state_zip?: string;
  client_phone?: string;
  invoice_number?: string;
  date?: string;
  payment_terms?: string;
  line_items: LineItem[];
  subtotal?: number;
  discount?: number;
  total?: number;
  payment_schedule?: PaymentScheduleItem[];
  summary?: string;
  [key: string]: unknown;
}

interface EstimatePreviewProps {
  estimate: EstimateData;
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function PriceSourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  if (source === 'exact_match') {
    return <span className="price-source-exact">Exact Match</span>;
  }
  if (source === 'similar_job') {
    return <span className="price-source-similar">Similar Job</span>;
  }
  if (source === 'manual') {
    return <span className="price-source-manual">Manual</span>;
  }
  return null;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: '#9ca3af' },
  { value: 'sent', label: 'Sent', color: '#3b82f6' },
  { value: 'signed', label: 'Signed', color: '#22c55e' },
  { value: 'in_progress', label: 'In Progress', color: '#eab308' },
  { value: 'completed', label: 'Completed', color: '#16a34a' },
  { value: 'declined', label: 'Declined', color: '#ef4444' },
];

function getConversationIdFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const parts = window.location.pathname.split('/');
  const chatIdx = parts.indexOf('chat');
  if (chatIdx !== -1 && parts[chatIdx + 1]) return parts[chatIdx + 1];
  return null;
}

export function EstimatePreview({ estimate }: EstimatePreviewProps) {
  const [downloading, setDownloading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [status, setStatus] = useState('draft');
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    const conversationId = getConversationIdFromPath();
    if (!conversationId) return;
    fetch(`/api/status?conversationId=${conversationId}`)
      .then((r) => r.json())
      .then((data) => { if (data.status) setStatus(data.status); })
      .catch(() => {});
  }, []);

  async function handleStatusChange(newStatus: string) {
    const conversationId = getConversationIdFromPath();
    if (!conversationId) return;
    setSavingStatus(true);
    try {
      await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, status: newStatus }),
      });
      setStatus(newStatus);
    } catch {
      // silently fail
    } finally {
      setSavingStatus(false);
    }
  }

  const currentStatusOption = STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0];

  async function handleDownloadPDF() {
    setDownloading(true);
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate }),
      });
      if (!res.ok) {
        throw new Error('PDF generation failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const clientName = estimate.client_name?.replace(/\s+/g, '_') || 'estimate';
      const invNum = estimate.invoice_number || '';
      a.download = `estimate_${invNum ? invNum + '_' : ''}${clientName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  const subtotal = estimate.subtotal ?? estimate.line_items.reduce((s, i) => s + (i.total || 0), 0);
  const total = estimate.total ?? subtotal;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-[#2563eb] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-white/80 text-xs font-medium uppercase tracking-wide mb-0.5">
              Estimate
              {estimate.invoice_number ? ` #${estimate.invoice_number}` : ''}
            </div>
            <div className="text-white font-bold text-xl">
              {estimate.client_name || 'Draft Estimate'}
            </div>
            {estimate.client_address && (
              <div className="text-white/80 text-sm mt-0.5">{estimate.client_address}</div>
            )}
            {estimate.client_city_state_zip && (
              <div className="text-white/80 text-sm">{estimate.client_city_state_zip}</div>
            )}
            {estimate.client_phone && (
              <div className="text-white/80 text-sm">{estimate.client_phone}</div>
            )}
          </div>
          <div className="text-right shrink-0">
            {estimate.date && (
              <div className="text-white/80 text-sm">{estimate.date}</div>
            )}
            <div className="text-white text-2xl font-bold mt-1">
              {formatCurrency(total)}
            </div>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[45%]">
                Description
              </th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Rate
              </th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Qty
              </th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Total
              </th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Source
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {estimate.line_items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 align-top">
                  <div className="font-semibold text-gray-900 text-sm">{item.description}</div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.labor_only && (
                      <span className="bg-blue-50 text-blue-700 text-xs px-1.5 py-0.5 rounded font-medium">
                        Labor Only
                      </span>
                    )}
                    {!item.labor_only && item.includes_labor && item.includes_material && (
                      <span className="bg-purple-50 text-purple-700 text-xs px-1.5 py-0.5 rounded font-medium">
                        Labor + Material
                      </span>
                    )}
                    {!item.labor_only && item.includes_labor && !item.includes_material && !item.customer_pays_material && (
                      <span className="bg-indigo-50 text-indigo-700 text-xs px-1.5 py-0.5 rounded font-medium">
                        Labor Only
                      </span>
                    )}
                    {item.customer_pays_material && (
                      <span className="bg-amber-50 text-amber-700 text-xs px-1.5 py-0.5 rounded font-medium">
                        Customer Pays Material
                      </span>
                    )}
                  </div>

                  {item.details && (
                    <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">{item.details}</p>
                  )}

                  {item.notes && item.notes.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {item.notes.map((note, nIdx) => (
                        <li key={nIdx} className="text-gray-400 text-xs italic">
                          * {note}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-3 py-3 text-right align-top">
                  <span className="text-gray-700 text-sm whitespace-nowrap">
                    {item.rate === 0 ? 'TBD' : formatCurrency(item.rate)}
                  </span>
                </td>
                <td className="px-3 py-3 text-center align-top">
                  <span className="text-gray-700 text-sm">{item.quantity}</span>
                </td>
                <td className="px-3 py-3 text-right align-top">
                  <span className="font-semibold text-gray-900 text-sm whitespace-nowrap">
                    {item.total === 0 ? 'TBD' : formatCurrency(item.total)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center align-top">
                  <PriceSourceBadge source={item.price_source} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="border-t border-gray-200 px-4 py-4">
        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-1.5">
            {estimate.subtotal !== undefined && estimate.subtotal !== null && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(estimate.subtotal)}</span>
              </div>
            )}
            {estimate.discount !== undefined && estimate.discount !== null && estimate.discount > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Discount</span>
                <span>-{formatCurrency(estimate.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 pt-1.5 border-t border-gray-200">
              <span>Total</span>
              <span className="text-[#2563eb]">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Schedule */}
      {estimate.payment_schedule && estimate.payment_schedule.length > 0 && (
        <div className="border-t border-gray-200 px-4 py-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Payment Schedule
          </h4>
          <div className="space-y-1.5">
            {estimate.payment_schedule.map((ps, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-gray-600">{ps.milestone}</span>
                <span className="font-medium text-gray-900">{formatCurrency(ps.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {estimate.summary && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <p className="text-xs text-gray-500 italic">{estimate.summary}</p>
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-gray-200 px-4 py-4 bg-gray-50">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex-1 flex items-center justify-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {downloading ? 'Generating PDF...' : 'Download PDF'}
          </button>
          <button
            onClick={() => setShowEmailModal(true)}
            className="flex-1 flex items-center justify-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Send to Customer
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-3">
          Ask me to make changes in the chat below
        </p>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200">
          <span className="text-sm text-gray-500 font-medium whitespace-nowrap">Status:</span>
          <div className="flex items-center gap-2 flex-1">
            <span
              style={{ background: currentStatusOption.color }}
              className="w-2.5 h-2.5 rounded-full shrink-0"
            />
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={savingStatus}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2563eb] disabled:opacity-50"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {savingStatus && <span className="text-xs text-gray-400">Saving...</span>}
          </div>
        </div>
      </div>

      {showEmailModal && (
        <EmailModal
          estimate={estimate as Record<string, unknown>}
          onClose={() => setShowEmailModal(false)}
        />
      )}

    </div>
  );
}

