export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ChatInterface } from '@/components/ChatInterface';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ChatPage({ params }: Props) {
  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
  });

  if (!conversation) {
    notFound();
  }

  const messages = Array.isArray(conversation.messages)
    ? conversation.messages
    : [];

  const lastEstimate = conversation.lastEstimate ?? null;

  return (
    <ChatInterface
      conversationId={id}
      initialMessages={messages as { role: string; content: string }[]}
      initialEstimate={lastEstimate}
    />
  );
}
