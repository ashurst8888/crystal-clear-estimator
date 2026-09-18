import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import type { Conversation, EstimateApproval } from '@prisma/client';

export const dynamic = 'force-dynamic';

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}


export default async function DashboardPage() {
  const conversations: Conversation[] = await prisma.conversation.findMany({ orderBy: { updatedAt: 'desc' } });
  const approvals: EstimateApproval[] = await prisma.estimateApproval.findMany({ orderBy: { createdAt: 'desc' } });

  const estimatesCreated = conversations.filter((c) => c.lastEstimate !== null).length;
  const totalValueQuoted = conversations.reduce((sum, c) => sum + (c.total ?? 0), 0);
  const unsignedApprovals = approvals.filter((a) => !a.signedAt);
  const signedApprovals = approvals.filter((a) => !!a.signedAt);
  const recentEstimates = conversations.filter((c) => c.lastEstimate !== null).slice(0, 6);

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of your estimates and activity</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Estimates</div>
              <div className="w-8 h-8 rounded-lg bg-[#4DA8DA]/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#4DA8DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{estimatesCreated}</div>
            <div className="text-xs text-gray-400 mt-1">All time</div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Quoted</div>
              <div className="w-8 h-8 rounded-lg bg-[#4DA8DA]/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#4DA8DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-[#4DA8DA]">{formatCurrency(totalValueQuoted)}</div>
            <div className="text-xs text-gray-400 mt-1">Total value</div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending</div>
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-amber-500">{unsignedApprovals.length}</div>
            <div className="text-xs text-gray-400 mt-1">Awaiting signature</div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Signed</div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-emerald-600">{signedApprovals.length}</div>
            <div className="text-xs text-gray-400 mt-1">Approved by client</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Recent Estimates - wider */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Recent Estimates</h2>
              <Link href="/history" className="text-xs font-semibold text-[#4DA8DA] hover:underline">View all</Link>
            </div>
            {recentEstimates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400">No estimates yet</p>
                <Link href="/chat" className="mt-3 text-xs font-semibold text-[#4DA8DA] hover:underline">Create your first estimate →</Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentEstimates.map((conv) => {
                  const estimate = conv.lastEstimate as Record<string, unknown> | null;
                  const invNum = (estimate?.invoice_number as string) || null;
                  return (
                    <Link
                      key={conv.id}
                      href={`/chat/${conv.id}`}
                      className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50/80 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm truncate">
                            {conv.clientName || (estimate?.client_name as string) || 'Unnamed Client'}
                          </span>
                          {invNum && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono shrink-0">
                              #{invNum}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{formatDate(conv.updatedAt)}</div>
                      </div>
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        {conv.total ? (
                          <span className="text-sm font-semibold text-[#4DA8DA]">{formatCurrency(conv.total)}</span>
                        ) : (
                          <span className="text-sm text-gray-300">—</span>
                        )}
                        <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Signatures - narrower */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Pending Signatures</h2>
              <Link href="/approvals" className="text-xs font-semibold text-[#4DA8DA] hover:underline">View all</Link>
            </div>
            {unsignedApprovals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400">All clear!</p>
                <p className="text-xs text-gray-400 mt-1">No pending signatures</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {unsignedApprovals.slice(0, 5).map((approval) => {
                  const estimate = approval.estimateJson as Record<string, unknown>;
                  const amount = estimate?.total ? formatCurrency(Number(estimate.total)) : null;
                  return (
                    <div key={approval.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 text-sm truncate">
                            {approval.clientName || 'Unknown Client'}
                          </div>
                          <div className="text-xs text-gray-400 truncate mt-0.5">{approval.clientEmail}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            Sent {formatDate(approval.createdAt)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {amount && <div className="text-sm font-semibold text-[#4DA8DA]">{amount}</div>}
                          <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                            Waiting
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
