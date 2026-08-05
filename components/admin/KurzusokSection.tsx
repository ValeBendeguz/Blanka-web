'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import type { Course } from '@/types';

type FormData = Omit<Course, 'id'> & { featuresText: string };

const emptyForm: FormData = {
  title: '',
  description: '',
  price: 0,
  status: 'coming_soon',
  active: true,
  systemeioUrl: '',
  stripePriceId: '',
  features: [],
  featuresText: '',
};

const STATUS_LABELS: Record<Course['status'], string> = {
  active: 'Aktív',
  coming_soon: 'Hamarosan',
  closed: 'Zárva',
};

const STATUS_VARIANTS: Record<Course['status'], 'green' | 'blue' | 'muted'> = {
  active: 'green',
  coming_soon: 'blue',
  closed: 'muted',
};

export function KurzusokSection() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [newPriceId, setNewPriceId] = useState('');

  useEffect(() => { fetchCourses(); }, []);

  async function fetchCourses() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/courses');
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Hiba: ${res.status}`);
      } else {
        setCourses(await res.json());
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
    setFormOpen(true);
  }

  function openEdit(c: Course) {
    setEditing(c);
    setForm({
      title: c.title,
      description: c.description,
      price: c.price,
      status: c.status,
      active: c.active,
      systemeioUrl: c.systemeioUrl ?? '',
      stripePriceId: c.stripePriceId ?? '',
      features: c.features,
      featuresText: c.features.join('\n'),
    });
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const features = form.featuresText.split('\n').map(s => s.trim()).filter(Boolean);
      const payload: Omit<Course, 'id'> = {
        title: form.title,
        description: form.description,
        price: form.price,
        status: form.status,
        active: form.active,
        features,
        ...(form.systemeioUrl ? { systemeioUrl: form.systemeioUrl } : {}),
        ...(form.stripePriceId ? { stripePriceId: form.stripePriceId } : {}),
      };
      const url = editing ? `/api/admin/courses/${editing.id}` : '/api/admin/courses';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j.stripePriceId && !form.stripePriceId) setNewPriceId(j.stripePriceId);
        await fetchCourses();
        setFormOpen(false);
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Mentés sikertelen');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Biztosan törlöd ezt a kurzust?')) return;
    const res = await fetch(`/api/admin/courses/${id}`, { method: 'DELETE' });
    if (res.ok) await fetchCourses();
    else alert('Törlés sikertelen');
  }

  async function toggleActive(c: Course) {
    const res = await fetch(`/api/admin/courses/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !c.active }),
    });
    if (res.ok) await fetchCourses();
    else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Frissítés sikertelen');
    }
  }

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-bold text-brand-blue">Kurzusok</h2>
        <Button onClick={openCreate} size="sm">
          <Plus size={16} /> Új kurzus
        </Button>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200 mb-4">
          <p className="font-sans text-sm text-red-700">{error}</p>
        </Card>
      )}
      {newPriceId && (
        <Card className="bg-green-50 border-green-200 mb-4">
          <p className="font-sans text-sm text-green-700">✓ Új Stripe ár létrehozva: <span className="font-mono font-bold">{newPriceId}</span></p>
          <button onClick={() => setNewPriceId('')} className="text-xs text-green-600 underline mt-1">Bezárás</button>
        </Card>
      )}

      {loading ? (
        <p className="font-sans text-brand-muted text-sm py-4">Betöltés...</p>
      ) : courses.length === 0 ? (
        <Card className="text-center py-8">
          <p className="font-sans text-brand-muted text-sm">Nincs kurzus. Adj hozzá egyet!</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map(c => (
            <Card key={c.id} className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-2 mb-1">
                  <h3 className="font-sans font-semibold text-brand-blue">{c.title}</h3>
                  <Badge variant={STATUS_VARIANTS[c.status]}>{STATUS_LABELS[c.status]}</Badge>
                  <button
                    onClick={() => toggleActive(c)}
                    className="flex items-center gap-1 text-xs font-sans px-2 py-0.5 rounded-full border transition-colors"
                    style={c.active ? { color: '#16a34a', borderColor: '#86efac' } : { color: '#7A7A8C', borderColor: '#d1d5db' }}
                  >
                    {c.active ? <><CheckCircle size={11} /> Látható</> : <><XCircle size={11} /> Rejtett</>}
                  </button>
                </div>
                {c.description && (
                  <p className="font-sans text-sm text-brand-muted line-clamp-1">{c.description}</p>
                )}
                <div className="flex flex-wrap gap-4 mt-1">
                  <span className="font-sans text-xs text-brand-muted font-semibold">
                    {c.price.toLocaleString('hu-HU')} Ft
                  </span>
                  {c.features.length > 0 && (
                    <span className="font-sans text-xs text-brand-muted">{c.features.length} funkció</span>
                  )}
                  {c.stripePriceId && (
                    <span className="font-sans text-xs text-brand-muted font-mono">{c.stripePriceId}</span>
                  )}
                  {!c.stripePriceId && c.systemeioUrl && (
                    <a href={c.systemeioUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-purple hover:underline font-sans">
                      Checkout link
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEdit(c)}
                  className="p-2 rounded-lg hover:bg-brand-purple-light text-brand-muted hover:text-brand-purple transition-colors"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-2 rounded-lg hover:bg-red-50 text-brand-muted hover:text-brand-coral transition-colors"
                >
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
              {editing ? 'Kurzus szerkesztése' : 'Új kurzus'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <Input
                label="Cím"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
              />
              <div>
                <label className="text-sm font-medium text-brand-text font-sans block mb-1">Leírás</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border font-sans text-sm focus:border-brand-purple focus:outline-none resize-none"
                  required
                />
              </div>
              <Input
                label="Ár (Ft)"
                type="number"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                required
              />
              <div>
                <label className="text-sm font-medium text-brand-text font-sans block mb-1">Státusz</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as Course['status'] }))}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border font-sans text-sm focus:border-brand-purple focus:outline-none"
                >
                  <option value="active">Aktív</option>
                  <option value="coming_soon">Hamarosan</option>
                  <option value="closed">Zárva</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-brand-text font-sans block mb-1">
                  Mit kapsz? (soronként egy funkció)
                </label>
                <textarea
                  rows={5}
                  value={form.featuresText}
                  onChange={e => setForm(f => ({ ...f, featuresText: e.target.value }))}
                  placeholder={'Pl.:\nMegtanulsz angolul gondolkodni\nLeküzdöd a szorongást\n...'}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border font-sans text-sm focus:border-brand-purple focus:outline-none resize-none"
                />
              </div>
              <Input
                label="Checkout URL (Systeme.io vagy Stripe)"
                value={form.systemeioUrl ?? ''}
                onChange={e => setForm(f => ({ ...f, systemeioUrl: e.target.value }))}
                placeholder="https://..."
              />
              <Input
                label="Stripe Price ID (opcionális)"
                value={form.stripePriceId ?? ''}
                onChange={e => setForm(f => ({ ...f, stripePriceId: e.target.value }))}
                placeholder="price_..."
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="courseActive"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="accent-brand-purple"
                />
                <label htmlFor="courseActive" className="font-sans text-sm text-brand-text">
                  Látható a weboldalon
                </label>
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
  );
}
