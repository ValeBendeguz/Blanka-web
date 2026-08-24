'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { Footer } from '@/components/sections/Footer';
import { SectionWrapper } from '@/components/ui/SectionWrapper';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';

function CheckoutForm() {
  const searchParams = useSearchParams();
  const priceId = searchParams.get('priceId') || '';
  const type = searchParams.get('type') || 'digital';
  const webinarId = searchParams.get('webinarId') || '';
  const emailParam = searchParams.get('email') || '';

  const [form, setForm] = useState({
    email: emailParam,
    name: '',
    postalCode: '',
    city: '',
    line: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          type,
          webinarId: webinarId || undefined,
          billing: {
            email: form.email,
            name: form.name,
            postalCode: form.postalCode,
            city: form.city,
            line: form.line,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Hiba történt.' }));
        throw new Error(data.error || 'Hiba történt.');
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Hiba történt, kérlek próbáld újra.');
    }
  }

  if (!priceId && type !== 'premium-mentoring') {
    return (
      <SectionWrapper bg="default">
        <div className="text-center py-16 font-sans text-brand-muted">
          Hiányzó termék azonosító. <a href="/programok" className="text-brand-purple underline">Vissza a programokhoz</a>
        </div>
      </SectionWrapper>
    );
  }

  return (
    <SectionWrapper bg="default">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="font-display text-3xl font-bold text-brand-blue mb-2">Számlázási adatok</h1>
          <p className="font-sans text-brand-muted text-sm">
            A számlát ezekre az adatokra állítjuk ki. A fizetés a következő lépésben történik.
          </p>
        </div>

        <Card className="animate-fade-in stagger-1">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="email@cimed.hu"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
            <Input
              label="Számlázási név"
              placeholder="Teljes név vagy cégnév"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <Input
                label="Irányítószám"
                placeholder="1234"
                value={form.postalCode}
                onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))}
                required
              />
              <Input
                label="Város"
                placeholder="Budapest"
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                required
              />
            </div>
            <Input
              label="Utca, házszám"
              placeholder="Példa utca 12."
              value={form.line}
              onChange={e => setForm(f => ({ ...f, line: e.target.value }))}
              required
            />

            {status === 'error' && (
              <p className="text-brand-coral text-sm font-sans">{errorMsg}</p>
            )}

            <Button
              type="submit"
              loading={status === 'loading'}
              size="lg"
              className="w-full justify-center"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Átirányítás...
                </>
              ) : (
                <>
                  Tovább a fizetéshez
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </form>

          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-brand-border">
            <ShieldCheck size={16} className="text-brand-purple shrink-0" />
            <p className="font-sans text-xs text-brand-muted">
              A fizetés biztonságos, a Stripe rendszerén keresztül történik.
            </p>
          </div>
        </Card>
      </div>
    </SectionWrapper>
  );
}

export default function PenztarPage() {
  return (
    <>
      <Navbar />
      <main className="pb-20 md:pb-0 pt-20">
        <Suspense fallback={
          <SectionWrapper bg="default">
            <div className="text-center py-16">
              <Loader2 size={24} className="animate-spin text-brand-purple mx-auto" />
            </div>
          </SectionWrapper>
        }>
          <CheckoutForm />
        </Suspense>
      </main>
      <Footer />
      <MobileNav />
    </>
  );
}
