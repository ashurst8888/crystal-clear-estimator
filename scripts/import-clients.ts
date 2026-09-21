import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

function parseCSV(content: string) {
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Handle quoted fields
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      if (line[j] === '"') {
        inQuotes = !inQuotes;
      } else if (line[j] === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += line[j];
      }
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

async function main() {
  const csvPath = path.join('/Users/camashurst/Downloads/Clients.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);

  console.log(`Importing ${rows.length} clients...`);

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = row['Name']?.trim();
    if (!name) { skipped++; continue; }

    const email = row['Email Address']?.trim() || null;
    const phone = row['Phone (mobile)']?.trim() || row['Phone (other)']?.trim() || null;
    const address = row['Address']?.trim() || null;
    const city = row['City']?.trim() || '';
    const state = row['State / Province']?.trim() || '';
    const zip = row['Zip / Postal Code']?.trim() || '';
    const cityStateZip = [city, state, zip].filter(Boolean).join(', ') || null;

    try {
      await prisma.client.upsert({
        where: { name },
        update: {
          ...(email && { email }),
          ...(phone && { phone }),
          ...(address && { address }),
          ...(cityStateZip && { cityStateZip }),
        },
        create: {
          name,
          email: email || null,
          phone: phone || null,
          address: address || null,
          cityStateZip: cityStateZip || null,
        },
      });
      imported++;
      if (imported % 100 === 0) console.log(`  ${imported} done...`);
    } catch (err) {
      console.error(`  Skipped "${name}":`, err);
      skipped++;
    }
  }

  console.log(`\nDone! Imported: ${imported}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main();
