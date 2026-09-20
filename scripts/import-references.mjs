import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Load env
const envPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('Missing DATABASE_URL'); process.exit(1); }

const { PrismaClient } = await import('@prisma/client');
const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs').catch(() => import('pdfjs-dist'));
const Anthropic = (await import('@anthropic-ai/sdk')).default;

const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const folderPath = path.join(rootDir, 'Crystal Clear past estimates');
const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.pdf'));

console.log(`Found ${files.length} PDFs to import...\n`);

let imported = 0;
let skipped = 0;

for (const file of files) {
  const filePath = path.join(folderPath, file);
  console.log(`Processing: ${file}`);

  try {
    // Check if already imported
    const existing = await prisma.referenceEstimate.findFirst({
      where: { originalFilename: file }
    });
    if (existing) {
      console.log(`  ✓ Already imported, skipping\n`);
      skipped++;
      continue;
    }

    // Extract text from PDF
    const dataBuffer = fs.readFileSync(filePath);
    const uint8 = new Uint8Array(dataBuffer);
    const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise;
    let text = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      text += content.items.map(i => i.str).join(' ') + '\n';
    }

    if (!text || text.trim().length < 50) {
      console.log(`  ⚠ Skipping — could not extract text\n`);
      skipped++;
      continue;
    }

    // Use Claude to extract pricing info
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Extract pricing and job information from this Crystal Clear Cleaning & Contracting estimate. Return a JSON object with:
- jobType: string (type of work, e.g. "Stamped Concrete Patio", "Deck Build", "Bathroom Remodel")
- clientName: string or null
- total: number or null (final total dollar amount, no $ sign)
- pricingNotes: string (all line items, unit prices, materials, labor costs — everything useful for pricing future similar jobs)

Document:
${text.slice(0, 8000)}

Return only valid JSON.`
      }]
    });

    const raw = response.content[0].text;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
      console.log(`  ⚠ Skipping — no JSON returned\n`);
      skipped++;
      continue;
    }

    const extracted = JSON.parse(raw.slice(start, end + 1));

    await prisma.referenceEstimate.create({
      data: {
        jobType: extracted.jobType || 'Unknown Job Type',
        clientName: extracted.clientName || null,
        extractedJson: extracted,
        pricingNotes: extracted.pricingNotes || '',
        total: extracted.total || null,
        originalFilename: file,
      }
    });

    console.log(`  ✅ ${extracted.jobType}${extracted.clientName ? ` — ${extracted.clientName}` : ''}${extracted.total ? ` ($${Number(extracted.total).toLocaleString()})` : ''}\n`);
    imported++;

  } catch (err) {
    console.log(`  ❌ Error: ${err.message}\n`);
    skipped++;
  }
}

await prisma.$disconnect();
console.log(`\nDone. ${imported} imported, ${skipped} skipped.`);
