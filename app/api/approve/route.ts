import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateEstimatePDF } from '@/lib/pdf';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import crypto from 'crypto';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    const { token, signature, consentTimestamp } = await request.json();

    if (!token || !signature || !consentTimestamp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const approval = await prisma.estimateApproval.findUnique({ where: { token } });
    if (!approval) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    if (approval.signedAt) {
      return NextResponse.json({ error: 'Already signed' }, { status: 409 });
    }

    // Capture evidence
    const signedAt = new Date();
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Generate the base estimate PDF
    const estimate = approval.estimateJson as Record<string, unknown>;
    const basePdfBytes = await generateEstimatePDF(estimate);

    // Load it and append a signature evidence page
    const pdfDoc = await PDFDocument.load(basePdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Embed signature image
    const sigImageData = signature.replace(/^data:image\/png;base64,/, '');
    const sigImageBytes = Buffer.from(sigImageData, 'base64');
    const sigImage = await pdfDoc.embedPng(sigImageBytes);

    // Add signature evidence page
    const sigPage = pdfDoc.addPage([612, 792]);
    const { width, height } = sigPage.getSize();
    const BLUE = rgb(0.302, 0.659, 0.855);
    const DARK = rgb(0.1, 0.1, 0.1);
    const GRAY = rgb(0.5, 0.5, 0.5);
    const LIGHT = rgb(0.96, 0.97, 0.98);

    // Header bar
    sigPage.drawRectangle({ x: 0, y: height - 60, width, height: 60, color: BLUE });
    sigPage.drawText('SIGNATURE & AUDIT TRAIL', { x: 36, y: height - 38, size: 16, font: boldFont, color: rgb(1, 1, 1) });
    sigPage.drawText('Crystal Clear Cleaning & Contracting', { x: 36, y: height - 54, size: 9, font, color: rgb(1, 1, 1, 0.85) });

    let y = height - 90;

    // Document info box
    sigPage.drawRectangle({ x: 36, y: y - 70, width: width - 72, height: 75, color: LIGHT });
    sigPage.drawText('DOCUMENT', { x: 48, y: y - 14, size: 8, font: boldFont, color: GRAY });
    const invNum = estimate.invoice_number ? `Estimate #${estimate.invoice_number}` : 'Estimate';
    const clientName = (estimate.client_name as string) || '';
    const total = estimate.total ? `$${Number(estimate.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '';
    sigPage.drawText(`${invNum}${clientName ? ' — ' + clientName : ''}${total ? ' — ' + total : ''}`, { x: 48, y: y - 28, size: 11, font: boldFont, color: DARK });
    sigPage.drawText(`Date: ${estimate.date || signedAt.toLocaleDateString('en-US')}`, { x: 48, y: y - 44, size: 9, font, color: DARK });
    sigPage.drawText(`Sent to: ${approval.clientEmail}`, { x: 48, y: y - 58, size: 9, font, color: DARK });

    y -= 90;

    // Signing details box
    sigPage.drawRectangle({ x: 36, y: y - 100, width: width - 72, height: 105, color: LIGHT });
    sigPage.drawText('SIGNING DETAILS', { x: 48, y: y - 14, size: 8, font: boldFont, color: GRAY });

    const signedAtStr = signedAt.toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
    });
    const consentStr = new Date(consentTimestamp).toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
    });

    sigPage.drawText(`Signed:`, { x: 48, y: y - 30, size: 9, font: boldFont, color: DARK });
    sigPage.drawText(signedAtStr, { x: 120, y: y - 30, size: 9, font, color: DARK });
    sigPage.drawText(`Consent:`, { x: 48, y: y - 46, size: 9, font: boldFont, color: DARK });
    sigPage.drawText(consentStr, { x: 120, y: y - 46, size: 9, font, color: DARK });
    sigPage.drawText(`IP Address:`, { x: 48, y: y - 62, size: 9, font: boldFont, color: DARK });
    sigPage.drawText(ipAddress, { x: 120, y: y - 62, size: 9, font, color: DARK });

    // Truncate user agent to fit
    const ua = userAgent.length > 70 ? userAgent.slice(0, 70) + '…' : userAgent;
    sigPage.drawText(`Device:`, { x: 48, y: y - 78, size: 9, font: boldFont, color: DARK });
    sigPage.drawText(ua, { x: 120, y: y - 78, size: 9, font, color: DARK });

    sigPage.drawText(`Consent text:`, { x: 48, y: y - 94, size: 9, font: boldFont, color: DARK });
    sigPage.drawText('"I agree to sign this estimate electronically and agree to its terms."', { x: 48, y: y - 106, size: 8, font, color: GRAY });

    y -= 124;

    // Signature image
    sigPage.drawText('SIGNATURE', { x: 48, y: y - 14, size: 8, font: boldFont, color: GRAY });
    const sigDims = sigImage.scaleToFit(240, 80);
    sigPage.drawImage(sigImage, { x: 48, y: y - 30 - sigDims.height, width: sigDims.width, height: sigDims.height });
    sigPage.drawLine({ start: { x: 48, y: y - 34 - sigDims.height }, end: { x: 300, y: y - 34 - sigDims.height }, thickness: 0.5, color: GRAY });
    sigPage.drawText(clientName || 'Client Signature', { x: 48, y: y - 48 - sigDims.height, size: 8, font, color: GRAY });

    y -= 60 + sigDims.height;

    // Hash placeholder — we'll compute it after saving
    sigPage.drawText('DOCUMENT INTEGRITY', { x: 48, y: y - 14, size: 8, font: boldFont, color: GRAY });
    sigPage.drawText('SHA-256 hash computed and stored at time of signing. Contact Crystal Clear', { x: 48, y: y - 28, size: 8, font, color: GRAY });
    sigPage.drawText('Cleaning & Contracting to verify document integrity.', { x: 48, y: y - 40, size: 8, font, color: GRAY });

    // Legal statement
    sigPage.drawRectangle({ x: 36, y: 36, width: width - 72, height: 44, color: LIGHT });
    sigPage.drawText(
      'This document was signed electronically. Valid under the federal E-SIGN Act (15 U.S.C. § 7001) and Ohio UETA (ORC § 1306).',
      { x: 48, y: 68, size: 8, font, color: DARK }
    );
    sigPage.drawText(
      'The signature, IP address, timestamp, and consent record constitute a legally binding electronic signature.',
      { x: 48, y: 54, size: 8, font, color: DARK }
    );
    sigPage.drawText('Crystal Clear Cleaning & Contracting  |  (513) 614-8080  |  crystalclearcontractors.com', { x: 48, y: 42, size: 8, font, color: GRAY });

    // Save the signed PDF
    const signedPdfBytes = await pdfDoc.save();
    const signedPdfHash = crypto.createHash('sha256').update(signedPdfBytes).digest('hex');
    const signedPdfBase64 = Buffer.from(signedPdfBytes).toString('base64');

    // Save everything to DB
    await prisma.estimateApproval.update({
      where: { token },
      data: {
        signature,
        signedAt,
        approvedAt: signedAt,
        ipAddress,
        userAgent,
        consentGiven: true,
        consentTimestamp: new Date(consentTimestamp),
        signedPdfHash,
        signedPdfBytes: signedPdfBase64,
      },
    });

    // Send notification email to business owner
    try {
      const resendApiKey = process.env.RESEND_API_KEY;
      const fromEmail = process.env.FROM_EMAIL;
      if (resendApiKey && fromEmail) {
        const resend = new Resend(resendApiKey);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const signedPdfUrl = `${appUrl}/api/signed-pdf?id=${approval.id}`;
        const notifTotal = estimate.total
          ? `$${Number(estimate.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          : '';
        const invNum = estimate.invoice_number ? `#${estimate.invoice_number}` : '';
        const signedAtStr = signedAt.toLocaleString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
        });

        const notifHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
  <div style="background:#22c55e;padding:20px 32px;border-radius:8px 8px 0 0;text-align:center">
    <p style="margin:0;color:#fff;font-size:22px;font-weight:bold">✅ Estimate Signed!</p>
  </div>
  <div style="padding:32px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr><td style="padding:8px 0;font-size:14px;color:#6b7280;width:140px">Client Name</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#111">${approval.clientName}</td></tr>
      <tr><td style="padding:8px 0;font-size:14px;color:#6b7280">Client Email</td><td style="padding:8px 0;font-size:14px;color:#111">${approval.clientEmail}</td></tr>
      <tr><td style="padding:8px 0;font-size:14px;color:#6b7280">Estimate Number</td><td style="padding:8px 0;font-size:14px;color:#111">${invNum || 'N/A'}</td></tr>
      <tr><td style="padding:8px 0;font-size:14px;color:#6b7280">Total</td><td style="padding:8px 0;font-size:14px;font-weight:700;color:#22c55e">${notifTotal || 'N/A'}</td></tr>
      <tr><td style="padding:8px 0;font-size:14px;color:#6b7280">Signed At</td><td style="padding:8px 0;font-size:14px;color:#111">${signedAtStr}</td></tr>
      <tr><td style="padding:8px 0;font-size:14px;color:#6b7280">IP Address</td><td style="padding:8px 0;font-size:14px;color:#111">${ipAddress}</td></tr>
    </table>
    <div style="text-align:center;margin:24px 0">
      <a href="${signedPdfUrl}" style="background:#4DA8DA;color:white;text-decoration:none;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:8px;display:inline-block">
        Download Signed PDF
      </a>
    </div>
    <p style="color:#6b7280;font-size:13px;text-align:center;margin:0">Log in to the Crystal Clear Estimator to view the full audit trail.</p>
  </div>
</div>`;

        await resend.emails.send({
          from: `Crystal Clear Estimator <${fromEmail}>`,
          to: [fromEmail],
          subject: `✅ ${approval.clientName} signed their estimate — ${notifTotal}`,
          html: notifHtml,
        });
      }
    } catch (notifErr) {
      console.error('Notification email error (non-fatal):', notifErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Approve API error:', err);
    return NextResponse.json({ error: 'Failed to save signature' }, { status: 500 });
  }
}
