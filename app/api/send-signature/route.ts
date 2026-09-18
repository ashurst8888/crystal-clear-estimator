import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { generateEstimatePDF } from '@/lib/pdf';
import { prisma } from '@/lib/prisma';
import * as HelloSign from '@dropbox/sign';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { estimate, signerName, signerEmail } = await request.json();

    if (!estimate || !signerName || !signerEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.DROPBOX_SIGN_API_KEY) {
      return NextResponse.json({ error: 'Dropbox Sign API key not configured' }, { status: 500 });
    }

    const pdfBytes = await generateEstimatePDF(estimate);
    const pdfBuffer = Buffer.from(pdfBytes);

    const clientName = estimate.client_name || 'Client';
    const total = estimate.total
      ? `$${Number(estimate.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      : '';
    const date = estimate.date || new Date().toLocaleDateString('en-US');
    const invNum = estimate.invoice_number ? `#${estimate.invoice_number}` : '';
    const filename = `Crystal-Clear-Estimate-${date.replace(/\//g, '-')}.pdf`;

    // Write PDF to temp file so Dropbox Sign SDK can stream it
    const tmpPath = path.join(os.tmpdir(), `${Date.now()}-${filename}`);
    fs.writeFileSync(tmpPath, pdfBuffer);

    let signatureRequestId: string | undefined;
    try {
      const signatureApi = new HelloSign.SignatureRequestApi();
      signatureApi.username = process.env.DROPBOX_SIGN_API_KEY;

      const data: HelloSign.SignatureRequestSendRequest = {
        title: `Crystal Clear Estimate ${invNum} — ${clientName}`,
        subject: `Your Estimate from Crystal Clear Cleaning & Contracting`,
        message: `Hi ${signerName}, please review and sign your estimate${total ? ' for ' + total : ''}. If you have any questions, call us at (513) 614-8080.`,
        signers: [{ emailAddress: signerEmail, name: signerName, order: 0 }],
        ccEmailAddresses: process.env.FROM_EMAIL ? [process.env.FROM_EMAIL] : [],
        files: [fs.createReadStream(tmpPath)],
        signingOptions: {
          draw: true,
          type: true,
          upload: true,
          phone: false,
          defaultType: HelloSign.SubSigningOptions.DefaultTypeEnum.Type,
        },
        testMode: true,
      };

      const response = await signatureApi.signatureRequestSend(data);
      signatureRequestId = response.body.signatureRequest?.signatureRequestId;
    } finally {
      fs.unlinkSync(tmpPath);
    }

    await prisma.estimateApproval.create({
      data: {
        token: signatureRequestId || crypto.randomUUID(),
        clientName,
        clientEmail: signerEmail,
        estimateJson: estimate,
        envelopeId: signatureRequestId,
      },
    });

    return NextResponse.json({
      success: true,
      signatureRequestId,
      message: `Estimate sent to ${signerEmail} for signature.`,
    });
  } catch (err: unknown) {
    console.error('Send signature error:', err);
    const message = err instanceof Error ? err.message : 'Failed to send for signature';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
