import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        lastEstimate: { not: undefined },
      },
      select: {
        id: true,
        clientName: true,
        total: true,
        createdAt: true,
        updatedAt: true,
        lastEstimate: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    type ConvRecord = { id: string; clientName: string | null; total: number | null; createdAt: Date; updatedAt: Date; lastEstimate: unknown };
    const history = (conversations as ConvRecord[]).map((c: ConvRecord) => {
      const estimate = c.lastEstimate as Record<string, unknown> | null;
      return {
        id: c.id,
        clientName: c.clientName || (estimate?.client_name as string) || 'Unknown Client',
        total: c.total || (estimate?.total as number) || null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        summary: estimate?.summary as string | undefined,
        invoiceNumber: estimate?.invoice_number as string | undefined,
        date: estimate?.date as string | undefined,
      };
    });

    return NextResponse.json({ history });
  } catch (err) {
    console.error('History GET error:', err);
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

    await prisma.conversation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('History DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
