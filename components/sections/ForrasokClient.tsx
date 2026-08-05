'use client';

import { useState } from 'react';
import { Download, ShoppingCart, Check, Lock, Mail } from 'lucide-react';
import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Product } from '@/types';

function FreeClaimForm({ productId }: { productId: string }) {
  const [form, setForm] = useState({ fullName: '', email: '', _hp: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/freebies/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, fullName: form.fullName, productId, _hp: form._hp }),
      });
      if (res.status === 503) { setStatus('error'); return; }
      if (!res.ok) throw new Error();
      setStatus('success');
      setTimeout(() => {
        window.location.href = `/kerdoiv?email=${encodeURIComponent(form.email)}`;
      }, 500);
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="flex items-center gap-2 text-green-600 text-sm font-sans">
        <Check size={16} /> Elküldtük az emailt! Átirányítás...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 mt-3">
      <div style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }} aria-hidden="true">
        <input tabIndex={-1} autoComplete="off" value={form._hp} onChange={e => setForm(f => ({ ...f, _hp: e.target.value }))} />
      </div>
      <Input
        placeholder="Teljes neved"
        value={form.fullName}
        onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))}
        required
        className="text-sm py-2"
      />
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="email@cimed.hu"
          value={form.email}
          onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
          required
          error={status === 'error' ? 'Hiba történt, próbáld újra.' : ''}
          className="flex-1 text-sm py-2"
        />
        <Button type="submit" size="sm" loading={status === 'loading'}>
          <Mail size={14} /> Kérem
        </Button>
      </div>
    </form>
  );
}

function ProductIcon({ product }: { product: Product }) {
  if (product.imageUrl) {
    return (
      <Image
        src={product.imageUrl}
        alt={product.title}
        width={48}
        height={48}
        className="w-12 h-12 object-contain"
      />
    );
  }
  const fallback = product.category === 'free' ? '/images/icon_konyv.png' : '/images/icon_koffer.png';
  return (
    <Image
      src={fallback}
      alt={product.title}
      width={48}
      height={48}
      className="w-12 h-12 object-contain"
    />
  );
}

function ResourceCard({ product }: { product: Product }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 flex items-center justify-center">
          <ProductIcon product={product} />
        </div>
        <Badge variant={product.category === 'free' ? 'green' : 'blue'}>
          {product.category === 'free' ? 'Ingyenes' : `${product.price.toLocaleString('hu-HU')} Ft`}
        </Badge>
      </div>

      <div className="flex-1 flex flex-col">
        <h3 className="font-display text-lg font-bold text-brand-blue mb-1">{product.title}</h3>
        <p className={`font-sans text-sm text-brand-muted leading-relaxed whitespace-pre-wrap ${expanded ? '' : 'line-clamp-2'}`}>
          {product.description}
        </p>
        {product.description && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="font-sans text-xs text-brand-purple hover:underline mt-1 text-left"
          >
            {expanded ? 'Kevesebb' : 'Részletek'}
          </button>
        )}
        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 mt-auto pt-3">
            {product.tags.map(t => (
              <span key={t} className="font-sans text-xs text-brand-muted bg-brand-border px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        )}
      </div>

      {product.category === 'free' ? (
        <FreeClaimForm productId={product.id} />
      ) : product.stripePriceId ? (
        <Button
          href={`/penztar?priceId=${product.stripePriceId}&type=${product.systemeioId ? 'course' : 'digital'}`}
          size="sm"
          className="w-full justify-center"
        >
          <ShoppingCart size={14} />
          Megveszem: {product.price.toLocaleString('hu-HU')} Ft
          <Lock size={12} className="opacity-60" />
        </Button>
      ) : (
        <span className="font-sans text-xs text-brand-muted text-center">Hamarosan elérhető</span>
      )}
    </Card>
  );
}

export function ForrasokClient({ products }: { products: Product[] }) {
  const fixedCategories = ['Összes', 'Ingyenes', 'Prémium'];
  const dynamicTags = Array.from(
    new Set(products.flatMap(p => p.tags ?? []))
  ).sort();
  const categories = [...fixedCategories, ...dynamicTags];

  const [activeCategory, setActiveCategory] = useState('Összes');

  const filtered = products.filter(p => {
    if (activeCategory === 'Összes') return true;
    if (activeCategory === 'Ingyenes') return p.category === 'free';
    if (activeCategory === 'Prémium') return p.category === 'premium';
    return p.tags?.includes(activeCategory) ?? false;
  });

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-8 justify-center">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={[
              'px-4 py-2 rounded-full font-sans text-sm font-medium transition-all',
              activeCategory === cat
                ? 'bg-brand-purple text-white shadow-md'
                : 'bg-white text-brand-muted border border-brand-border hover:border-brand-purple hover:text-brand-purple',
            ].join(' ')}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center font-sans text-brand-muted py-12">
          Nincs találat ebben a kategóriában.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filtered.map((p, i) => (
            <div key={p.id} className={`animate-fade-in stagger-${(i % 4) + 1}`}>
              <ResourceCard product={p} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function ForrasokEmptyState() {
  return (
    <div className="text-center py-16">
      <Download size={40} className="text-brand-purple mx-auto mb-4 opacity-40" />
      <p className="font-sans text-brand-muted">Hamarosan érkeznek az anyagok!</p>
    </div>
  );
}
