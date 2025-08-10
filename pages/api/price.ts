import type { NextApiRequest, NextApiResponse } from 'next';

// Demo heuristic: assume file size correlates to volume. This is NOT accurate but works for a demo.
// We'll map: volume_cm3 ≈ (sizeKB / 3). Adjust as needed.
const PLA_DENSITY_G_PER_CM3 = 1.24;
const FILAMENT_COST_TBH_PER_KG = 800;
const ELECTRICITY_TBH_PER_HR = 5;
const PRINT_SPEED_CM3_PER_HR = 50;
const LABOR_TBH_PER_JOB = 100;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { sizeKB } = req.body || {};
    if (!sizeKB || sizeKB <= 0) {
      return res.status(400).json({ error: 'sizeKB missing' });
    }
    const volumeCm3 = sizeKB / 3; // crude heuristic for demo
    const weightG = volumeCm3 * PLA_DENSITY_G_PER_CM3;
    const timeHours = volumeCm3 / PRINT_SPEED_CM3_PER_HR;

    const materialCost = (FILAMENT_COST_TBH_PER_KG / 1000) * weightG;
    const electricityCost = ELECTRICITY_TBH_PER_HR * timeHours;
    const laborCost = LABOR_TBH_PER_JOB;
    const total = materialCost + electricityCost + laborCost;

    return res.status(200).json({
      volumeCm3,
      weightG,
      timeHours,
      materialCost,
      electricityCost,
      laborCost,
      total,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}
