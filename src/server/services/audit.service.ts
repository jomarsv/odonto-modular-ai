import { addDoc, collectionNames, now } from "../firestore.js";

export async function logAction(input: {
  clinicId: string;
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  await addDoc(collectionNames.actionLogs, { ...input, createdAt: now() });
}
