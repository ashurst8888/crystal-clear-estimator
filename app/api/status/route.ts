import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');

  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
  }

  const record = await prisma.estimateStatus.findUnique({
    where: { conversationId },
  });

  return NextResponse.json({ status: record?.status ?? 'draft' });
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { conversationId, status } = body;

  if (!conversationId || !status) {
    return NextResponse.json({ error: 'Missing conversationId or status' }, { status: 400 });
  }

  const record = await prisma.estimateStatus.upsert({
    where: { conversationId },
    update: { status },
    create: { conversationId, status },
  });

  return NextResponse.json({ status: record.status });
}
