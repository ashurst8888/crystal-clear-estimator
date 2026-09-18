import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function DashboardPage() {
  const [conversations, approvals] = await Promise.all([
    prisma.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.estimateApproval.findMany({
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const estimatesCreated = conversations.filter((c) => c.lastEstimate !== null).length;

  const totalValueQuoted = conversations.reduce((sum, c) => sum + (c.total ?? 0), 0);

  const unsignedApprovals = approvals.filter((a) => !a.signedAt);
  const signedApprovals = approvals.filter((a) => !!a.signedAt);

  const recentEstimates = conversations
    .filter((c) => c.lastEstimate !== null)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Crystal Clear" width={40} height={40} className="h-10 w-auto" />
            <div>
              <div className="font-bold text-gray-900 text-base leading-tight">Crystal Clear Estimator</div>
              <div className="text-xs text-gray-400 leading-tight">Dashboard</div>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            <Link href="/chat" className="text-gray-500 hover:text-gray-800 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              New Estimate
            </Link>
            <Link href="/history" className="text-gray-500 hover:text-gray-800 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              History
            </Link>
            <Link href="/approvals" className="text-gray-500 hover:text-gray-800 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              Approvals
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Overview</h1>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Estimates Created</div>
            <div className="text-3xl font-bold text-gray-900">{estimatesCreated}</div>
            <div className="text-xs text-gray-400 mt-1">All time</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Total Value Quoted</div>
            <div className="text-3xl font-bold" style={{ color: '#4DA8DA' }}>{formatCurrency(totalValueQuoted)}</div>
            <div className="text-xs text-gray-400 mt-1">Across all estimates</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Awaiting Signature</div>
            <div className="text-3xl font-bold text-amber-500">{unsignedApprovals.length}</div>
            <div className="text-xs text-gray-400 mt-1">Sent, not signed</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Signed Estimates</div>
            <div className="text-3xl font-bold text-green-600">{signedApprovals.length}</div>
            <div className="text-xs text-gray-400 mt-1">Approved by client</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Estimates */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Recent Estimates</h2>
              <Link href="/history" className="text-sm font-medium hover:underline" style={{ color: '#4DA8DA' }}>View all</Link>
            </div>
            {recentEstimates.length === 0 ? (
              <div className="px-6 py-10 text-center text-gray-400 text-sm">No estimates yet</div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {recentEstimates.map((conv) => {
                  const estimate = conv.lastEstimate as Record<string, unknown> | null;
                  return (
                    <li key={conv.id}>
                      <Link
                        href={`/chat/${conv.id}`}
                        className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">
                            {conv.clientName || (estimate?.client_name as string) || 'Unnamed Client'}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{formatDate(conv.updatedAt)}</div>
                        </div>
                        <div className="text-sm font-semibold ml-4 shrink-0" style={{ color: '#4DA8DA' }}>
                          {conv.total ? formatCurrency(conv.total) : '—'}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Unsigned Estimates */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Pending Signatures</h2>
              <Link href="/approvals" className="text-sm font-medium hover:underline" style={{ color: '#4DA8DA' }}>View all</Link>
            </div>
            {unsignedApprovals.length === 0 ? (
              <div className="px-6 py-10 text-center text-gray-400 text-sm">No pending signatures</div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {unsignedApprovals.slice(0, 5).map((approval) => {
                  const estimate = approval.estimateJson as Record<string, unknown>;
                  const amount = estimate?.total ? formatCurrency(Number(estimate.total)) : '—';
                  return (
                    <li key={approval.id} className="px-6 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">
                            {approval.clientName || 'Unnamed Client'}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 truncate">{approval.clientEmail}</div>
                          <div className="text-xs text-gray-400 mt-0.5">Sent {formatDate(approval.createdAt)}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-semibold" style={{ color: '#4DA8DA' }}>{amount}</div>
                          <div className="inline-flex items-center gap-1 mt-1 bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                            Awaiting
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-6 flex gap-3 flex-wrap">
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
            style={{ background: '#4DA8DA' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Estimate
          </Link>
          <Link
            href="/history"
            className="inline-flex items-center gap-2 text-gray-700 font-semibold text-sm px-5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          >
            All Estimates
          </Link>
          <Link
            href="/approvals"
            className="inline-flex items-center gap-2 text-gray-700 font-semibold text-sm px-5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          >
            All Approvals
          </Link>
        </div>
      </main>
    </div>
  );
}
