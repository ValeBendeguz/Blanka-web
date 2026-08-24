import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe';
import { addPurchaseTag } from '@/lib/systemio';
import { addCoursePurchase, addDigitalPurchase, addMentoringPurchase, getSettings, getCourseById, getWebinarById, addWebinarSubscriber } from '@/lib/airtable';
import { generateSignedUrl, getProductPdfUrl } from '@/lib/blob';
import { sendEmail } from '@/lib/resend';
import { createInvoice } from '@/lib/szamlazz';
import { CourseWelcomeEmail } from '@/emails/course-welcome';
import { DigitalProductDeliveryEmail } from '@/emails/digital-product-delivery';
import { MentoringBookingEmail } from '@/emails/mentoring-booking';
import { PremiumMentoringBookingEmail } from '@/emails/premium-mentoring-booking';
import { GroupMentoringBookingEmail } from '@/emails/group-mentoring-booking';
import { StrategiaBookingEmail } from '@/emails/strategia-booking';
import { WebinarConfirmationEmail } from '@/emails/webinar-confirmation';
import { PaymentFailedEmail } from '@/emails/payment-failed';
import { SubscriptionCancelledEmail } from '@/emails/subscription-cancelled';
import { RefundNotificationEmail } from '@/emails/refund-notification';
import Stripe from 'stripe';

const BLANKA_EMAIL = process.env.RESEND_FROM_EMAIL || 'info@blankanovak.com';

async function issueInvoice(opts: {
  email: string;
  name?: string;
  address?: Stripe.Address | null;
  metadata?: Record<string, string>;
  amountHuf: number;
  title: string;
  orderNumber: string;
}) {
  if (!process.env.SZAMLAZZ_AGENT_KEY) return;
  try {
    const stripeAddr = opts.address;
    const hasStripeAddress = stripeAddr?.city || stripeAddr?.postal_code || stripeAddr?.line1;
    const address = hasStripeAddress
      ? { postalCode: stripeAddr.postal_code || '', city: stripeAddr.city || '', line: [stripeAddr.line1, stripeAddr.line2].filter(Boolean).join(', ') }
      : opts.metadata?.billingCity
        ? { postalCode: opts.metadata.billingPostalCode || '', city: opts.metadata.billingCity || '', line: opts.metadata.billingLine || '' }
        : undefined;

    const customerName = opts.name || opts.metadata?.billingName || opts.email;

    const { invoiceNumber } = await createInvoice({
      customerName,
      customerEmail: opts.email,
      customerAddress: address,
      items: [{ name: opts.title, quantity: 1, unitPrice: opts.amountHuf }],
      orderNumber: opts.orderNumber,
    });
    console.log(`Számlázz.hu invoice created: ${invoiceNumber} for ${opts.email}`);
  } catch (err) {
    console.error('Számlázz.hu invoice error:', err);
  }
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(payload, sig);
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_email || session.customer_details?.email || '';
    const productType = session.metadata?.productType as string;
    const productId = session.metadata?.productId as string;
    const customerName = session.customer_details?.name || undefined;
    const productTitle = session.metadata?.productTitle || '';
    const amountHuf = (session.amount_total || 0) / 100;

    try {
      if (productType === 'course') {
        const courseTitle = productTitle || 'Kurzus';
        const course = productId ? await getCourseById(productId) : null;
        const systemeioId = course?.systemeioId || session.metadata?.systemeioId || '';
        const systemeioUrl = course?.systemeioUrl || session.metadata?.systemeioUrl || '';
        await Promise.allSettled([
          addPurchaseTag(email, 'course', productId, systemeioId),
          addCoursePurchase({ email, courseId: productId, stripeSessionId: session.id }),
          sendEmail({
            to: email,
            subject: `Üdvözöllek a(z) ${courseTitle} kurzuson! 🎉`,
            template: CourseWelcomeEmail({ email, name: customerName, courseTitle, courseUrl: systemeioUrl }),
          }),
        ]);
      } else if (productType === 'digital') {
        const blobKey = session.metadata?.blobKey ?? '';
        const digitalTitle = productTitle || 'Digitális termék';
        let downloadUrl = '';
        try {
          const rawBlobUrl = blobKey || (productId ? await getProductPdfUrl(productId) : undefined);
          if (rawBlobUrl) downloadUrl = await generateSignedUrl(rawBlobUrl);
        } catch (blobErr) {
          console.error('[stripe/webhook] blob lookup failed:', blobErr);
        }

        await Promise.allSettled([
          addPurchaseTag(email, 'digital', productId),
          addDigitalPurchase({ email, productId, stripeSessionId: session.id }),
          sendEmail({
            to: email,
            subject: `A letöltésed: ${digitalTitle}`,
            template: DigitalProductDeliveryEmail({ email, productTitle: digitalTitle, downloadUrl }),
          }),
        ]);
      } else if (productType === 'mentoring' && session.mode === 'subscription') {
        await Promise.allSettled([
          addMentoringPurchase({ email, name: customerName, program: 'privat', stripeSessionId: session.id }),
          sendEmail({
            to: email,
            subject: 'Foglald le a havi két alkalmadat! 📅',
            template: MentoringBookingEmail({ email, name: customerName }),
          }),
        ]);
      } else if (productType === 'premium-mentoring' && session.mode === 'subscription') {
        await Promise.allSettled([
          addMentoringPurchase({ email, name: customerName, program: 'premium', stripeSessionId: session.id }),
          sendEmail({
            to: email,
            subject: 'Foglald le a havi négy alkalmadat! 📅',
            template: PremiumMentoringBookingEmail({ email, name: customerName }),
          }),
        ]);
      } else if (productType === 'group-mentoring' && session.mode === 'subscription') {
        const s = await getSettings(['group_mentoring_schedule', 'group_mentoring_zoom_url']);
        await Promise.allSettled([
          addMentoringPurchase({ email, name: customerName, program: 'kiscsoportos', stripeSessionId: session.id }),
          sendEmail({
            to: email,
            subject: 'Üdv a kiscsoportos mentorprogramban! 🎉',
            template: GroupMentoringBookingEmail({ email, name: customerName, nextSessionDate: s.group_mentoring_schedule, zoomLink: s.group_mentoring_zoom_url }),
          }),
        ]);
      } else if (productType === 'strategy') {
        await Promise.allSettled([
          sendEmail({
            to: email,
            subject: 'Foglald le a stratégia konzultációdat! 📅',
            template: StrategiaBookingEmail({ email, name: customerName }),
          }),
        ]);
      } else if (productType === 'webinar') {
        const webinar = productId ? await getWebinarById(productId) : null;
        if (webinar) {
          await Promise.allSettled([
            addWebinarSubscriber({ email, firstName: customerName?.split(' ')[0] || '', webinarId: productId }),
            sendEmail({
              to: email,
              subject: `🎉 Bent vagy! Webinár: ${webinar.title}`,
              template: WebinarConfirmationEmail({ email, firstName: customerName?.split(' ')[0] || '', webinar }),
            }),
          ]);
        }
      }

      if (email && amountHuf > 0) {
        const invoiceTitle = productTitle || (
          productType === 'mentoring' ? 'Privát Havi Mentorprogram' :
          productType === 'premium-mentoring' ? 'Prémium Privát Havi Mentorprogram' :
          productType === 'group-mentoring' ? 'Kiscsoportos Havi Mentorprogram' :
          productType === 'strategy' ? 'Stratégia konzultáció' : 'Vásárlás'
        );
        await issueInvoice({
          email,
          name: customerName,
          address: session.customer_details?.address,
          metadata: session.metadata as Record<string, string> | undefined,
          amountHuf,
          title: invoiceTitle,
          orderNumber: session.id,
        });
      }
    } catch (err) {
      console.error('Stripe webhook handler error:', err);
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice;
    const email = invoice.customer_email || '';
    const customerName = typeof invoice.customer_name === 'string' ? invoice.customer_name : undefined;

    if (email) {
      try {
        await sendEmail({
          to: email,
          subject: '⚠️ Sikertelen fizetés – kérlek, frissítsd az adataidat',
          template: PaymentFailedEmail({ email, name: customerName }),
        });
      } catch (err) {
        console.error('Payment failed email error:', err);
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const productType = subscription.metadata?.productType || '';

    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-05-27.dahlia' });
      const customer = typeof subscription.customer === 'string'
        ? await stripe.customers.retrieve(subscription.customer)
        : subscription.customer;

      const email = !customer.deleted && customer.email ? customer.email : '';
      const name = !customer.deleted && customer.name ? customer.name : undefined;

      if (email) {
        await sendEmail({
          to: BLANKA_EMAIL,
          subject: `Lemondás: ${name || email}`,
          template: SubscriptionCancelledEmail({ customerEmail: email, customerName: name, productType }),
        });
      }
    } catch (err) {
      console.error('Subscription cancelled notification error:', err);
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;

    if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-05-27.dahlia' });
        const customer = typeof subscription.customer === 'string'
          ? await stripe.customers.retrieve(subscription.customer)
          : subscription.customer;

        const email = !customer.deleted && customer.email ? customer.email : '';
        const name = !customer.deleted && customer.name ? customer.name : undefined;

        if (email) {
          await sendEmail({
            to: email,
            subject: '⚠️ Sikertelen fizetés – kérlek, frissítsd az adataidat',
            template: PaymentFailedEmail({ email, name }),
          });
        }
      } catch (err) {
        console.error('Subscription updated email error:', err);
      }
    }
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const email = charge.billing_details?.email || '';
    const amountRefunded = (charge.amount_refunded / 100).toLocaleString('hu-HU') + ' ' + charge.currency.toUpperCase();
    const reason = typeof charge.refunds?.data?.[0]?.reason === 'string' ? charge.refunds.data[0].reason : undefined;

    try {
      await sendEmail({
        to: BLANKA_EMAIL,
        subject: `Visszatérítés: ${email} – ${amountRefunded}`,
        template: RefundNotificationEmail({ customerEmail: email || 'ismeretlen', amount: amountRefunded, reason }),
      });
    } catch (err) {
      console.error('Refund notification error:', err);
    }
  }

  // Recurring mentoring payment — send booking/reminder emails + invoice every month
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice;
    // Skip the first invoice (already handled by checkout.session.completed)
    if (invoice.billing_reason === 'subscription_create') {
      return NextResponse.json({ received: true });
    }

    const email = invoice.customer_email || '';
    const customerName = typeof invoice.customer_name === 'string' ? invoice.customer_name : undefined;
    const subDetails = (invoice as unknown as { subscription_details?: { metadata?: Record<string, string> } }).subscription_details;
    const productType = subDetails?.metadata?.productType || '';
    const amountHuf = (invoice.amount_paid || 0) / 100;

    if (email) {
      try {
        // Fetch customer address from Stripe for the invoice
        let customerAddress: Stripe.Address | null = null;
        if (invoice.customer) {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-05-27.dahlia' });
          const customer = typeof invoice.customer === 'string'
            ? await stripe.customers.retrieve(invoice.customer)
            : invoice.customer;
          if (!customer.deleted) customerAddress = customer.address ?? null;
        }

        if (productType === 'group-mentoring') {
          const s = await getSettings(['group_mentoring_schedule', 'group_mentoring_zoom_url']);
          await sendEmail({
            to: email,
            subject: 'Új hónap a kiscsoportos mentorprogramban! 📅',
            template: GroupMentoringBookingEmail({ email, name: customerName, nextSessionDate: s.group_mentoring_schedule, zoomLink: s.group_mentoring_zoom_url }),
          });
        } else if (productType === 'premium-mentoring') {
          await sendEmail({
            to: email,
            subject: 'Új hónap, új alkalmak - foglald le mind a négy időpontodat! 📅',
            template: PremiumMentoringBookingEmail({ email, name: customerName }),
          });
        } else {
          await sendEmail({
            to: email,
            subject: 'Új hónap, új alkalmak - foglald le időpontjaidat! 📅',
            template: MentoringBookingEmail({ email, name: customerName }),
          });
        }

        if (amountHuf > 0) {
          const invoiceTitle =
            productType === 'group-mentoring' ? 'Kiscsoportos Havi Mentorprogram' :
            productType === 'premium-mentoring' ? 'Prémium Privát Havi Mentorprogram' :
            'Privát Havi Mentorprogram';
          await issueInvoice({
            email,
            name: customerName,
            address: customerAddress,
            amountHuf,
            title: invoiceTitle,
            orderNumber: invoice.id,
          });
        }
      } catch (err) {
        console.error('Mentoring renewal email error:', err);
      }
    }
  }

  return NextResponse.json({ received: true });
}
