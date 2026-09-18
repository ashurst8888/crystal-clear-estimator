import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export interface LineItem {
  description: string;
  rate: number;
  quantity: number;
  total: number;
  details?: string;
  includes_labor?: boolean;
  includes_material?: boolean;
  labor_only?: boolean;
  customer_pays_material?: boolean;
  notes?: string[];
  price_source?: string;
}

export interface EstimateData {
  client_name?: string;
  client_address?: string;
  client_city_state_zip?: string;
  client_phone?: string;
  invoice_number?: string;
  date?: string;
  payment_terms?: string;
  line_items: LineItem[];
  subtotal?: number;
  discount?: number;
  total?: number;
  material_breakdown?: { item: string; cost: number }[];
  material_total?: number;
  payment_schedule?: { milestone: string; amount: number }[];
  payments?: { date: string; amount: number; method: string }[];
  summary?: string;
}

// ─── Colors (matching the real estimates exactly) ─────────────────────────────
const BLACK      = rgb(0,    0,    0   );
const DARK       = rgb(0.15, 0.15, 0.15);
const GRAY       = rgb(0.45, 0.45, 0.45);
const LIGHT_GRAY = rgb(0.75, 0.75, 0.75);
const RULE_GRAY  = rgb(0.82, 0.82, 0.82);
const TITLE_GRAY = rgb(0.60, 0.60, 0.60); // "ESTIMATE" watermark color

// ─── Page geometry ───────────────────────────────────────────────────────────
const PW = 612;   // letter
const PH = 792;
const ML = 50;    // left margin
const MR = 50;    // right margin
const MT = 45;    // top margin
const MB = 45;    // bottom margin

// Table column widths  (must sum to PW - ML - MR = 512)
const COL_DESC  = 270;
const COL_RATE  = 95;
const COL_QTY   = 72;
const COL_TOTAL = 75;   // 270+95+72+75 = 512 ✓

// Standard terms — exact wording from the real estimates
const TERMS = [
  '**If paying with a credit card, there will be a 3.5% fee added to the invoice after we are notified that this is your choice of Payment.',
  '**Prices on material for future jobs may be subject to change depending on all new tariffs. If pricing is to change we will discuss prior to starting each project.',
  '**Only Scope of Work on this Contract is being Completed. If any additional work is required or requested, additional fees will apply and added to a Change-Order or the Final Invoice.',
  '**By you the Client Signing or E-Signing this Contract and agreeing to the terms of this scope listed makes this a Legal Binding Contract.',
  '**If for any reason the Contract needs to be Voided, a one-time fee of $250 is to be paid for Cancellation of this Contract.',
  '**Final Payment is due on the day of Completion. Late Fees will apply.',
  'Attached is our Business Insurance',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  for (const segment of text.split(/\r?\n/)) {
    const t = segment.trimEnd();
    if (!t) { lines.push(''); continue; }
    const words = t.split(' ');
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (font.widthOfTextAtSize(test, size) > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

// ─── Drawing context ──────────────────────────────────────────────────────────
interface Ctx {
  doc:    PDFDocument;
  pages:  PDFPage[];
  page:   PDFPage;
  y:      number;
  bold:   PDFFont;
  reg:    PDFFont;
  italic: PDFFont;
  pageNum: number;
  totalPages: number; // filled in at the end
}

function txt(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
) {
  ctx.page.drawText(text, { x, y, size, font, color });
}

function rtxt(
  ctx: Ctx,
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
) {
  const x = rightX - font.widthOfTextAtSize(text, size);
  ctx.page.drawText(text, { x, y, size, font, color });
}

function hline(page: PDFPage, x1: number, x2: number, y: number, thickness: number, color: ReturnType<typeof rgb>) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

async function addPage(ctx: Ctx): Promise<void> {
  const p = ctx.doc.addPage([PW, PH]);
  ctx.pages.push(p);
  ctx.page = p;
  ctx.pageNum++;
  ctx.y = PH - MT;
}

// Ensure `needed` points of vertical space remain; add page if not
async function ensureSpace(ctx: Ctx, needed: number): Promise<void> {
  if (ctx.y - needed < MB + 10) {
    await addPage(ctx);
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generateEstimatePDF(estimate: EstimateData): Promise<Uint8Array> {
  const doc    = await PDFDocument.create();
  const bold   = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg    = await doc.embedFont(StandardFonts.Helvetica);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const firstPage = doc.addPage([PW, PH]);
  const ctx: Ctx = {
    doc, pages: [firstPage], page: firstPage, y: PH - MT,
    bold, reg, italic, pageNum: 1, totalPages: 1,
  };

  // ════════════════════════════════════════════════════════════════════
  // PAGE 1 HEADER
  // ════════════════════════════════════════════════════════════════════

  // "ESTIMATE" — centered, light gray, at the very top
  const titleSize = 16;
  const titleText = 'ESTIMATE';
  const titleW = reg.widthOfTextAtSize(titleText, titleSize);
  txt(ctx, titleText, (PW - titleW) / 2, ctx.y, titleSize, reg, TITLE_GRAY);
  ctx.y -= 14;

  // ── Logo — top left ──
  const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  if (fs.existsSync(logoPath)) {
    const logoBytes = fs.readFileSync(logoPath);
    const logoImage = await doc.embedPng(logoBytes);
    const logoDims  = logoImage.scaleToFit(130, 70);
    ctx.page.drawImage(logoImage, {
      x: ML,
      y: ctx.y - logoDims.height,
      width:  logoDims.width,
      height: logoDims.height,
    });
  }

  // ── LEFT COLUMN: company info (below logo) ──
  const rightColX = PW - MR - 220;

  let ly = ctx.y - 80; // start below logo space
  txt(ctx, 'Crystal Clear Cleaning & Contracting', ML, ly, 10, bold, BLACK);
  ly -= 14;
  txt(ctx, '7561 Easy St. , Unit D', ML, ly, 9, reg, DARK);
  ly -= 12;
  txt(ctx, 'Mason, OH 45040', ML, ly, 9, reg, DARK);
  ly -= 12;
  txt(ctx, 'Phone: (513) 614-8080', ML, ly, 9, reg, DARK);
  ly -= 12;
  txt(ctx, 'Email: crystalclearcontracting@yahoo.com', ML, ly, 9, reg, DARK);
  ly -= 12;
  txt(ctx, 'Web: crystalclearcontractors.com', ML, ly, 9, reg, DARK);
  ly -= 12;

  // ── RIGHT COLUMN: "Prepared For" + client info + estimate # / date ──
  let ry = ctx.y;

  // "Prepared For" — bold, right side
  rtxt(ctx, 'Prepared For', PW - MR, ry, 10, bold, BLACK);
  ry -= 18;

  if (estimate.client_name) {
    rtxt(ctx, estimate.client_name, PW - MR, ry, 10, reg, DARK);
    ry -= 14;
  }
  if (estimate.client_address) {
    rtxt(ctx, estimate.client_address, PW - MR, ry, 9, reg, DARK);
    ry -= 12;
  }
  if (estimate.client_city_state_zip) {
    rtxt(ctx, estimate.client_city_state_zip, PW - MR, ry, 9, reg, DARK);
    ry -= 12;
  }
  if (estimate.client_phone) {
    rtxt(ctx, estimate.client_phone, PW - MR, ry, 9, reg, DARK);
    ry -= 12;
  }

  // Estimate # and Date — label left of right column, value right-aligned
  ry -= 6;
  const labelX = rightColX;
  if (estimate.invoice_number) {
    txt(ctx, 'Estimate #', labelX, ry, 9, reg, DARK);
    rtxt(ctx, estimate.invoice_number, PW - MR, ry, 9, reg, DARK);
    ry -= 13;
  }
  if (estimate.date) {
    txt(ctx, 'Date', labelX, ry, 9, reg, DARK);
    rtxt(ctx, estimate.date, PW - MR, ry, 9, reg, DARK);
    ry -= 13;
  }

  // Move y to below the taller of the two columns
  ctx.y = Math.min(ly, ry) - 14;

  // ── Full-width divider ──
  hline(ctx.page, ML, PW - MR, ctx.y, 0.75, LIGHT_GRAY);
  ctx.y -= 12;

  // ════════════════════════════════════════════════════════════════════
  // TABLE HEADER ROW
  // ════════════════════════════════════════════════════════════════════
  const TH_SIZE = 9.5;

  txt(ctx, 'Description', ML, ctx.y, TH_SIZE, bold, BLACK);
  rtxt(ctx, 'Rate',     ML + COL_DESC + COL_RATE,             ctx.y, TH_SIZE, bold, BLACK);
  // "Quantity" centered in its column
  const qhW = bold.widthOfTextAtSize('Quantity', TH_SIZE);
  txt(ctx, 'Quantity', ML + COL_DESC + COL_RATE + (COL_QTY - qhW) / 2, ctx.y, TH_SIZE, bold, BLACK);
  rtxt(ctx, 'Total',   ML + COL_DESC + COL_RATE + COL_QTY + COL_TOTAL, ctx.y, TH_SIZE, bold, BLACK);

  ctx.y -= 4;
  hline(ctx.page, ML, PW - MR, ctx.y, 0.75, BLACK);
  ctx.y -= 12;

  // ════════════════════════════════════════════════════════════════════
  // LINE ITEMS
  // ════════════════════════════════════════════════════════════════════
  const ITEM_SIZE    = 9;
  const DETAIL_SIZE  = 9;
  const HEADER_SIZE  = 9;   // ALL-CAPS section headers
  const LINE_H       = 13;
  const HEADER_H     = 14;  // section headers get a bit more space
  const ROW_PAD_TOP  = 8;
  const ROW_PAD_BOT  = 10;

  const descMaxW   = COL_DESC - 6;
  const detailMaxW = COL_DESC - 6;
  const bulletIndent = 8; // indent for • lines

  // Classify each raw detail line
  type DetailLine = { kind: 'header' | 'bullet' | 'note' | 'plain' | 'blank'; text: string; wrappedLines: string[] };

  function classifyDetailLines(raw: string): DetailLine[] {
    const result: DetailLine[] = [];
    const segments = raw.split(/\r?\n/);
    for (const seg of segments) {
      const t = seg.trimEnd();
      if (!t) {
        result.push({ kind: 'blank', text: '', wrappedLines: [''] });
        continue;
      }
      // ALL-CAPS section header (no leading bullet, mostly uppercase letters)
      const isHeader = /^[A-Z][A-Z\s&\/\-]+$/.test(t) && t === t.toUpperCase() && t.length > 2;
      if (isHeader) {
        result.push({ kind: 'header', text: t, wrappedLines: wrap(t, bold, HEADER_SIZE, detailMaxW) });
        continue;
      }
      // Bullet line
      if (t.startsWith('•') || t.startsWith('-')) {
        const content = t.replace(/^[•\-]\s*/, '');
        const wrapped = wrap(content, reg, DETAIL_SIZE, detailMaxW - bulletIndent);
        result.push({ kind: 'bullet', text: content, wrappedLines: wrapped });
        continue;
      }
      // Note line (* prefix)
      if (t.startsWith('*')) {
        const wrapped = wrap(t, reg, DETAIL_SIZE, detailMaxW);
        result.push({ kind: 'note', text: t, wrappedLines: wrapped });
        continue;
      }
      // Plain line
      const wrapped = wrap(t, reg, DETAIL_SIZE, detailMaxW);
      result.push({ kind: 'plain', text: t, wrappedLines: wrapped });
    }
    return result;
  }

  for (let ri = 0; ri < estimate.line_items.length; ri++) {
    const item = estimate.line_items[ri];

    // Description (bold, top of table cell)
    const descLines = wrap(item.description, bold, ITEM_SIZE, descMaxW);

    // Parse details into classified lines
    const detailClassified: DetailLine[] = item.details ? classifyDetailLines(item.details) : [];

    // Labor/material lines
    const badgeLines: string[] = [];
    if (item.labor_only) {
      badgeLines.push('Labor Only');
    } else {
      if (item.includes_labor && item.includes_material) {
        badgeLines.push('Includes all Labor');
        badgeLines.push('Includes all Material');
      } else if (item.includes_labor) {
        badgeLines.push('Includes all Labor');
      } else if (item.includes_material) {
        badgeLines.push('Includes all Material');
      }
    }
    if (item.customer_pays_material) badgeLines.push('Customer to Pay for Material');

    // Notes from the notes array
    const noteLines: string[] = [];
    for (const n of (item.notes || [])) {
      const raw = n.startsWith('*') ? n : '*' + n;
      noteLines.push(...wrap(raw, reg, DETAIL_SIZE, detailMaxW));
    }

    // Calculate total height needed
    let totalLines = descLines.length;
    if (detailClassified.length > 0) {
      totalLines += 0.5; // gap before details
      for (const dl of detailClassified) {
        totalLines += dl.wrappedLines.length * (dl.kind === 'header' ? HEADER_H / LINE_H : 1);
        if (dl.kind === 'blank') totalLines += 0.3;
      }
    }
    if (badgeLines.length > 0) totalLines += 0.5 + badgeLines.length;
    if (noteLines.length > 0) totalLines += 0.5 + noteLines.length;

    const rowH = ROW_PAD_TOP + Math.ceil(totalLines) * LINE_H + ROW_PAD_BOT;

    await ensureSpace(ctx, rowH + 20);

    let ty = ctx.y - ROW_PAD_TOP - (LINE_H - ITEM_SIZE);

    // ── Description (bold) ──
    for (const line of descLines) {
      txt(ctx, line, ML, ty, ITEM_SIZE, bold, DARK);
      ty -= LINE_H;
    }

    // ── Detail lines ──
    if (detailClassified.length > 0) {
      ty -= 4; // gap between description and details
      for (const dl of detailClassified) {
        if (dl.kind === 'blank') { ty -= 4; continue; }

        if (dl.kind === 'header') {
          // ALL-CAPS section header — bold, small gap above
          ty -= 2;
          for (const wl of dl.wrappedLines) {
            txt(ctx, wl, ML, ty, HEADER_SIZE, bold, DARK);
            ty -= HEADER_H;
          }
          continue;
        }

        if (dl.kind === 'bullet') {
          // Bullet point — draw • then indented text
          for (let wi = 0; wi < dl.wrappedLines.length; wi++) {
            if (wi === 0) txt(ctx, '\u2022', ML, ty, DETAIL_SIZE, reg, DARK);
            txt(ctx, dl.wrappedLines[wi], ML + bulletIndent, ty, DETAIL_SIZE, reg, DARK);
            ty -= LINE_H;
          }
          continue;
        }

        if (dl.kind === 'note') {
          for (const wl of dl.wrappedLines) {
            txt(ctx, wl, ML, ty, DETAIL_SIZE, italic, DARK);
            ty -= LINE_H;
          }
          continue;
        }

        // plain
        for (const wl of dl.wrappedLines) {
          txt(ctx, wl, ML, ty, DETAIL_SIZE, reg, DARK);
          ty -= LINE_H;
        }
      }
    }

    // ── Labor/material badge lines ──
    if (badgeLines.length > 0) {
      ty -= 4;
      for (const line of badgeLines) {
        txt(ctx, line, ML, ty, DETAIL_SIZE, reg, DARK);
        ty -= LINE_H;
      }
    }

    // ── Notes from notes array ──
    if (noteLines.length > 0) {
      ty -= 4;
      for (const line of noteLines) {
        txt(ctx, line, ML, ty, DETAIL_SIZE, italic, DARK);
        ty -= LINE_H;
      }
    }

    // Rate / Qty / Total — top-right of the row
    const numY = ctx.y - ROW_PAD_TOP - (LINE_H - ITEM_SIZE);
    const rateStr  = fmt(item.rate);
    const totalStr = fmt(item.total);
    const qtyStr   = String(item.quantity ?? 1);

    rtxt(ctx, rateStr,  ML + COL_DESC + COL_RATE,                       numY, ITEM_SIZE, reg, DARK);
    const qW = reg.widthOfTextAtSize(qtyStr, ITEM_SIZE);
    txt(ctx, qtyStr, ML + COL_DESC + COL_RATE + (COL_QTY - qW) / 2,    numY, ITEM_SIZE, reg, DARK);
    rtxt(ctx, totalStr, ML + COL_DESC + COL_RATE + COL_QTY + COL_TOTAL, numY, ITEM_SIZE, reg, DARK);

    ctx.y -= rowH;

    // Thin divider after each row
    hline(ctx.page, ML, PW - MR, ctx.y, 0.5, RULE_GRAY);
    ctx.y -= 2;
  }

  // ════════════════════════════════════════════════════════════════════
  // SUBTOTAL / TOTAL
  // ════════════════════════════════════════════════════════════════════
  ctx.y -= 14;
  await ensureSpace(ctx, 80);

  // Center label column, right-align value column
  const totLabelX = ML + COL_DESC + COL_RATE - 10;
  const totValRX  = PW - MR;  // right edge for values

  if (estimate.subtotal != null) {
    txt(ctx, 'Subtotal', totLabelX, ctx.y, 9.5, bold, DARK);
    rtxt(ctx, fmt(estimate.subtotal), totValRX, ctx.y, 9.5, reg, DARK);
    ctx.y -= 3;
    hline(ctx.page, totLabelX, PW - MR, ctx.y, 0.5, LIGHT_GRAY);
    ctx.y -= 14;
  }

  if (estimate.discount && estimate.discount > 0) {
    txt(ctx, 'Discount', totLabelX, ctx.y, 9.5, bold, DARK);
    rtxt(ctx, '-' + fmt(estimate.discount), totValRX, ctx.y, 9.5, reg, DARK);
    ctx.y -= 14;
  }

  const totalVal = estimate.total ?? estimate.subtotal ?? 0;
  txt(ctx, 'Total', totLabelX, ctx.y, 10, bold, DARK);
  rtxt(ctx, fmt(totalVal), totValRX, ctx.y, 10, bold, DARK);
  ctx.y -= 18;

  // ════════════════════════════════════════════════════════════════════
  // TERMS PAGE — always starts on its own section (new page if needed)
  // ════════════════════════════════════════════════════════════════════
  await ensureSpace(ctx, 220);

  ctx.y -= 10;
  hline(ctx.page, ML, PW - MR, ctx.y, 0.5, LIGHT_GRAY);
  ctx.y -= 14;

  const termMaxW = PW - ML - MR;
  for (const term of TERMS) {
    const lines = wrap(term, reg, 8.5, termMaxW);
    await ensureSpace(ctx, lines.length * 13 + 8);
    for (const l of lines) {
      txt(ctx, l, ML, ctx.y, 8.5, reg, DARK);
      ctx.y -= 12;
    }
    ctx.y -= 4; // gap between terms
  }

  // ════════════════════════════════════════════════════════════════════
  // PAGE NUMBERS — "Page N of N" centered at the bottom of every page
  // ════════════════════════════════════════════════════════════════════
  const totalPages = ctx.pages.length;
  for (let i = 0; i < ctx.pages.length; i++) {
    const label = `Page ${i + 1} of ${totalPages}`;
    const lw = reg.widthOfTextAtSize(label, 8);
    ctx.pages[i].drawText(label, {
      x: (PW - lw) / 2, y: MB - 12, size: 8, font: reg, color: GRAY,
    });
  }

  return doc.save();
}
