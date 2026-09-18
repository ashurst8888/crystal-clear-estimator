import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { structureReferenceEstimate } from '@/lib/claude';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function extractTextFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  // For PDFs
  if (mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
    try {
      // Dynamically import to avoid bundling issues
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParseModule = await import('pdf-parse') as any;
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const data = await pdfParse(buffer);
      return data.text;
    } catch (err) {
      console.error('PDF parse error:', err);
      throw new Error('Failed to parse PDF');
    }
  }

  // For text files
  if (
    mimeType.startsWith('text/') ||
    filename.toLowerCase().endsWith('.txt') ||
    filename.toLowerCase().endsWith('.csv')
  ) {
    return buffer.toString('utf-8');
  }

  // For DOCX — basic extraction (strip XML tags)
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    filename.toLowerCase().endsWith('.docx')
  ) {
    // Basic text extraction from DOCX XML
    const text = buffer.toString('utf-8');
    // Strip XML tags
    return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Fallback: try to read as text
  return buffer.toString('utf-8');
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const filename = file.name;
    const mimeType = file.type;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text
    const text = await extractTextFromBuffer(buffer, filename, mimeType);

    if (!text || text.trim().length < 20) {
      return NextResponse.json(
        { error: 'Could not extract sufficient text from file' },
        { status: 400 },
      );
    }

    // Use Claude to structure the estimate
    const structured = await structureReferenceEstimate(text, filename);

    // Save to DB
    const record = await prisma.referenceEstimate.create({
      data: {
        jobType: structured.jobType,
        clientName: structured.clientName ?? null,
        total: structured.total ?? null,
        originalFilename: filename,
        pricingNotes: structured.pricingNotes,
        extractedJson: structured.extractedJson as Record<string, unknown>,
      },
    });

    return NextResponse.json({
      success: true,
      reference: {
        id: record.id,
        jobType: record.jobType,
        clientName: record.clientName,
        total: record.total,
        originalFilename: record.originalFilename,
        createdAt: record.createdAt,
        pricingNotes: record.pricingNotes,
      },
    });
  } catch (err) {
    console.error('Upload reference error:', err);
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
