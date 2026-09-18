import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { generateEstimatePDF } from '@/lib/pdf';

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { estimate } = body;

    if (!estimate) {
      return NextResponse.json({ error: 'No estimate provided' }, { status: 400 });
    }

    const pdfBytes = await generateEstimatePDF(estimate);

    const clientName = estimate.client_name?.replace(/[^a-z0-9]/gi, '_') || 'estimate';
    const invNum = estimate.invoice_number ? `${estimate.invoice_number}_` : '';
    const filename = `estimate_${invNum}${clientName}.pdf`;

    const buffer = Buffer.from(pdfBytes);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
