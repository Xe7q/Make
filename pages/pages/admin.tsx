import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DEFAULT_RATES = {
  filamentDensityGperCm3: 1.24,
  filamentTHBperKG: 800,
  printSpeedCm3PerHr: 50,
  electricityTHBperHr: 5,
  laborTHBperJob: 100,
  markupPercent: 0,
};

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [pass, setPass] = useState('');
  const [rates, setRates] = useState<any>(DEFAULT_RATES);
  const [products, setProducts] = useState<any[]>([]);
  const PUBLIC_PASS = process.env.NEXT_PUBLIC_MAKE_ADMIN_PASS || 'makeadmin';

  useEffect(() => {
    try {
      const r = localStorage.getItem('make_rates');
      if (r) setRates({ ...DEFAULT_RATES, ...(JSON.parse(r) || {}) });
      const p = localStorage.getItem('make_products');
      if (p) setProducts(JSON.parse(p));
    } catch {}
  }, []);

  function saveRates() {
    localStorage.setItem('make_rates', JSON.stringify(rates));
    alert('Rates saved locally. Pricing API will use these for your uploads.');
  }

  function addProduct() {
    const id = Date.now();
    const nameEn = (document.getElementById('p_nameEn') as HTMLInputElement).value || 'New Product';
    const nameTh = (document.getElementById('p_nameTh') as HTMLInputElement).value || 'สินค้า';
    const priceTHB = parseFloat((document.getElementById('p_price') as HTMLInputElement).value || '0');
    const priceUSD = parseFloat((document.getElementById('p_price_usd') as HTMLInputElement).value || '0');
    const fileInput = (document.getElementById('p_img') as HTMLInputElement);
    const file = fileInput.files?.[0];
    const add = (img: string) => {
      const list = [...products, { id, nameEn, nameTh, priceTHB, priceUSD, img }];
      setProducts(list);
      localStorage.setItem('make_products', JSON.stringify(list));
      alert('Product saved (browser storage). For real DB, we’ll wire Supabase.');
      fileInput.value = '';
    };
    if (file) {
      const reader = new FileReader();
      reader.onload = () => add(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      add('/product-1.png');
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50">
        <div className="bg-white p-8 rounded-2xl border w-[380px]">
          <Head><title>Admin - Make</title></Head>
          <h1 className="text-xl font-semibold mb-4">Admin Login (Demo)</h1>
          <p className="text-sm text-gray-500 mb-4">Enter admin password (set <code>NEXT_PUBLIC_MAKE_ADMIN_PASS</code> in Vercel).</p>
          <Input type="password" placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} />
          <Button className="mt-3 w-full rounded-xl" onClick={() => setAuthed(pass === PUBLIC_PASS)}>Enter</Button>
          <p className="text-xs text-gray-400 mt-3">Default password: <strong>makeadmin</strong></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Head><title>Admin - Make</title></Head>
      <header className="sticky top-0 bg-white border-b px-6 py-3 flex justify-between items-center">
        <div className="font-semibold">Make — Admin</div>
        <Button variant="outline" onClick={() => setAuthed(false)}>Logout</Button>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-12">
        <section>
          <h2 className="text-xl font-semibold mb-3">Pricing Rates</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.keys(DEFAULT_RATES).map((k) => (
              <div key={k}>
                <div className="text-sm text-gray-600 mb-1">{k}</div>
                <Input type="number" step="any" value={(rates as any)[k]}
                  onChange={(e) => setRates({ ...rates, [k]: parseFloat(e.target.value) })} />
              </div>
            ))}
          </div>
          <Button className="mt-4 rounded-xl" onClick={saveRates}>Save Rates</Button>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Products</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-2xl border">
            <div className="space-y-2">
              <Input id="p_nameEn" placeholder="Name (EN)" />
              <Input id="p_nameTh" placeholder="Name (TH)" />
              <Input id="p_price" type="number" step="any" placeholder="Price THB" />
              <Input id="p_price_usd" type="number" step="any" placeholder="Price USD" />
              <Input id="p_img" type="file" accept="image/*" />
              <Button className="rounded-xl w-full" onClick={addProduct}>Add Product</Button>
            </div>
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {products.map((p) => (
                <div key={p.id} className="border rounded-xl p-3 flex gap-3 items-center">
                  <img src={p.img} className="w-20 h-16 object-cover rounded" />
                  <div className="text-sm">
                    <div className="font-medium">{p.nameEn}</div>
                    <div className="text-gray-500">{p.nameTh}</div>
                    <div className="text-gray-600 mt-1">฿{p.priceTHB} • ~${p.priceUSD}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
