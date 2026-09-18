'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface Reference {
  id: string;
  jobType: string;
  clientName?: string;
  total?: number;
  originalFilename?: string;
  createdAt: string;
  pricingNotes: string;
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
  });
}

// The seeded estimates are identifiable by originalFilename pattern
function isSeeded(ref: Reference): boolean {
  return !!ref.originalFilename?.match(/^estimate_\d+_/);
}

export default function ReferencesPage() {
  const [references, setReferences] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadReferences = useCallback(async () => {
    try {
      const res = await fetch('/api/references');
      const data = await res.json();
      setReferences(data.references || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReferences();
  }, [loadReferences]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this reference estimate?')) return;
    try {
      await fetch(`/api/references/${id}`, { method: 'DELETE' });
      setReferences((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert('Failed to delete. Please try again.');
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload-reference', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.reference) {
        setReferences((prev) => [data.reference, ...prev]);
        setUploadSuccess(`Successfully imported: ${data.reference.jobType}`);
      } else {
        setUploadError(data.error || 'Upload failed');
      }
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
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
        <h1 className="font-bold text-gray-900">Reference Estimates Library</h1>
        <div className="ml-auto">
          <Link href="/history" className="text-gray-500 hover:text-gray-700 text-sm">
            History
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Upload Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Upload New Reference Estimate</h2>
          <p className="text-sm text-gray-500 mb-4">
            Upload a PDF, DOCX, or text file of a past estimate. Claude will extract the pricing data automatically.
          </p>

          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              dragOver
                ? 'border-[#4DA8DA] bg-[#4DA8DA]/5'
                : 'border-gray-300 hover:border-[#4DA8DA] hover:bg-gray-50'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.txt,.doc"
              onChange={handleFileChange}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[#4DA8DA] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-600">Uploading and processing...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm font-medium text-gray-700">
                  Drop a file here or click to browse
                </p>
                <p className="text-xs text-gray-400">PDF, DOCX, or TXT • Max 10MB</p>
              </div>
            )}
          </div>

          {uploadError && (
            <div className="mt-3 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">
              {uploadError}
            </div>
          )}
          {uploadSuccess && (
            <div className="mt-3 bg-green-50 text-green-700 text-sm rounded-lg px-4 py-3">
              {uploadSuccess}
            </div>
          )}
        </div>

        {/* References List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">
              Pricing References
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({references.length} total)
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : references.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-500">No reference estimates yet. Upload one above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {references.map((ref) => (
                <div
                  key={ref.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  <div
                    className="px-4 py-4 flex items-start gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(expandedId === ref.id ? null : ref.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 text-sm">{ref.jobType}</span>
                        {isSeeded(ref) && (
                          <span className="bg-[#4DA8DA]/10 text-[#4DA8DA] text-xs px-1.5 py-0.5 rounded font-medium">
                            Seeded
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        {ref.clientName && <span>{ref.clientName}</span>}
                        {ref.total !== null && ref.total !== undefined && (
                          <span className="font-medium text-gray-700">{formatCurrency(ref.total)}</span>
                        )}
                        <span>{formatDate(ref.createdAt)}</span>
                        {ref.originalFilename && (
                          <span className="text-gray-400 truncate max-w-[150px]">{ref.originalFilename}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(ref.id);
                        }}
                        className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        aria-label="Delete reference"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${expandedId === ref.id ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {expandedId === ref.id && (
                    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Pricing Notes
                      </h4>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                        {ref.pricingNotes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
