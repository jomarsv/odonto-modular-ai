import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

export async function logAction(input: {
  clinicId: string;
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.actionLog.create({ data: input });
}
