import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const approval = await prisma.estimateApproval.findUnique({ where: { id } });

  if (!approval || !approval.signedPdfBytes) {
    return NextResponse.json({ error: 'Signed PDF not found' }, { status: 404 });
  }

  const pdfBuffer = Buffer.from(approval.signedPdfBytes, 'base64');
  const filename = `Signed-Estimate-${approval.clientName?.replace(/\s+/g, '-') || approval.id}.pdf`;

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
