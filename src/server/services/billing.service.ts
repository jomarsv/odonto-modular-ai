import type { AIPrecisionLevel } from "../domain.js";
import { addDoc, collectionNames, db, now, serializeDocs } from "../firestore.js";

const precisionMultipliers: Record<AIPrecisionLevel, number> = {
  BASIC: 1,
  STANDARD: 1.5,
  ADVANCED: 2.5,
  SPECIALIST: 4
};

const modelRates: Record<string, { input: number; output: number }> = {
  "mock-basic": { input: 0.000002, output: 0.000004 },
  "mock-standard": { input: 0.000004, output: 0.000008 },
  "mock-advanced": { input: 0.000008, output: 0.000016 },
  "mock-specialist": { input: 0.000016, output: 0.000032 }
};

export function estimateAICost(input: {
  inputTokens: number;
  outputTokens: number;
  precisionLevel: AIPrecisionLevel;
  modelName: string;
  featureKey: string;
}) {
  const rates = modelRates[input.modelName] ?? modelRates["mock-standard"];
  const multiplier = precisionMultipliers[input.precisionLevel];
  return Number(((input.inputTokens * rates.input + input.outputTokens * rates.output) * multiplier).toFixed(4));
}

export async function createAIConsumptionBillingEvent(input: {
  clinicId: string;
  amount: number;
  featureKey: string;
  totalTokens: number;
  usageLogId: string;
}) {
  await addDoc(collectionNames.billingEvents, {
    clinicId: input.clinicId,
    eventType: "AI_USAGE",
    description: `Consumo de IA: ${input.featureKey}`,
    amount: input.amount,
    metadata: { usageLogId: input.usageLogId, totalTokens: input.totalTokens },
    createdAt: now()
  });
}

export async function getMonthlyEstimate(clinicId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [clinicModulesSnapshot, modulesSnapshot, aiUsageSnapshot, documentsSnapshot] = await Promise.all([
    db().collection(collectionNames.clinicModules).where("clinicId", "==", clinicId).where("enabled", "==", true).get(),
    db().collection(collectionNames.modules).where("isActive", "==", true).get(),
    db().collection(collectionNames.aiUsageLogs).where("clinicId", "==", clinicId).get(),
    db().collection(collectionNames.documentFiles).where("clinicId", "==", clinicId).get()
  ]);
  const modules = serializeDocs<Record<string, unknown>>(modulesSnapshot);
  const clinicModules = serializeDocs<Record<string, unknown>>(clinicModulesSnapshot)
    .map((item) => ({ ...item, module: modules.find((module) => module.id === item.moduleId) }))
    .filter((item) => item.module);
  const aiUsageRows = serializeDocs<Record<string, unknown>>(aiUsageSnapshot).filter((item) => new Date(String(item.createdAt)) >= monthStart);
  const documentRows = serializeDocs<Record<string, unknown>>(documentsSnapshot);

  const basePlanPrice = 199;
  const activeModulesPrice = clinicModules.reduce((sum, item) => sum + Number(item.module?.basePrice ?? 0), 0);
  const aiUsagePrice = aiUsageRows.reduce((sum, item) => sum + Number(item.estimatedCost ?? 0), 0);
  const storageMb = documentRows.reduce((sum, item) => sum + Number(item.fileSize ?? 0), 0) / 1024 / 1024;
  const storagePrice = Number((storageMb * 0.05).toFixed(2));
  const securityPrice = clinicModules.some((item) => item.module?.key === "security-advanced") ? 49.9 : 0;
  const monthlyPrice = Number((basePlanPrice + activeModulesPrice + storagePrice + aiUsagePrice + securityPrice).toFixed(2));

  return {
    basePlanPrice,
    activeModulesPrice,
    storagePrice,
    aiUsagePrice,
    securityPrice,
    monthlyPrice,
    aiTokensThisMonth: aiUsageRows.reduce((sum, item) => sum + Number(item.totalTokens ?? 0), 0),
    activeModules: clinicModules.map((item) => item.module)
  };
}
