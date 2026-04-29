import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "./firebase.js";

export type Doc<T = Record<string, unknown>> = T & { id: string };

export const collectionNames = {
  users: "users",
  clinics: "clinics",
  patients: "patients",
  appointments: "appointments",
  clinicalRecords: "clinicalRecords",
  clinicalProcedures: "clinicalProcedures",
  examImages: "examImages",
  documentFiles: "documentFiles",
  modules: "modules",
  clinicModules: "clinicModules",
  aiUsageLogs: "aiUsageLogs",
  billingEvents: "billingEvents",
  subscriptions: "subscriptions",
  paymentCheckoutSessions: "paymentCheckoutSessions",
  paymentWebhookEvents: "paymentWebhookEvents",
  actionLogs: "actionLogs"
} as const;

export function db() {
  return getFirestore();
}

export function now() {
  return FieldValue.serverTimestamp();
}

export function toDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(String(value));
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeValue(item)]));
  }
  return value;
}

export function serializeDoc<T>(snapshot: FirebaseFirestore.DocumentSnapshot): Doc<T> | null {
  if (!snapshot.exists) return null;
  return serializeValue({ id: snapshot.id, ...snapshot.data() }) as Doc<T>;
}

export function serializeDocs<T>(snapshot: FirebaseFirestore.QuerySnapshot): Array<Doc<T>> {
  return snapshot.docs.map((doc) => serializeDoc<T>(doc)).filter(Boolean) as Array<Doc<T>>;
}

export async function getById<T>(collection: string, id: string) {
  return serializeDoc<T>(await db().collection(collection).doc(id).get());
}

export async function addDoc<T extends Record<string, unknown>>(collection: string, data: T) {
  const ref = await db().collection(collection).add(data);
  return getById<T>(collection, ref.id) as Promise<Doc<T>>;
}

export async function setDoc<T extends Record<string, unknown>>(collection: string, id: string, data: T) {
  await db().collection(collection).doc(id).set(data, { merge: true });
  return getById<T>(collection, id) as Promise<Doc<T>>;
}

export async function updateDoc<T extends Record<string, unknown>>(collection: string, id: string, data: Partial<T>) {
  await db().collection(collection).doc(id).update(data);
  return getById<T>(collection, id) as Promise<Doc<T>>;
}
