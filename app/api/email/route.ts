import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { generateEstimatePDF } from '@/lib/pdf';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { estimateJson, toEmail, message } = body;

    if (!estimateJson || !toEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate PDF
    const pdfBytes = await generateEstimatePDF(estimateJson);
    const pdfBuffer = Buffer.from(pdfBytes);

    const clientName = estimateJson.client_name || 'Customer';
    const invNum = estimateJson.invoice_number ? `#${estimateJson.invoice_number}` : '';
    const total = estimateJson.total
      ? `$${Number(estimateJson.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      : '';

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = process.env.FROM_EMAIL || 'noreply@crystalclearcontractors.com';
    const filename = `estimate_${invNum ? invNum.replace('#', '') + '_' : ''}${clientName.replace(/\s+/g, '_')}.pdf`;

    // Generate approval token and save to DB
    const token = crypto.randomBytes(32).toString('hex');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const approvalLink = `${appUrl}/approve/${token}`;

    await prisma.estimateApproval.create({
      data: {
        token,
        clientName,
        clientEmail: toEmail,
        estimateJson,
      },
    });

    const approvalSection = `\n\n✍️ SIGN THIS ESTIMATE:\n${approvalLink}\n\nTap the link above, check the consent box, and sign with your finger. No app or account needed — takes about 30 seconds.`;

    const emailBody = message
      ? `${message}${approvalSection}\n\nPlease find your estimate attached.`
      : `Dear ${clientName},\n\nPlease find your estimate ${invNum}${total ? ` for ${total}` : ''} attached.\n\nOnce you've reviewed it, tap the button below to approve:${approvalSection}\n\nIf you have any questions, call us at (513) 614-8080.\n\nThank you for choosing Crystal Clear Cleaning & Contracting!\n\nPhone: (513) 614-8080\nEmail: crystalclearcontracting@yahoo.com\nWebsite: crystalclearcontractors.com`;

    // Embed logo as base64 so it shows in email without needing a public URL
    let logoDataUrl = '';
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.png');
      const logoBytes = fs.readFileSync(logoPath);
      logoDataUrl = `data:image/png;base64,${logoBytes.toString('base64')}`;
    } catch {
      // logo not found — fall back to text only
    }

    const htmlBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
  <div style="background:#4DA8DA;padding:20px 32px;border-radius:8px 8px 0 0;text-align:center">
    ${logoDataUrl
      ? `<img src="${logoDataUrl}" alt="Crystal Clear" style="height:70px;width:auto;display:block;margin:0 auto 8px" />`
      : ''
    }
    <p style="margin:0;color:rgba(255,255,255,0.9);font-size:14px;font-weight:600;letter-spacing:0.5px">Crystal Clear Cleaning &amp; Contracting</p>
  </div>
  <div style="padding:32px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
    <p style="margin-top:0">Dear ${clientName},</p>
    <p>Please find your estimate ${invNum}${total ? ` for <strong>${total}</strong>` : ''} attached to this email.</p>
    ${message ? `<p>${message}</p>` : ''}
    ${(() => {
      const lineItems: { description?: string; details?: string; total?: number | string }[] =
        Array.isArray(estimateJson.line_items) ? estimateJson.line_items : [];
      const rows = lineItems.map((item) => {
        const itemTotal = item.total !== undefined && item.total !== null
          ? `$${Number(item.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : '';
        return `<tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:12px 4px;vertical-align:top">
            <div style="font-weight:600;font-size:14px;color:#111">${item.description || ''}</div>
            ${item.details ? `<div style="font-size:12px;color:#6b7280;margin-top:4px;white-space:pre-line">${item.details}</div>` : ''}
          </td>
          <td style="padding:12px 4px;text-align:right;vertical-align:top;font-weight:700;font-size:14px;color:#111;white-space:nowrap">${itemTotal}</td>
        </tr>`;
      }).join('');

      const paymentSchedule = Array.isArray(estimateJson.payment_schedule) && estimateJson.payment_schedule.length > 0
        ? `<div style="margin-top:16px"><div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Payment Schedule</div>${
            (estimateJson.payment_schedule as { label?: string; amount?: number | string; due?: string }[]).map((p) =>
              `<div style="display:flex;justify-content:space-between;font-size:13px;color:#333;margin-bottom:4px"><span>${p.label || p.due || ''}</span><span style="font-weight:600">$${Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>`
            ).join('')
          }</div>`
        : '';

      const scopeOfWork = estimateJson.scope_of_work
        ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb"><div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Scope of Work</div><div style="font-size:13px;color:#333;white-space:pre-line">${estimateJson.scope_of_work}</div></div>`
        : '';

      return `<div style="background:#f9fafb;border-radius:8px;padding:20px;margin:24px 0">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:2px solid #e5e7eb">
              <th style="text-align:left;padding:8px 4px;font-size:13px;color:#6b7280;font-weight:600">Description</th>
              <th style="text-align:right;padding:8px 4px;font-size:13px;color:#6b7280;font-weight:600">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="border-top:2px solid #4DA8DA;margin-top:12px;padding-top:12px;text-align:right">
          <span style="font-size:18px;font-weight:bold;color:#4DA8DA">${total}</span>
        </div>
        ${paymentSchedule}
        ${scopeOfWork}
      </div>`;
    })()}
    <p>Once you've had a chance to review it, tap the button below to approve:</p>
    <div style="text-align:center;margin:32px 0">
      <a href="${approvalLink}" style="background:#4DA8DA;color:white;text-decoration:none;font-size:18px;font-weight:bold;padding:16px 40px;border-radius:10px;display:inline-block">
        ✍️ Sign This Estimate
      </a>
    </div>
    <p style="color:#6b7280;font-size:14px">Sign with your finger — no account or app needed.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
    <p style="color:#6b7280;font-size:14px;margin:0">Questions? Call us at <strong>(513) 614-8080</strong><br/>
    crystalclearcontracting@yahoo.com &nbsp;|&nbsp; crystalclearcontractors.com</p>
  </div>
</div>`;

    await resend.emails.send({
      from: `Crystal Clear Contracting <${fromEmail}>`,
      to: [toEmail],
      subject: `Your Estimate ${invNum} — Crystal Clear Cleaning & Contracting`,
      text: emailBody,
      html: htmlBody,
      attachments: [
        {
          filename,
          content: pdfBuffer,
        },
      ],
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Email API error:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
