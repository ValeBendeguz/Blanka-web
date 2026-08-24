import Stripe from 'stripe';
import type { CheckoutParams } from '@/types';

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-05-27.dahlia',
  });
}

export async function findOrCreateStripeCustomer(email: string): Promise<string | undefined> {
  if (!email) return undefined;
  const stripe = getStripe();
  const existing = await stripe.customers.list({ email, limit: 10 });
  if (existing.data.length === 0) return undefined;
  // Prefer the customer that already has subscriptions
  const withSub = existing.data.find(c => (c as { subscriptions?: { total_count: number } }).subscriptions?.total_count ?? 0 > 0);
  return (withSub ?? existing.data[0]).id;
}

export async function createCheckoutSession({
  priceId,
  productType,
  customerEmail,
  metadata,
}: CheckoutParams): Promise<{ url: string }> {
  const stripe = getStripe();
  const isSubscription = productType === 'subscription';

  const existingCustomerId = customerEmail ? await findOrCreateStripeCustomer(customerEmail) : undefined;

  const session = await stripe.checkout.sessions.create({
    mode: isSubscription ? 'subscription' : 'payment',
    payment_method_types: ['card'],
    ...(existingCustomerId
      ? { customer: existingCustomerId }
      : { customer_email: customerEmail }),
    line_items: [{ price: priceId!, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/sikeres-vasarlas?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/programok`,
    metadata: { productType, ...metadata },
    ...(isSubscription ? { subscription_data: { metadata: { productType, ...metadata } } } : {}),
    billing_address_collection: 'required',
    locale: 'hu',
  });

  return { url: session.url! };
}

export function constructWebhookEvent(payload: string | Buffer, sig: string) {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(
    payload,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
