import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createCheckoutSession } from '@/lib/stripe';
import { getActiveProducts, getActiveCourses, getWebinarById, getSetting, setSetting } from '@/lib/airtable';

interface BillingData {
  email: string;
  name: string;
  postalCode: string;
  city: string;
  line: string;
  isCompany?: boolean;
  companyName?: string;
  taxNumber?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      priceId?: string;
      type?: string;
      webinarId?: string;
      billing?: BillingData;
    };

    const priceId = body.priceId;
    const type = (body.type ?? 'digital') as 'digital' | 'course' | 'mentoring' | 'premium-mentoring' | 'group-mentoring' | 'strategy' | 'webinar';
    const webinarId = body.webinarId;
    const billing = body.billing;

    const isPremiumMentoring = type === 'premium-mentoring';

    if (!priceId && !isPremiumMentoring) {
      return NextResponse.json({ error: 'Hiányzó termék azonosító.' }, { status: 400 });
    }
    if (!billing?.email || !billing?.name) {
      return NextResponse.json({ error: 'Kérlek add meg a számlázási adatokat.' }, { status: 400 });
    }

    const [products, courses] = await Promise.all([
      getActiveProducts(),
      getActiveCourses().catch(() => []),
    ]);

    const product = products.find(p => p.stripePriceId === priceId);
    const course = courses.find(c => c.stripePriceId === priceId);

    // A product in Termékek with systemeioId acts as a course
    const productAsCourse = type === 'course' && !course && product?.systemeioId ? product : null;

    if (type === 'digital' && !product) {
      return NextResponse.json({ error: 'Termék nem található.' }, { status: 404 });
    }
    if (type === 'course' && !course && !productAsCourse) {
      return NextResponse.json({ error: 'Kurzus nem található.' }, { status: 404 });
    }
    if (type === 'mentoring' && priceId !== process.env.NEXT_PUBLIC_STRIPE_MENTORING_PRICE_ID) {
      return NextResponse.json({ error: 'Érvénytelen mentoring azonosító.' }, { status: 400 });
    }
    if (type === 'strategy' && priceId !== process.env.NEXT_PUBLIC_STRIPE_STRATEGY_PRICE_ID) {
      return NextResponse.json({ error: 'Érvénytelen stratégia azonosító.' }, { status: 400 });
    }
    if (type === 'group-mentoring' && priceId !== process.env.NEXT_PUBLIC_STRIPE_GROUP_MENTORING_PRICE_ID) {
      return NextResponse.json({ error: 'Érvénytelen csoportos mentoring azonosító.' }, { status: 400 });
    }

    let webinar = null;
    if (type === 'webinar' && webinarId) {
      webinar = await getWebinarById(webinarId);
      if (!webinar) return NextResponse.json({ error: 'Webinár nem található.' }, { status: 404 });
    }

    const title = course?.title ?? productAsCourse?.title ?? product?.title ?? webinar?.title ?? (
      type === 'mentoring' ? 'Privát Havi Mentorprogram' :
      type === 'premium-mentoring' ? 'Prémium Privát Havi Mentorprogram' :
      type === 'group-mentoring' ? 'Kiscsoportos Havi Mentorprogram' :
      type === 'strategy' ? 'Stratégia konzultáció' : ''
    );

    const stripeType = (type === 'mentoring' || type === 'premium-mentoring' || type === 'group-mentoring') ? 'subscription' : type === 'strategy' || type === 'webinar' ? 'digital' : type;

    let resolvedPriceId = priceId;
    if (isPremiumMentoring) {
      let savedId = await getSetting('premium_mentoring_price_id');
      if (!savedId && process.env.STRIPE_SECRET_KEY) {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-05-27.dahlia' });
        const product = await stripe.products.create({
          name: 'Prémium Privát Havi Mentorprogram',
          metadata: { type: 'premium-mentoring' },
        });
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: 8999000,
          currency: 'huf',
          recurring: { interval: 'month' },
        });
        savedId = price.id;
        await setSetting('premium_mentoring_price_id', savedId);
      }
      resolvedPriceId = savedId;
    }

    const { url } = await createCheckoutSession({
      priceId: resolvedPriceId,
      productType: stripeType as 'digital' | 'course' | 'subscription',
      customerEmail: billing.email,
      metadata: {
        productType: type,
        productId: product?.id ?? course?.id ?? webinarId ?? '',
        blobKey: product?.blobKey ?? '',
        productTitle: title,
        systemeioId: productAsCourse?.systemeioId ?? course?.systemeioId ?? '',
        systemeioUrl: productAsCourse?.systemeioUrl ?? course?.systemeioUrl ?? '',
        billingName: billing.name,
        billingPostalCode: billing.postalCode || '',
        billingCity: billing.city || '',
        billingLine: billing.line || '',
        billingIsCompany: billing.isCompany ? 'true' : 'false',
        billingCompanyName: billing.companyName || '',
        billingTaxNumber: billing.taxNumber || '',
      },
    });

    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: 'Hiba történt, kérlek próbáld újra.' }, { status: 500 });
  }
}
