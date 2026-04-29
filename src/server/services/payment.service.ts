import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { config } from "../config.js";
import { addDoc, collectionNames, db, getById, now, serializeDoc, serializeDocs, setDoc } from "../firestore.js";
import { getMonthlyEstimate } from "./billing.service.js";

export type SubscriptionStatus = "INCOMPLETE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";

type Subscription = {
  clinicId: string;
  provider: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  monthlyAmount: number;
  currency: "BRL";
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  checkoutUrl?: string | null;
  updatedAt: unknown;
  createdAt?: unknown;
};

function nextCycle() {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function stripeClient() {
  if (!config.stripeSecretKey) throw new Error("STRIPE_SECRET_KEY nao configurada.");
  return new Stripe(config.stripeSecretKey);
}

function amountToCents(amount: number) {
  return Math.max(50, Math.round(amount * 100));
}

function centsToAmount(cents?: number | null) {
  return Number(((cents ?? 0) / 100).toFixed(2));
}

export async function getClinicSubscription(clinicId: string) {
  const rows = serializeDocs<Subscription>(
    await db().collection(collectionNames.subscriptions).where("clinicId", "==", clinicId).get()
  ).sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));

  return rows[0] ?? null;
}

export async function createSubscriptionCheckout(input: { clinicId: string; userId: string; userEmail?: string }) {
  const estimate = await getMonthlyEstimate(input.clinicId);
  const { start, end } = nextCycle();
  let providerSessionId = `mock_checkout_${randomUUID()}`;
  let checkoutUrl = `${config.appBaseUrl}/billing/mock-checkout?session=${providerSessionId}`;
  let providerCustomerId = `mock_customer_${input.clinicId}`;

  if (config.paymentProvider === "stripe") {
    const session = await stripeClient().checkout.sessions.create({
      mode: "subscription",
      customer_email: input.userEmail,
      success_url: `${config.appBaseUrl}?checkout=success`,
      cancel_url: `${config.appBaseUrl}?checkout=cancelled`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: amountToCents(estimate.monthlyPrice),
            recurring: { interval: "month" },
            product_data: {
              name: "Odonto Modular AI - Assinatura mensal",
              description: "Plano base, modulos ativos e consumos estimados do ciclo."
            }
          }
        }
      ],
      metadata: {
        clinicId: input.clinicId,
        userId: input.userId,
        billingPolicy: estimate.billingPolicy,
        cycleStart: start,
        cycleEnd: end
      },
      subscription_data: {
        metadata: {
          clinicId: input.clinicId,
          billingPolicy: estimate.billingPolicy
        }
      }
    });
    providerSessionId = session.id;
    checkoutUrl = session.url ?? checkoutUrl;
    providerCustomerId = typeof session.customer === "string" ? session.customer : "";
  }

  const checkout = await addDoc(collectionNames.paymentCheckoutSessions, {
    clinicId: input.clinicId,
    userId: input.userId,
    provider: config.paymentProvider,
    providerSessionId,
    status: "OPEN",
    amount: estimate.monthlyPrice,
    currency: "BRL",
    checkoutUrl,
    metadata: {
      billingPolicy: estimate.billingPolicy,
      cycleStart: start,
      cycleEnd: end
    },
    createdAt: now()
  });

  const subscriptionId = `subscription_${input.clinicId}`;
  await setDoc<Subscription>(collectionNames.subscriptions, subscriptionId, {
    clinicId: input.clinicId,
    provider: config.paymentProvider,
    status: "INCOMPLETE",
    currentPeriodStart: start,
    currentPeriodEnd: end,
    monthlyAmount: estimate.monthlyPrice,
    currency: "BRL",
    providerCustomerId,
    providerSubscriptionId: null,
    checkoutUrl,
    updatedAt: now(),
    createdAt: now()
  });

  await addDoc(collectionNames.billingEvents, {
    clinicId: input.clinicId,
    eventType: "SUBSCRIPTION_CHECKOUT_CREATED",
    description: config.paymentProvider === "stripe" ? "Checkout de assinatura criado no Stripe." : "Checkout de assinatura criado em modo mock.",
    amount: estimate.monthlyPrice,
    metadata: { checkoutSessionId: checkout.id, provider: config.paymentProvider },
    createdAt: now()
  });

  return { checkout, subscription: await getClinicSubscription(input.clinicId) };
}

export async function activateMockSubscription(input: { clinicId: string }) {
  const subscriptionId = `subscription_${input.clinicId}`;
  const current = await serializeDoc<Subscription>(await db().collection(collectionNames.subscriptions).doc(subscriptionId).get());
  const estimate = await getMonthlyEstimate(input.clinicId);
  const { start, end } = nextCycle();

  const subscription = await setDoc<Subscription>(collectionNames.subscriptions, subscriptionId, {
    clinicId: input.clinicId,
    provider: config.paymentProvider,
    status: "ACTIVE",
    currentPeriodStart: current?.currentPeriodStart ?? start,
    currentPeriodEnd: current?.currentPeriodEnd ?? end,
    monthlyAmount: estimate.monthlyPrice,
    currency: "BRL",
    providerCustomerId: current?.providerCustomerId ?? `mock_customer_${input.clinicId}`,
    providerSubscriptionId: current?.providerSubscriptionId ?? `mock_subscription_${randomUUID()}`,
    checkoutUrl: current?.checkoutUrl ?? null,
    updatedAt: now(),
    createdAt: current?.createdAt ?? now()
  });

  await addDoc(collectionNames.billingEvents, {
    clinicId: input.clinicId,
    eventType: "SUBSCRIPTION_ACTIVATED",
    description: "Assinatura ativada em modo mock.",
    amount: estimate.monthlyPrice,
    metadata: { provider: config.paymentProvider, subscriptionId: subscription.id },
    createdAt: now()
  });

  return subscription;
}

export async function processPaymentWebhook(input: {
  eventId: string;
  eventType: string;
  clinicId: string;
  provider?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}) {
  const existing = await getById(collectionNames.paymentWebhookEvents, input.eventId);
  if (existing) return { duplicate: true, subscription: await getClinicSubscription(input.clinicId) };

  await setDoc(collectionNames.paymentWebhookEvents, input.eventId, {
    clinicId: input.clinicId,
    provider: input.provider ?? config.paymentProvider,
    eventType: input.eventType,
    status: "PROCESSING",
    amount: input.amount ?? 0,
    metadata: input.metadata ?? {},
    createdAt: now(),
    processedAt: null
  });

  const current = await getClinicSubscription(input.clinicId);
  const estimate = await getMonthlyEstimate(input.clinicId);
  const { start, end } = nextCycle();
  const amount = Number(input.amount ?? estimate.monthlyPrice);
  let nextStatus: SubscriptionStatus | null = null;
  let billingEventType = "PAYMENT_WEBHOOK_RECEIVED";
  let description = `Webhook de pagamento recebido: ${input.eventType}`;

  if (["checkout.completed", "invoice.paid", "payment.approved", "subscription.activated"].includes(input.eventType)) {
    nextStatus = "ACTIVE";
    billingEventType = "SUBSCRIPTION_PAYMENT_CONFIRMED";
    description = "Pagamento confirmado pelo gateway.";
  }
  if (["invoice.payment_failed", "payment.failed", "subscription.past_due"].includes(input.eventType)) {
    nextStatus = "PAST_DUE";
    billingEventType = "SUBSCRIPTION_PAYMENT_FAILED";
    description = "Falha de pagamento informada pelo gateway.";
  }
  if (["subscription.canceled", "subscription.cancelled", "customer.subscription.deleted"].includes(input.eventType)) {
    nextStatus = "CANCELED";
    billingEventType = "SUBSCRIPTION_CANCELED";
    description = "Assinatura cancelada pelo gateway.";
  }

  let subscription = current;
  if (nextStatus) {
    subscription = await setDoc<Subscription>(collectionNames.subscriptions, `subscription_${input.clinicId}`, {
      clinicId: input.clinicId,
      provider: input.provider ?? current?.provider ?? config.paymentProvider,
      status: nextStatus,
      currentPeriodStart: current?.currentPeriodStart ?? start,
      currentPeriodEnd: current?.currentPeriodEnd ?? end,
      monthlyAmount: amount,
      currency: "BRL",
      providerCustomerId: current?.providerCustomerId ?? null,
      providerSubscriptionId: current?.providerSubscriptionId ?? String(input.metadata?.providerSubscriptionId ?? ""),
      checkoutUrl: current?.checkoutUrl ?? null,
      updatedAt: now(),
      createdAt: current?.createdAt ?? now()
    });
  }

  await addDoc(collectionNames.billingEvents, {
    clinicId: input.clinicId,
    eventType: billingEventType,
    description,
    amount,
    metadata: {
      paymentWebhookEventId: input.eventId,
      provider: input.provider ?? config.paymentProvider,
      externalEventType: input.eventType,
      ...(input.metadata ?? {})
    },
    createdAt: now()
  });

  await setDoc(collectionNames.paymentWebhookEvents, input.eventId, {
    status: "PROCESSED",
    processedAt: now()
  });

  return { duplicate: false, subscription };
}

export async function processStripeWebhook(rawBody: Buffer, signature?: string) {
  if (!config.stripeWebhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET nao configurada.");
  if (!signature) throw new Error("Assinatura Stripe ausente.");

  const event = stripeClient().webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
  const normalized = normalizeStripeEvent(event);
  if (!normalized) {
    await setDoc(collectionNames.paymentWebhookEvents, event.id, {
      provider: "stripe",
      eventType: event.type,
      status: "IGNORED",
      amount: 0,
      metadata: {},
      createdAt: now(),
      processedAt: now()
    });
    return { ignored: true, eventId: event.id, eventType: event.type };
  }

  return processPaymentWebhook(normalized);
}

function normalizeStripeEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const clinicId = session.metadata?.clinicId;
    if (!clinicId) return null;
    return {
      eventId: event.id,
      eventType: "checkout.completed",
      clinicId,
      provider: "stripe",
      amount: centsToAmount(session.amount_total),
      metadata: {
        providerSessionId: session.id,
        providerCustomerId: typeof session.customer === "string" ? session.customer : undefined,
        providerSubscriptionId: typeof session.subscription === "string" ? session.subscription : undefined
      }
    };
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const metadata = invoice.parent?.subscription_details?.metadata ?? {};
    const clinicId = metadata.clinicId;
    if (!clinicId) return null;
    return {
      eventId: event.id,
      eventType: event.type,
      clinicId,
      provider: "stripe",
      amount: centsToAmount(invoice.amount_paid || invoice.amount_due),
      metadata: {
        providerInvoiceId: invoice.id,
        providerCustomerId: typeof invoice.customer === "string" ? invoice.customer : undefined,
        providerSubscriptionId: invoice.parent?.subscription_details?.subscription
      }
    };
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const clinicId = subscription.metadata?.clinicId;
    if (!clinicId) return null;
    return {
      eventId: event.id,
      eventType: event.type,
      clinicId,
      provider: "stripe",
      amount: 0,
      metadata: {
        providerSubscriptionId: subscription.id,
        providerCustomerId: typeof subscription.customer === "string" ? subscription.customer : undefined
      }
    };
  }

  return null;
}
