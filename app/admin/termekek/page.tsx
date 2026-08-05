'use client';

import { useState, useEffect } from 'react';
import { uploadPresigned } from '@vercel/blob/client';
import Link from 'next/link';
import { Plus, Edit, Trash2, Eye, EyeOff, Upload, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import type { Product } from '@/types';

type FormData = Omit<Product, 'id'>;

const emptyForm: FormData = {
  title: '',
  description: '',
  price: 0,
  category: 'premium',
  active: true,
};

export default function AdminTermekekPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/products');
      if (res.ok) {
        setProducts(await res.json());
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Hiba: ${res.status}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Hálózati hiba');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFile(null);
    setSaveError('');
    setFormOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({ title: product.title, description: product.description, price: product.price, category: product.category, active: product.active, blobKey: product.blobKey, stripePriceId: product.stripePriceId });
    setFile(null);
    setSaveError('');
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      // Step 1: save text fields (no file – PDF uploaded separately to avoid 4.5MB function limit)
      let recordId: string | undefined;
      if (editing) {
        const res = await fetch(`/api/admin/products/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({})) as { error?: string };
          setSaveError(j.error || `HTTP ${res.status}`);
          return;
        }
        recordId = editing.id;
      } else {
        const data = new FormData();
        Object.entries(form).forEach(([k, v]) => { if (v !== undefined) data.append(k, String(v)); });
        const res = await fetch('/api/admin/products', { method: 'POST', body: data });
        if (!res.ok) {
          const j = await res.json().catch(() => ({})) as { error?: string };
          setSaveError(j.error || `HTTP ${res.status}`);
          return;
        }
        const j = await res.json() as { id?: string };
        recordId = j.id;
      }

      // Step 2: upload PDF directly to Vercel Blob from browser (bypasses 4.5MB function limit)
      if (file && recordId) {
        await uploadPresigned(`products/${recordId}.pdf`, file, {
          access: 'public',
          handleUploadUrl: '/api/admin/blob-upload',
        });
      }

      await fetchProducts();
      setFormOpen(false);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Hálózati hiba');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Biztosan törlöd?')) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchProducts();
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Törlés sikertelen');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Hálózati hiba');
    }
  }

  async function toggleActive(product: Product) {
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...product, active: !product.active }),
      });
      if (res.ok) {
        await fetchProducts();
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Frissítés sikertelen');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Hálózati hiba');
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-brand-muted hover:text-brand-purple">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="font-display text-xl font-bold text-brand-blue">Digitális termékek</h1>
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus size={16} /> Új termék
          </Button>
        </div>

        {error && (
          <Card className="bg-red-50 border-red-200 mb-4">
            <p className="font-sans text-sm text-red-700">{error}</p>
          </Card>
        )}

        {loading ? (
          <p className="font-sans text-brand-muted text-center py-12">Betöltés...</p>
        ) : products.length === 0 && !error ? (
          <Card className="text-center py-12">
            <p className="font-sans text-brand-muted">Még nincs termék. Adj hozzá egyet!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {products.map(p => (
              <Card key={p.id} className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-sans font-semibold text-brand-blue truncate">{p.title}</h3>
                    <Badge variant={p.active ? 'teal' : 'muted'}>{p.active ? 'Aktív' : 'Inaktív'}</Badge>
                    <Badge variant={p.category === 'free' ? 'blue' : 'purple'}>{p.category}</Badge>
                  </div>
                  <p className="font-sans text-sm text-brand-muted truncate">{p.description}</p>
                  <p className="font-sans text-sm font-bold text-brand-blue mt-0.5">{p.price.toLocaleString('hu-HU')} Ft</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleActive(p)} className="p-2 rounded-lg hover:bg-brand-purple-light text-brand-muted hover:text-brand-purple transition-colors">
                    {p.active ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-brand-purple-light text-brand-muted hover:text-brand-purple transition-colors">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg hover:bg-red-50 text-brand-muted hover:text-brand-coral transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {formOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="font-display text-lg font-bold text-brand-blue mb-6">
                {editing ? 'Termék szerkesztése' : 'Új termék'}
              </h2>
              {saveError && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
                  <p className="font-sans text-sm text-red-700">{saveError}</p>
                </div>
              )}
              <form onSubmit={handleSave} className="space-y-4">
                <Input label="Cím" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
                <div>
                  <label className="text-sm font-medium text-brand-text font-sans block mb-1">Leírás</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-brand-border font-sans text-sm focus:border-brand-purple focus:outline-none resize-none"
                  />
                </div>
                <Input label="Ár (Ft)" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} required />
                <div>
                  <label className="text-sm font-medium text-brand-text font-sans block mb-1">Kategória</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value as 'free' | 'premium' }))}
                    className="w-full px-4 py-3 rounded-xl border border-brand-border font-sans text-sm focus:border-brand-purple focus:outline-none"
                  >
                    <option value="premium">Prémium</option>
                    <option value="free">Ingyenes</option>
                  </select>
                </div>
                <Input label="Stripe Price ID (opcionális)" value={form.stripePriceId || ''} onChange={e => setForm(f => ({ ...f, stripePriceId: e.target.value }))} placeholder="price_..." />
                <Input label="Systeme.io kurzus ID (ha kurzus, nem letölthető)" value={form.systemeioId || ''} onChange={e => setForm(f => ({ ...f, systemeioId: e.target.value }))} placeholder="626821" />
                <Input label="Systeme.io kurzus URL (opcionális)" value={form.systemeioUrl || ''} onChange={e => setForm(f => ({ ...f, systemeioUrl: e.target.value }))} placeholder="https://..." />
                <div>
                  <label className="text-sm font-medium text-brand-text font-sans block mb-1">PDF feltöltés</label>
                  <label className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-brand-border cursor-pointer hover:border-brand-purple transition-colors">
                    <Upload size={16} className="text-brand-muted" />
                    <span className="font-sans text-sm text-brand-muted">
                      {file ? file.name : (editing?.blobKey ? 'Meglévő fájl (új feltöltéssel cserélhető)' : 'Fájl kiválasztása...')}
                    </span>
                    <input type="file" accept=".pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="accent-brand-purple" />
                  <label htmlFor="active" className="font-sans text-sm text-brand-text">Aktív</label>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" loading={saving} className="flex-1 justify-center">Mentés</Button>
                  <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} className="flex-1 justify-center">Mégse</Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
