export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export default async function ChatIndexPage() {
  // Create a new conversation and redirect to it
  const conversation = await prisma.conversation.create({
    data: {
      messages: [],
    },
  });

  redirect(`/chat/${conversation.id}`);
}
