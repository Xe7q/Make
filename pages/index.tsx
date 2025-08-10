import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Rates = {
  filamentDensityGperCm3: number;
  filamentTHBperKG: number;
  printSpeedCm3PerHr: number;
  electricityTHBperHr: number;
  laborTHBperJob: number;
  markupPercent?: number;
};

const DEFAULT_RATES: Rates = {
  filamentDensityGperCm3: 1.24,
  filamentTHBperKG: 800,
  printSpeedCm3PerHr: 50,
  electricityTHBperHr: 5,
  laborTHBperJob: 100,
  markupPercent: 0,
};
function volumeFromBinarySTL(buffer: ArrayBuffer): number {
  const dv = new DataView(buffer);
  const n = dv.getUint32(80, true);
  let off = 84;
  let v6 = 0;
  for (let i = 0; i < n; i++) {
    off += 12; // skip normal
    const v1x = dv.getFloat32(off, true), v1y = dv.getFloat32(off + 4, true), v1z = dv.getFloat32(off + 8, true); off += 12;
    const v2x = dv.getFloat32(off, true), v2y = dv.getFloat32(off + 4, true), v2z = dv.getFloat32(off + 8, true); off += 12;
    const v3x = dv.getFloat32(off, true), v3y = dv.getFloat32(off + 4, true), v3z = dv.getFloat32(off + 8, true); off += 12;
    off += 2; // attr byte count
    const cx = v2y * v3z - v2z * v3y;
    const cy = v2z * v3x - v2x * v3z;
    const cz = v2x * v3y - v2y * v3x;
    v6 += v1x * cx + v1y * cy + v1z * cz;
  }
  const volumeMm3 = Math.abs(v6) / 6.0;
  return volumeMm3 / 1000.0; // cm³
}

function volumeFromAsciiSTL(text: string): number {
  const verts: number[] = [];
  const re = /vertex\s+([\-0-9.eE]+)\s+([\-0-9.eE]+)\s+([\-0-9.eE]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    verts.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
  }
  let v6 = 0;
  for (let i = 0; i + 8 < verts.length; i += 9) {
    const v1x = verts[i], v1y = verts[i + 1], v1z = verts[i + 2];
    const v2x = verts[i + 3], v2y = verts[i + 4], v2z = verts[i + 5];
    const v3x = verts[i + 6], v3y = verts[i + 7], v3z = verts[i + 8];
    const cx = v2y * v3z - v2z * v3y;
    const cy = v2z * v3x - v2x * v3z;
    const cz = v2x * v3y - v2y * v3x;
    v6 += v1x * cx + v1y * cy + v1z * cz;
  }
  const volumeMm3 = Math.abs(v6) / 6.0;
  return volumeMm3 / 1000.0; // cm³
}

function estimatePricing(volumeCm3: number, rates: any) {
  const weightG = volumeCm3 * rates.filamentDensityGperCm3;
  const timeHours = volumeCm3 / Math.max(0.0001, rates.printSpeedCm3PerHr);
  const materialCost = (rates.filamentTHBperKG / 1000) * weightG;
  const electricityCost = rates.electricityTHBperHr * timeHours;
  const laborCost = rates.laborTHBperJob;
  const subtotal = materialCost + electricityCost + laborCost;
  const total = subtotal * (1 + (rates.markupPercent || 0) / 100);
  return { weightG, timeHours, materialCost, electricityCost, laborCost, total };
}

export default function Home() {
  const [priceResult, setPriceResult] = useState<any>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [products, setProducts] = useState<any[]>([
    { id: 1, nameEn: '3D Printed Keychain', nameTh: 'พวงกุญแจพิมพ์สามมิติ', img: '/product-1.png', priceTHB: 150, priceUSD: 4.2 },
    { id: 2, nameEn: 'Miniature Figurine',  nameTh: 'โมเดลจำลองขนาดเล็ก', img: '/product-2.png', priceTHB: 420, priceUSD: 11.7 },
    { id: 3, nameEn: 'Phone Stand',          nameTh: 'แท่นวางโทรศัพท์',     img: '/product-3.png', priceTHB: 280, priceUSD: 7.8 },
  ]);

  useEffect(() => {
    try {
      const p = localStorage.getItem('make_products');
      if (p) {
        const list = JSON.parse(p);
        if (Array.isArray(list) && list.length) setProducts(list);
      }
    } catch {}
  }, []);

  const addToCart = (item: any) => setCart((prev) => [...prev, { ...item, qty: 1 }]);

  async function handleFileUpload(e: any) {
   const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setUploading?.(true);
  try {
    // defaults + admin overrides from localStorage
    const DEFAULTS = {
      filamentDensityGperCm3: 1.24,
      filamentTHBperKG: 800,
      printSpeedCm3PerHr: 50,
      electricityTHBperHr: 5,
      laborTHBperJob: 100,
      markupPercent: 0,
    };
    const rates = (() => {
      try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem('make_rates') || 'null') || {}) }; }
      catch { return DEFAULTS; }
    })();

    const buffer = await file.arrayBuffer();
    // Detect binary STL: 84 + 50*n bytes pattern
    let volumeCm3: number;
    if (buffer.byteLength >= 84) {
      const n = new DataView(buffer).getUint32(80, true);
      if (84 + 50 * n === buffer.byteLength) {
        volumeCm3 = volumeFromBinarySTL(buffer);
      } else {
        const text = new TextDecoder().decode(new Uint8Array(buffer));
        volumeCm3 = text.trim().toLowerCase().startsWith('solid')
          ? volumeFromAsciiSTL(text)
          : volumeFromBinarySTL(buffer); // fallback
      }
    } else {
      const text = new TextDecoder().decode(new Uint8Array(buffer));
      volumeCm3 = volumeFromAsciiSTL(text);
    }

    const p = estimatePricing(volumeCm3, rates);
    setPriceResult({
      fileName: file.name,
      weight: p.weightG,
      time: p.timeHours,
      materialCost: p.materialCost,
      electricityCost: p.electricityCost,
      laborCost: p.laborCost,
      total: p.total,
      volumeCm3,
    });
  } catch (err: any) {
    alert(err?.message || 'Failed to read STL');
  } finally {
    setUploading?.(false);
  }
};


  const cartSubtotal = cart.reduce((s, i) => s + i.priceTHB * i.qty, 0);
  const grandTotal = cartSubtotal + (priceResult?.total || 0);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Head><title>Make — 3D Printing On-Demand</title></Head>

      <header className="flex justify-between items-center px-6 md:px-10 py-4 sticky top-0 bg-white/80 backdrop-blur border-b z-10">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Make Logo" className="h-8 md:h-10" />
          <span className="text-xl font-bold tracking-tight">Make</span>
        </div>
        <nav className="hidden md:flex gap-6 text-sm">
          <a href="#products" className="hover:text-teal-600">Products</a>
          <a href="#custom" className="hover:text-teal-600">Custom Print</a>
          <a href="/admin" className="hover:text-teal-600">Admin</a>
        </nav>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-2xl" onClick={() => setShowCheckout(true)}>Cart ({cart.length + (priceResult ? 1 : 0)})</Button>
          <Button className="rounded-2xl px-5">Sign In</Button>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 md:px-10 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-semibold">Your Ideas, 3D Printed On-Demand</h1>
            <p className="mt-4 text-gray-600 text-lg">Upload your file, get instant AI pricing (material + time + labor), and we deliver to your door.</p>
            <div className="mt-6 flex gap-3">
              <a href="#custom"><Button size="lg" className="rounded-2xl">Start Custom Print</Button></a>
              <a href="#products"><Button size="lg" variant="outline" className="rounded-2xl">Browse Products</Button></a>
            </div>
            <p className="mt-4 text-xs text-gray-500">Defaults: PLA 1.24 g/cm³, ฿800/kg, 50 cm³/hr, ฿5/hr, ฿100/job. Change in Admin.</p>
          </div>
          <div className="bg-gray-50 border rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="text-sm text-gray-600 mb-3">Instant Quote</div>
            <div id="custom" className="border border-dashed border-gray-300 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 text-center">
              <Input type="file" accept=".stl" onChange={handleFileUpload} />
              {uploading && <div className="text-xs text-gray-500">Calculating…</div>}
              {priceResult && (
                <div className="text-left text-sm w-full bg-white rounded-xl p-4 shadow">
                  <div className="font-medium">{priceResult.fileName}</div>
                  <div>Approx Volume: {priceResult.volumeCm3.toFixed(2)} cm³</div>
                  <div>Weight: {priceResult.weightG.toFixed(1)} g</div>
                  <div>Print Time: {priceResult.timeHours.toFixed(2)} h</div>
                  <div>Material: ฿{priceResult.materialCost.toFixed(2)}</div>
                  <div>Electricity: ฿{priceResult.electricityCost.toFixed(2)}</div>
                  <div>Labor: ฿{priceResult.laborCost.toFixed(2)}</div>
                  <div className="font-semibold mt-2">Total: ฿{priceResult.total.toFixed(2)}</div>
                  <div className="mt-3">
                    <Button className="rounded-xl w-full" onClick={() => setShowCheckout(true)}>Proceed to Checkout</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="products" className="mx-auto max-w-6xl px-6 md:px-10 py-12 md:py-16">
        <h2 className="text-2xl md:text-3xl font-semibold mb-6">Featured Products</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {products.map((p) => (
            <Card key={p.id} className="shadow-sm hover:shadow-md transition rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                <img src={p.img} alt={`${p.nameEn}`} className="aspect-[4/3] w-full object-cover" />
                <div className="p-4">
                  <h3 className="font-semibold">{p.nameEn}</h3>
                  <div className="text-sm text-gray-500">{p.nameTh}</div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-lg font-semibold">฿{p.priceTHB.toFixed(0)}</span>
                    <span className="text-xs text-gray-500">(~${p.priceUSD.toFixed(2)} USD)</span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button className="rounded-xl" onClick={() => setCart((prev)=>[...prev, {...p, qty:1}])}>Add to Cart</Button>
                    <Button variant="outline" className="rounded-xl">View</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="bg-gray-950 text-white">
        <div className="mx-auto max-w-6xl px-6 md:px-10 py-10 grid md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Make Logo" className="h-7" />
              <span className="font-semibold">Make</span>
            </div>
            <p className="text-sm text-gray-400 mt-3">Professional on-demand 3D printing in Thailand. English & Thai supported.</p>
          </div>
          <div>
            <div className="font-semibold mb-2">Support</div>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>Shipping & Returns</li>
              <li>Payments: PromptPay, Cards, PayPal, Bank</li>
              <li>Order Tracking</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-2">Contact</div>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>Bangkok, Thailand</li>
              <li>Line / Facebook / Email</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 text-center py-4 text-xs text-gray-400">© {new Date().getFullYear()} Make. All rights reserved.</div>
      </footer>

      {showCheckout && (
        <div className="fixed inset-0 z-20">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCheckout(false)} />
          <div className="absolute right-0 top-0 h-full w-full sm:w-[480px] bg-white shadow-xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Checkout (Demo)</h3>
              <Button variant="outline" onClick={() => setShowCheckout(false)}>Close</Button>
            </div>
            <div className="space-y-3">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center border rounded-xl p-3">
                  <div>
                    <div className="font-medium">{item.nameEn}</div>
                    <div className="text-xs text-gray-500">{item.nameTh}</div>
                  </div>
                  <div className="font-medium">฿{item.priceTHB.toFixed(0)}</div>
                </div>
              ))}
              {priceResult && (
                <div className="border rounded-xl p-3">
                  <div className="font-medium">Custom Print</div>
                  <div className="text-xs text-gray-500">{priceResult.fileName} • {priceResult.weightG.toFixed(1)} g • {priceResult.timeHours.toFixed(2)} h</div>
                  <div className="mt-2 text-sm space-y-1">
                    <div className="flex justify-between"><span>Material</span><span>฿{priceResult.materialCost.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Electricity</span><span>฿{priceResult.electricityCost.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Labor</span><span>฿{priceResult.laborCost.toFixed(2)}</span></div>
                  </div>
                  <div className="flex justify-between font-semibold mt-2"><span>Total</span><span>฿{priceResult.total.toFixed(2)}</span></div>
                </div>
              )}
              <div className="flex justify-between text-base pt-2 border-t">
                <span>Grand Total</span>
                <span className="font-semibold">฿{grandTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className="mt-6">
              <div className="text-sm text-gray-600 mb-2">Select a payment method (demo):</div>
              <div className="grid grid-cols-2 gap-3">
                {['PromptPay', 'Credit/Debit Card', 'PayPal', 'Bank Transfer'].map((m) => (
                  <button key={m} onClick={() => setPaymentMethod(m)} className={`border rounded-xl p-3 text-sm text-left ${paymentMethod === m ? 'border-teal-600 ring-2 ring-teal-100' : 'hover:border-gray-400'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6">
              <Button disabled={!paymentMethod} className="rounded-2xl w-full" onClick={() => alert(`Demo: Paid with ${paymentMethod}. Thank you!`)}>
                Place Order (Demo)
              </Button>
              <div className="text-xs text-gray-500 mt-2">This is a demo. No real payment is processed.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
