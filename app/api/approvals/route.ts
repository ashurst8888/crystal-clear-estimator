import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const approvals = await prisma.estimateApproval.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        clientName: true,
        clientEmail: true,
        estimateJson: true,
        signature: true,
        signedAt: true,
        ipAddress: true,
        userAgent: true,
        consentGiven: true,
        consentTimestamp: true,
        signedPdfHash: true,
        signedPdfBytes: true,
        envelopeId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ approvals });
  } catch (err) {
    console.error('Approvals GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await prisma.estimateApproval.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Approvals DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
