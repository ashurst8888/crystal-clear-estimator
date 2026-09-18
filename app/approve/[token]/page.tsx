import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { SignaturePage } from './SignaturePage';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { token: string };
}

export default async function ApprovePage({ params }: PageProps) {
  const approval = await prisma.estimateApproval.findUnique({
    where: { token: params.token },
  });

  if (!approval) {
    notFound();
  }

  const estimate = approval.estimateJson as Record<string, unknown>;
  const invNum = estimate.invoice_number ? `#${estimate.invoice_number}` : '';
  const total = estimate.total
    ? `$${Number(estimate.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    : '';
  const date = (estimate.date as string) || '';

  return (
    <SignaturePage
      token={params.token}
      clientName={approval.clientName || ''}
      invNum={invNum}
      total={total}
      date={date}
      alreadySigned={!!approval.signedAt}
      signedAt={approval.signedAt?.toISOString()}
      estimateJson={estimate}
    />
  );
}
