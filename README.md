# Make — 3D Printing On-Demand (Demo)

Ready-to-deploy Next.js (pages router) + Tailwind demo with:
- Home page (products + custom print)
- STL upload price **estimation** (demo) via `/api/price` using file size heuristic
- Checkout drawer (demo)

## Run locally
```bash
npm install
npm run dev
```

## Deploy to Vercel
1. Push this repo to GitHub.
2. Import to Vercel → Deploy (defaults are fine).

## Notes
- The pricing endpoint is a placeholder. Replace with real STL parsing (e.g., compute mesh volume) and your rates.
- Defaults used: PLA 1.24 g/cm³, 800 THB/kg, 50 cm³/hr, 5 THB/hr, 100 THB/job.
