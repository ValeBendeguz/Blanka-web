export const revalidate = 3600;

import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { Footer } from '@/components/sections/Footer';
import { SectionWrapper } from '@/components/ui/SectionWrapper';
import { Button } from '@/components/ui/Button';
import { getUpcomingWebinars, getWebinarRegistrationCount, getActiveCourses, getSettings } from '@/lib/airtable';
import type { Course } from '@/types';
import { ArrowRight } from 'lucide-react';
import { ProgramokTabs } from '@/components/sections/ProgramokTabs';

export const metadata: Metadata = {
  title: 'Angol kurzus és mentorprogram online – árak, programok',
  description: 'Online angol kurzus (24 990 Ft), kiscsoportos mentorprogram (34 990 Ft/hó), privát mentorálás (49 990 Ft/hó), stratégia konzultáció és ingyenes webinárok Novák Blankával.',
  keywords: ['angol kurzus online', 'angol mentorprogram', 'online angol tanfolyam ár', 'angol magánóra online', 'angol webinár', 'Novák Blanka programok'],
  openGraph: {
    title: 'Angol kurzus és mentorprogram online | Novák Blanka',
    description: 'Online angol kurzus, kiscsoportos és privát mentorprogram, stratégia konzultáció és ingyenes webinárok. Árak és részletek.',
    url: 'https://blankanovak.com/programok',
  },
  alternates: { canonical: '/programok' },
};

export default async function ProgramokPage() {
  let webinars: (Awaited<ReturnType<typeof getUpcomingWebinars>>[number] & { registrationCount: number })[] = [];
  let courses: Course[] = [];
  let groupMentoringSchedule = '';
  try {
    const raw = await getUpcomingWebinars();
    const counts = await Promise.all(raw.map(w => getWebinarRegistrationCount(w.id)));
    webinars = raw.map((w, i) => ({ ...w, registrationCount: counts[i] }));
  } catch {
    // Airtable not configured
  }
  try {
    courses = await getActiveCourses();
  } catch {
    // Airtable not configured or courses table missing
  }
  try {
    const s = await getSettings(['group_mentoring_schedule']);
    groupMentoringSchedule = s.group_mentoring_schedule || '';
  } catch {
    // Settings table not configured
  }

  const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://blankanovak.com';
  const organizer = { '@type': 'Person', name: 'Novák Blanka', url: `${BASE}/rolam` };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Kezdőlap', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Programok', item: `${BASE}/programok` },
    ],
  };

  const serviceSchemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Privát Havi Mentorprogram',
      description: 'Személyre szabott 1:1 angol mentorálás havi 2 × 75 perces online alkalommal.',
      provider: organizer,
      url: `${BASE}/programok#privat`,
      offers: { '@type': 'Offer', price: 49990, priceCurrency: 'HUF', availability: 'https://schema.org/InStock' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Kiscsoportos Havi Mentorprogram',
      description: 'Kis létszámú (3–5 fős) csoportos angol mentorprogram havi 4 × 45 perces online alkalommal.',
      provider: organizer,
      url: `${BASE}/programok#kiscsoportos`,
      offers: { '@type': 'Offer', price: 34990, priceCurrency: 'HUF', availability: 'https://schema.org/InStock' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Stratégia Konzultáció',
      description: 'Személyre szabott 45 perces nyelvtanulási tanácsadás és stratégia kialakítás.',
      provider: organizer,
      url: `${BASE}/programok#strategia`,
      offers: { '@type': 'Offer', price: 19990, priceCurrency: 'HUF', availability: 'https://schema.org/InStock' },
    },
  ];

  const courseSchemas = courses.map((c) => ({
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: c.title,
    description: c.description,
    url: `${BASE}/programok#kurzus-${c.id}`,
    provider: organizer,
    offers: c.status === 'active' ? {
      '@type': 'Offer',
      price: c.price,
      priceCurrency: 'HUF',
      availability: 'https://schema.org/InStock',
    } : undefined,
  }));

  const eventSchemas = webinars.map((w) => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: w.title,
    description: w.description,
    startDate: `${w.date}T${w.time || '00:00'}:00+02:00`,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: { '@type': 'VirtualLocation', url: `${BASE}/webinar-regisztracio?id=${w.id}` },
    organizer,
    offers: w.registrationOpen ? {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'HUF',
      availability: w.maxParticipants > 0 && w.registrationCount >= w.maxParticipants
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
      url: `${BASE}/webinar-regisztracio?id=${w.id}`,
    } : undefined,
  }));

  return (
    <>
      {[breadcrumbSchema, ...serviceSchemas, ...courseSchemas, ...eventSchemas].map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <Navbar />
      <main className="pb-20 md:pb-0 pt-20">

        {/* Hero */}
        <SectionWrapper bg="default" className="!py-8 md:!py-12">
          <div className="text-center max-w-2xl mx-auto animate-fade-in">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-brand-blue mb-4">
              Szolgáltatások
            </h1>
            <p className="font-sans text-brand-muted text-lg">
              Minden tanulónak más célja van. Találjuk meg együtt a számodra legjobb utat.
            </p>
          </div>
        </SectionWrapper>

        {/* Tabs */}
        <ProgramokTabs
          courses={courses}
          webinars={webinars}
          groupMentoringSchedule={groupMentoringSchedule}
          strategyPriceId={process.env.NEXT_PUBLIC_STRIPE_STRATEGY_PRICE_ID || ''}
          mentoringPriceId={process.env.NEXT_PUBLIC_STRIPE_MENTORING_PRICE_ID || ''}
        />

        {/* CTA */}
        <SectionWrapper bg="default">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold text-brand-blue mb-4">
              Nem tudod, melyik illik hozzád?
            </h2>
            <p className="font-sans text-brand-muted mb-8">
              Írj nekem és segítek megtalálni a számodra legmegfelelőbb programot.
            </p>
            <Button href="/kapcsolat" size="lg">
              Kapcsolatfelvétel <ArrowRight size={16} />
            </Button>
          </div>
        </SectionWrapper>

      </main>
      <Footer />
      <MobileNav />
    </>
  );
}
