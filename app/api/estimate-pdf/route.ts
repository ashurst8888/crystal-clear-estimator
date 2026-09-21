import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateEstimatePDF } from '@/lib/pdf';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const approval = await prisma.estimateApproval.findUnique({ where: { token } });
  if (!approval) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const estimate = approval.estimateJson as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBytes = await generateEstimatePDF(estimate as any);
  const clientName = (estimate.client_name as string) || 'Estimate';
  const invNum = estimate.invoice_number ? `_${estimate.invoice_number}` : '';
  const filename = `Crystal-Clear-Estimate${invNum}_${clientName.replace(/\s+/g, '-')}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
