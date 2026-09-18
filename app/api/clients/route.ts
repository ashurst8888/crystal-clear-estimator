import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clients = await prisma.client.findMany({
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ clients });
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, address, cityStateZip, phone, email } = body;

  if (!name) {
    return NextResponse.json({ error: 'Missing name' }, { status: 400 });
  }

  const client = await prisma.client.upsert({
    where: { name },
    update: {
      ...(address !== undefined && { address }),
      ...(cityStateZip !== undefined && { cityStateZip }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
    },
    create: {
      name,
      address: address ?? null,
      cityStateZip: cityStateZip ?? null,
      phone: phone ?? null,
      email: email ?? null,
    },
  });

  return NextResponse.json({ client });
}
