import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import Groq from 'groq-sdk';
import Anthropic from '@anthropic-ai/sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const mimeType = file.type;

    // ── Image → Claude vision ──
    if (mimeType.startsWith('image/')) {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              {
                type: 'text',
                text: 'You are helping a contractor describe a job site for an estimate. Look at this photo and describe what work needs to be done, what materials you see, dimensions if visible, and anything relevant to pricing a contracting job. Be specific and practical. Write it as a job description the contractor can use to build an estimate.',
              },
            ],
          },
        ],
      });

      const content = response.content[0];
      const transcript = content.type === 'text' ? content.text : '';
      return NextResponse.json({ transcript });
    }

    // ── Audio/Video → Groq Whisper ──
    if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
      const transcription = await groq.audio.transcriptions.create({
        file,
        model: 'whisper-large-v3',
        language: 'en',
      });
      return NextResponse.json({ transcript: transcription.text });
    }

    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error('Upload media error:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Failed to process file' }, { status: 500 });
  }
}
