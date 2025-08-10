// pages/api/price.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, Files, Fields } from 'formidable';
import fs from 'fs';

export const config = { api: { bodyParser: false } };

type Rates = {
  filamentDensityGperCm3: number;
  filamentTHBperKG: number;
  printSpeedCm3PerHr: number;
  electricityTHBperHr: number;
  laborTHBperJob: number;
  markupPercent: number;
};

const DEFAULT_RATES: Rates = {
  filamentDensityGperCm3: 1.24,
  filamentTHBperKG: 800,
  printSpeedCm3PerHr: 50,
  electricityTHBperHr: 5,
  laborTHBperJob: 100,
  markupPercent: 0,
};

function parseRates(raw: any): Rates {
  try {
    if (!raw) return DEFAULT_RATES;
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { ...DEFAULT_RATES, ...obj };
  } catch {
    return DEFAULT_RATES;
  }
}

function isAsciiSTL(buf: Buffer): boolean {
  const head = buf.toString('utf8', 0, Math.min(80, buf.length)).toLowerCase();
  if (!head.startsWith('solid')) return false;
  if (buf.length >= 84) {
    const n = buf.readUInt32LE(80);
    if (84 + 50 * n === buf.length) return false; // binary starting with "solid"
  }
  return true;
}

function volumeFromBinarySTL(buf: Buffer): number {
  const n = buf.readUInt32LE(80);
  let offset = 84;
  let v6 = 0;
  for (let i = 0; i < n; i++) {
    offset += 12; // normal
    const v1x = buf.readFloatLE(offset); const v1y = buf.readFloatLE(offset+4); const v1z = buf.readFloatLE(offset+8); offset += 12;
    const v2x = buf.readFloatLE(offset); const v2y = buf.readFloatLE(offset+4); const v2z = buf.readFloatLE(offset+8); offset += 12;
    const v3x = buf.readFloatLE(offset); const v3y = buf.readFloatLE(offset+4); const v3z = buf.readFloatLE(offset+8); offset += 12;
    offset += 2; // attribute byte count
    const cx = v2y*v3z - v2z*v3y, cy = v2z*v3x - v2x*v3z, cz = v2x*v3y - v2y*v3x;
    v6 += v1x*cx + v1y*cy + v1z*cz;
  }
  const volumeMm3 = Math.abs(v6) / 6.0;
  return volumeMm3 / 1000.0; // cm³
}

function volumeFromAsciiSTL(buf: Buffer): number {
  const text = buf.toString('utf8');
  const verts: number[] = [];
  const re = /vertex\s+([\- \d\.eE]+)\s+([\- \d\.eE]+)\s+([\- \d\.eE]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    verts.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
  }
  let v6 = 0;
  for (let i = 0; i + 8 < verts.length; i += 9) {
    const v1x = verts[i], v1y = verts[i+1], v1z = verts[i+2];
    const v2x = verts[i+3], v2y = verts[i+4], v2z = verts[i+5];
    const v3x = verts[i+6], v3y = verts[i+7], v3z = verts[i+8];
    const cx = v2y*v3z - v2z*v3y, cy = v2z*v3x - v2x*v3z, cz = v2x*v3y - v2y*v3x;
    v6 += v1x*cx + v1y*cy + v1z*cz;
  }
  const volumeMm3 = Math.abs(v6) / 6.0;
  return volumeMm3 / 1000.0; // cm³
}

function computePricing(volumeCm3: number, rates: Rates) {
  const weightG = volumeCm3 * rates.filamentDensityGperCm3;
  const timeHours = volumeCm3 / Math.max(0.0001, rates.printSpeedCm3PerHr);
  const materialCost = (rates.filamentTHBperKG / 1000) * weightG;
  const electricityCost = rates.electricityTHBperHr * timeHours;
  const laborCost = rates.laborTHBperJob;
  const subtotal = materialCost + electricityCost + laborCost;
  const total = subtotal * (1 + (rates.markupPercent || 0) / 100);
  return { weightG, timeHours, materialCost, electricityCost, laborCost, subtotal, total };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const form = new IncomingForm({ keepExtensions: true, maxFileSize: 50 * 1024 * 1024 });
  form.parse(req, async (err: any, fields: Fields, files: Files) => {
    try {
      if (err) return res.status(400).json({ error: err.message || 'Upload error' });
      const f: any = (files.file as any) || (files.upload as any);
      const file = Array.isArray(f) ? f[0] : f;
      if (!file || !file.filepath) return res.status(400).json({ error: 'No file received' });
      const buf = fs.readFileSync(file.filepath);
      const volumeCm3 = (isAsciiSTL(buf) ? volumeFromAsciiSTL(buf) : volumeFromBinarySTL(buf));
      const rates = parseRates(fields.rates as any);
      const pricing = computePricing(volumeCm3, rates);
      return res.status(200).json({ fileName: file.originalFilename, volumeCm3, ...pricing, rates });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Server error' });
    }
  });
}
