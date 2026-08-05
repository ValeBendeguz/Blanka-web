'use client';

import Image from 'next/image';
import { Calendar, Clock, Users, Check, ArrowRight } from 'lucide-react';
import { SectionWrapper } from '@/components/ui/SectionWrapper';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { WaitlistForm } from '@/components/sections/WaitlistForm';
import type { Course } from '@/types';

interface WebinarData {
  id: string;
  title: string;
  date: string;
  time: string;
  description: string;
  maxParticipants: number;
  registrationOpen: boolean;
  registrationCount: number;
  price?: number;
  stripePriceId?: string;
}

interface Props {
  courses: Course[];
  webinars: WebinarData[];
  groupMentoringSchedule: string;
  strategyPriceId: string;
  mentoringPriceId: string;
}

const NAV_ITEMS = [
  { id: 'kurzusok', label: 'Kurzusok' },
  { id: 'mentorprogramok', label: 'Mentorprogramok' },
  { id: 'webinarok', label: 'Webinárok' },
] as const;

function FlagRow() {
  return (
    <div className="flex items-center gap-1.5 mt-1 mb-3">
      {[
        { src: '/images/flag_en.png', alt: 'Angol' },
        { src: '/images/flag_it.png', alt: 'Olasz' },
        { src: '/images/flag_es.png', alt: 'Spanyol' },
        { src: '/images/flag_cn.png', alt: 'Kínai' },
      ].map(f => (
        <Image key={f.alt} src={f.src} alt={f.alt} width={22} height={22} className="w-[22px] h-[22px]" />
      ))}
    </div>
  );
}

function WebinarCard({ webinar }: { webinar: WebinarData }) {
  const isFull = webinar.maxParticipants > 0 && webinar.registrationCount >= webinar.maxParticipants;
  const dateFormatted = new Date(webinar.date).toLocaleDateString('hu-HU', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const isPaid = !!webinar.stripePriceId;
  const href = isPaid
    ? `/kerdoiv-webinar?priceId=${webinar.stripePriceId}&type=webinar&webinarId=${webinar.id}`
    : `/kerdoiv-webinar?webinarId=${webinar.id}`;

  return (
    <Card id={`webinar-${webinar.id}`} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="blue">Webinár</Badge>
          {webinar.registrationOpen && (
            <span className="flex items-center gap-1 text-green-600 text-xs font-sans">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              Nyitott
            </span>
          )}
        </div>
        <h3 className="font-display text-lg font-bold text-brand-blue">{webinar.title}</h3>
        <div className="flex flex-wrap gap-4 mt-1">
          <span className="flex items-center gap-1.5 text-sm text-brand-muted font-sans">
            <Calendar size={13} /> {dateFormatted}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-brand-muted font-sans">
            <Clock size={13} /> {webinar.time}
          </span>
          {webinar.maxParticipants > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-brand-muted font-sans">
              <Users size={13} /> Max. {webinar.maxParticipants} fő
            </span>
          )}
          {webinar.price && webinar.price > 0 && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-blue font-sans">
              {webinar.price.toLocaleString('hu-HU')} Ft
            </span>
          )}
        </div>
      </div>
      {isFull ? (
        <Badge variant="coral">Betelt</Badge>
      ) : (
        <Button href={href} size="sm">
          {isPaid ? 'Megveszem' : 'Regisztrálok'}
        </Button>
      )}
    </Card>
  );
}

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export function ProgramokTabs({ courses, webinars, groupMentoringSchedule, strategyPriceId, mentoringPriceId }: Props) {
  return (
    <>
      {/* Scroll navigation */}
      <div className="bg-brand-bg py-6 md:py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-2">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="px-5 py-2.5 rounded-full font-sans text-sm font-medium transition-all bg-brand-purple text-white border border-brand-purple hover:bg-[#9A55C4] hover:border-[#9A55C4] active:scale-[0.98] w-3/4 sm:w-auto"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Kurzusok */}
      <div id="kurzusok" className="scroll-mt-24">
        {courses.length > 0 ? courses.map((course, idx) => (
          <SectionWrapper key={course.id} bg={idx % 2 === 0 ? 'surface' : 'default'} id={`kurzus-${course.id}`}>
            <div className="max-w-3xl mx-auto">
              <Badge variant="blue" className="mb-4">Online kurzus</Badge>
              <h2 className="font-display text-3xl font-bold text-brand-blue mb-3">
                {course.title}
              </h2>
              <p className="font-sans text-brand-muted text-lg mb-6 leading-relaxed">
                {course.description}
              </p>

              {course.features.length > 0 && (
                <div className="mb-8">
                  <h3 className="font-display text-lg font-bold text-brand-blue mb-3">Mit kapsz?</h3>
                  <ul className="space-y-2">
                    {course.features.map(f => (
                      <li key={f} className="flex items-start gap-2 font-sans text-sm text-brand-text">
                        <Check size={14} className="text-brand-purple shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-6 pt-6 border-t border-brand-border">
                <div>
                  <p className="font-sans text-xs text-brand-muted uppercase tracking-wide mb-1">Ár</p>
                  <p className="font-display text-3xl font-bold text-brand-blue">
                    {course.price.toLocaleString('hu-HU')} Ft
                  </p>
                </div>
                {course.status === 'active' && (course.stripePriceId || course.systemeioUrl) ? (
                  <Button
                    href={course.stripePriceId ? `/kerdoiv?priceId=${course.stripePriceId}&type=course` : course.systemeioUrl!}
                    external={!course.stripePriceId && !!course.systemeioUrl}
                    size="lg"
                  >
                    Csatlakozom <ArrowRight size={16} />
                  </Button>
                ) : course.status === 'coming_soon' ? (
                  <Badge variant="coral">Hamarosan</Badge>
                ) : (
                  <Badge variant="muted">Zárva</Badge>
                )}
              </div>
            </div>
          </SectionWrapper>
        )) : (
          <SectionWrapper bg="surface">
            <div className="text-center py-12 border-2 border-dashed border-brand-border rounded-2xl">
              <p className="font-display text-lg font-bold text-brand-blue mb-2">Hamarosan érkeznek a kurzusok!</p>
              <p className="font-sans text-sm text-brand-muted">Iratkozz fel a hírlevélre, hogy elsőként értesülj.</p>
            </div>
          </SectionWrapper>
        )}
      </div>

      {/* Mentorprogramok */}
      <div id="mentorprogramok" className="scroll-mt-24">
        <SectionWrapper bg="default">
          <div className="grid md:grid-cols-3 gap-6">

            {/* Stratégia */}
            <Card className="flex flex-col" id="strategia">
              <Badge variant="blue" className="mb-3 self-start">Egyéni konzultáció</Badge>
              <h3 className="font-display text-xl font-bold text-brand-blue mb-3">
                Stratégia Neked – Személyes Nyelvtanulási Tanácsadás
              </h3>
              <p className="font-sans text-sm text-brand-muted mb-4 leading-relaxed">
                Ha úgy érzed, elakadtál, és személyre szabott segítségre van szükséged, ez a
                konzultáció neked szól.
              </p>
              <ul className="space-y-2 mb-4">
                {[
                  'Feltérképezzük, hol tartasz most',
                  'Azonosítjuk a legnagyobb akadályokat és blokkokat',
                  'Kialakítunk egy számodra működő, reális tanulási stratégiát',
                  'Megismered a saját nyelvtanulói profilodat a 8 személyiségtípus alapján',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 font-sans text-xs text-brand-text">
                    <Check size={13} className="text-brand-purple shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <p className="font-sans text-xs text-brand-muted mb-6 leading-relaxed">
                <span className="font-semibold text-brand-text">Neked való, ha</span> sokat
                próbálkoztál már, elvesztetted a motivációdat, vagy gyorsabban és tudatosabban
                szeretnél fejlődni.
              </p>
              <div className="mt-auto flex items-center justify-between pt-4 border-t border-brand-border">
                <div>
                  <p className="font-display text-xl font-bold text-brand-blue">19 990 Ft</p>
                  <p className="font-sans text-xs text-brand-muted">45 perc</p>
                </div>
                <Button
                  href={strategyPriceId
                    ? `/kerdoiv?priceId=${strategyPriceId}&type=strategy`
                    : 'https://cal.com/blankanovak/strategia-mentoracio'}
                  external={!strategyPriceId}
                  size="sm"
                >
                  Foglalok <ArrowRight size={14} />
                </Button>
              </div>
            </Card>

            {/* Kiscsoportos */}
            <Card className="flex flex-col" id="kiscsoportos">
              <Badge variant="blue" className="mb-3 self-start">Kiscsoportos</Badge>
              <h3 className="font-display text-xl font-bold text-brand-blue mb-1">
                Kiscsoportos Havi Mentorprogram
              </h3>
              <FlagRow />
              <p className="font-sans text-sm text-brand-muted mb-4 leading-relaxed">
                Nem hagyományos nyelvóra, hanem egy támogató közösség és fejlődési rendszer
                azoknak, akik rendszeresen szeretnének beszélni és fejlődni.
              </p>
              <ul className="space-y-2 mb-4 flex-1">
                {[
                  'Havi 4 × 45 perc élő online mentoralkalom',
                  'Kis létszámú (3–5 fős) csoport',
                  'Aktív beszédközpontú gyakorlás',
                  'Személyes visszajelzés és támogatás',
                  'Motiváló, inspiráló közeg',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 font-sans text-xs text-brand-text">
                    <Check size={13} className="text-brand-purple shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              {groupMentoringSchedule && (
                <div className="flex items-center gap-2 mb-4 bg-brand-bg/60 rounded-xl px-3 py-2">
                  <Calendar size={14} className="text-brand-purple shrink-0" />
                  <p className="font-sans text-xs text-brand-text">
                    <span className="font-semibold">Következő alkalom:</span>{' '}
                    {groupMentoringSchedule}
                  </p>
                </div>
              )}
              <div className="mt-auto pt-4 border-t border-brand-border">
                <div className="flex items-baseline gap-1 mb-1">
                  <p className="font-display text-xl font-bold text-brand-blue">34 990 Ft</p>
                  <p className="font-sans text-xs text-brand-muted">/ hó · automatikus megújulás</p>
                </div>
                <p className="font-sans text-xs text-brand-muted mb-3">Iratkozz fel a várólistára, és elsőként értesítünk, ha indul a következő csoport!</p>
                <WaitlistForm program="kiscsoportos" />
              </div>
            </Card>

            {/* Privát */}
            <Card className="flex flex-col border-brand-purple ring-2 ring-brand-purple/20 relative" id="privat">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-purple text-white text-xs font-semibold px-3 py-1 rounded-full font-sans">
                Népszerű
              </span>
              <Badge variant="blue" className="mb-3 self-start">Privát</Badge>
              <h3 className="font-display text-xl font-bold text-brand-blue mb-1">
                Privát Havi Mentorprogram
              </h3>
              <FlagRow />
              <p className="font-sans text-sm text-brand-muted mb-4 leading-relaxed">
                A legszemélyesebb együttműködési forma azoknak, akik gyors, fókuszált és
                egyéni támogatással szeretnének fejlődni.
              </p>
              <ul className="space-y-2 mb-4 flex-1">
                {[
                  'Havi 2 × 75 perc online 1:1 mentoralkalom',
                  'Teljesen személyre szabott tanulási stratégia',
                  'Folyamatos feedback és támogatás',
                  'Személyiségtípus-alapú módszertan',
                  'Valódi kommunikációra épülő nyelvhasználat',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 font-sans text-xs text-brand-text">
                    <Check size={13} className="text-brand-purple shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <p className="font-sans text-xs text-brand-muted italic mb-4">
                Egyszerre csak limitált számú mentoráltat vállalok, hogy mindenki maximális
                figyelmet kapjon.
              </p>
              <div className="mt-auto flex items-center justify-between pt-4 border-t border-brand-border">
                <div>
                  <p className="font-display text-xl font-bold text-brand-blue">49 990 Ft</p>
                  <p className="font-sans text-xs text-brand-muted">/ hó · automatikus megújulás</p>
                </div>
                {mentoringPriceId ? (
                  <Button href={`/kerdoiv?priceId=${mentoringPriceId}&type=mentoring`} size="sm">
                    Feliratkozom <ArrowRight size={14} />
                  </Button>
                ) : (
                  <Button href="/kapcsolat" size="sm">
                    Érdeklődjetek <ArrowRight size={14} />
                  </Button>
                )}
              </div>
            </Card>

          </div>
        </SectionWrapper>
      </div>

      {/* Webinárok */}
      <div id="webinarok" className="scroll-mt-24">
        <SectionWrapper bg="surface">
          <h2 className="font-display text-2xl font-bold text-brand-blue mb-8">Közelgő webinárok</h2>
          {webinars.length > 0 ? (
            <div className="space-y-4">
              {webinars.map((w) => (
                <WebinarCard key={w.id} webinar={w} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-brand-border rounded-2xl">
              <p className="font-display text-lg font-bold text-brand-blue mb-2">Hamarosan újabb webinár!</p>
              <p className="font-sans text-sm text-brand-muted mb-6 max-w-md mx-auto">
                Iratkozz fel a hírlevélre, hogy elsőként értesülj a következő ingyenes webinárról.
              </p>
              <Button href="/#hirlevel" size="sm">Értesíts a következőről</Button>
            </div>
          )}
        </SectionWrapper>
      </div>
    </>
  );
}
