import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const references = await prisma.referenceEstimate.findMany({
      select: {
        id: true,
        jobType: true,
        clientName: true,
        total: true,
        originalFilename: true,
        createdAt: true,
        pricingNotes: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ references });
  } catch (err) {
    console.error('References GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
