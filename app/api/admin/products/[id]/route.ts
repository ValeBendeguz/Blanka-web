import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminSession } from '@/lib/auth';
import { deleteProductPdf } from '@/lib/blob';
import Airtable, { type FieldSet } from 'airtable';
import Stripe from 'stripe';

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);
}
const TABLE = () => process.env.AIRTABLE_PRODUCTS_TABLE || 'Termékek';

function errMsg(e: unknown, fallback: string) {
  return e && typeof e === 'object' && 'message' in e ? String((e as {message: unknown}).message) : fallback;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    let fields: Record<string, unknown> = {};

    const body = await req.json();
    let stripePriceId: string = body.stripePriceId || '';

    if (body.category === 'premium' && body.price > 0 && !stripePriceId && process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-05-27.dahlia' });
      const product = await stripe.products.create({ name: body.title, metadata: { type: 'digital' } });
      const sp = await stripe.prices.create({ product: product.id, unit_amount: body.price * 100, currency: 'huf' });
      stripePriceId = sp.id;
    }

    fields = {
      Title: body.title,
      Description: body.description,
      Pricing: body.price,
      Category: body.category,
      Active: body.active,
      ...(stripePriceId ? { StripePriceId: stripePriceId } : {}),
      ...(body.systemeioId !== undefined ? { SystemeioId: body.systemeioId } : {}),
      ...(body.systemeioUrl !== undefined ? { SystemeioUrl: body.systemeioUrl } : {}),
    };

    await getBase()(TABLE()).update(id, fields as Partial<FieldSet>);
    revalidatePath('/forrasok');
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e, 'Failed to update product') }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    await Promise.allSettled([
      deleteProductPdf(id),
      getBase()(TABLE()).destroy(id),
    ]);
    revalidatePath('/forrasok');
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e, 'Failed to delete product') }, { status: 500 });
  }
}
