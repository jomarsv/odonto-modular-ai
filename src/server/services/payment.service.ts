import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { addDoc, collectionNames, db, now, serializeDoc, serializeDocs, setDoc } from "../firestore.js";
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

export async function getClinicSubscription(clinicId: string) {
  const rows = serializeDocs<Subscription>(
    await db().collection(collectionNames.subscriptions).where("clinicId", "==", clinicId).get()
  ).sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));

  return rows[0] ?? null;
}

export async function createSubscriptionCheckout(input: { clinicId: string; userId: string }) {
  const estimate = await getMonthlyEstimate(input.clinicId);
  const { start, end } = nextCycle();
  const providerSessionId = `mock_checkout_${randomUUID()}`;
  const checkoutUrl = `${config.appBaseUrl}/billing/mock-checkout?session=${providerSessionId}`;

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
    providerCustomerId: `mock_customer_${input.clinicId}`,
    providerSubscriptionId: null,
    checkoutUrl,
    updatedAt: now(),
    createdAt: now()
  });

  await addDoc(collectionNames.billingEvents, {
    clinicId: input.clinicId,
    eventType: "SUBSCRIPTION_CHECKOUT_CREATED",
    description: "Checkout de assinatura criado em modo mock.",
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
