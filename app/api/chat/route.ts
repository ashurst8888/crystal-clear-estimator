import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { chatWithClaude } from '@/lib/claude';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function extractEstimateJSON(text: string): Record<string, unknown> | null {
  // Find the first { and last } to extract JSON even if Claude adds surrounding text
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (Array.isArray(parsed.line_items)) return parsed;
    return null;
  } catch {
    return null;
  }
}


function buildReferenceContext(
  references: { jobType: string; pricingNotes: string; clientName?: string | null; total?: number | null }[],
): string {
  if (references.length === 0) return '';
  return references
    .map(
      (r, idx) =>
        `[Reference ${idx + 1}] ${r.jobType}${r.clientName ? ` (${r.clientName})` : ''}${r.total ? ` — $${r.total.toLocaleString()}` : ''}:\n${r.pricingNotes}`,
    )
    .join('\n\n');
}

function scoreReference(
  ref: { jobType: string; pricingNotes: string },
  messageWords: string[],
): number {
  const haystack = `${ref.jobType} ${ref.pricingNotes}`.toLowerCase();
  let score = 0;
  for (const word of messageWords) {
    if (word.length > 3 && haystack.includes(word.toLowerCase())) {
      score++;
    }
  }
  return score;
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { conversationId, message } = body;

    if (!conversationId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Load or create conversation
    let conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { id: conversationId, messages: [] },
      });
    }

    const existingMessages = (Array.isArray(conversation.messages)
      ? conversation.messages
      : []) as Message[];

    // Query references based on message content
    const allReferences = await prisma.referenceEstimate.findMany({
      select: {
        id: true,
        jobType: true,
        pricingNotes: true,
        clientName: true,
        total: true,
      },
    });

    // Score and pick top 3 most relevant
    const messageWords = message.split(/\s+/);
    type RefRecord = { jobType: string; pricingNotes: string; clientName: string | null; total: number | null; id: string };
    const scored = (allReferences as RefRecord[])
      .map((r: RefRecord) => ({ ref: r, score: scoreReference(r, messageWords) }))
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, 3)
      .filter((s: { score: number }) => s.score > 0 || allReferences.length <= 3)
      .map((s: { ref: RefRecord }) => s.ref);

    // If we got no score matches, just take first 3
    const topRefs = scored.length > 0 ? scored : allReferences.slice(0, 3);
    const referenceContext = buildReferenceContext(topRefs);

    // Build message history for Claude
    const updatedMessages: Message[] = [
      ...existingMessages,
      { role: 'user', content: message },
    ];

    const assistantResponse = await chatWithClaude(updatedMessages, referenceContext);

    // Check if assistant returned an estimate JSON
    let estimateData: Record<string, unknown> | null = null;
    let clientName: string | undefined;
    let total: number | undefined;

    estimateData = extractEstimateJSON(assistantResponse);
    if (estimateData) {
      // Always stamp today's date
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const yyyy = now.getFullYear();
      estimateData.date = `${mm}/${dd}/${yyyy}`;

      clientName = (estimateData?.client_name as string) || undefined;
      const rawTotal = estimateData?.total;
      total = typeof rawTotal === 'number' ? rawTotal : undefined;

      // Auto-assign invoice number if not present
      if (!estimateData.invoice_number) {
        const allConversations = await prisma.conversation.findMany({ select: { lastEstimate: true } });
        const invoiceNumbers: number[] = [];
        for (const c of allConversations) {
          const le = c.lastEstimate as Record<string, unknown> | null;
          const n = le?.invoice_number;
          if (typeof n === 'string' && /^\d+$/.test(n)) {
            invoiceNumbers.push(Number(n));
          }
        }
        const maxInvoice = invoiceNumbers.length > 0 ? Math.max(...invoiceNumbers) : 999;
        estimateData.invoice_number = String(maxInvoice + 1);
      }
    }

    // Auto-save client if estimate has a client name
    if (estimateData && estimateData.client_name) {
      try {
        const clientName = estimateData.client_name as string;
        const clientAddress = (estimateData.client_address as string) ?? undefined;
        const clientCityStateZip = (estimateData.client_city_state_zip as string) ?? undefined;
        const clientPhone = (estimateData.client_phone as string) ?? undefined;
        await prisma.client.upsert({
          where: { name: clientName },
          update: {
            ...(clientAddress && { address: clientAddress }),
            ...(clientCityStateZip && { cityStateZip: clientCityStateZip }),
            ...(clientPhone && { phone: clientPhone }),
          },
          create: {
            name: clientName,
            address: clientAddress ?? null,
            cityStateZip: clientCityStateZip ?? null,
            phone: clientPhone ?? null,
          },
        });
      } catch {
        // Non-fatal — don't block the response
      }
    }

    // Auto-save estimate as a reference for future pricing
    if (estimateData && Array.isArray(estimateData.line_items)) {
      try {
        const jobType = (estimateData.summary as string)
          || (estimateData.line_items as { description?: string }[])[0]?.description
          || 'Estimate';
        const pricingNotes = (estimateData.line_items as { description?: string; details?: string; total?: number }[])
          .map((item) => `${item.description || ''}${item.details ? ': ' + item.details : ''}${item.total ? ' — $' + item.total : ''}`)
          .join('\n');
        await prisma.referenceEstimate.create({
          data: {
            jobType: jobType.slice(0, 200),
            clientName: (estimateData.client_name as string) || null,
            extractedJson: estimateData,
            pricingNotes,
            total: typeof estimateData.total === 'number' ? estimateData.total : null,
            originalFilename: null,
          },
        });
      } catch {
        // Non-fatal
      }
    }

    const finalMessages: Message[] = [
      ...updatedMessages,
      { role: 'assistant', content: assistantResponse },
    ];

    // Save conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        messages: finalMessages,
        lastEstimate: estimateData ?? conversation.lastEstimate ?? undefined,
        clientName: clientName ?? conversation.clientName ?? undefined,
        total: total ?? conversation.total ?? undefined,
      },
    });

    return NextResponse.json({
      message: assistantResponse,
      estimate: estimateData,
      conversationId,
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
