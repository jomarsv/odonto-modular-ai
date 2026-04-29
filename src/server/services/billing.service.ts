import { AIPrecisionLevel } from "@prisma/client";
import { prisma } from "../db.js";

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
  await prisma.billingEvent.create({
    data: {
      clinicId: input.clinicId,
      eventType: "AI_USAGE",
      description: `Consumo de IA: ${input.featureKey}`,
      amount: input.amount,
      metadata: { usageLogId: input.usageLogId, totalTokens: input.totalTokens }
    }
  });
}

export async function getMonthlyEstimate(clinicId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [clinicModules, aiUsage, documents] = await Promise.all([
    prisma.clinicModule.findMany({
      where: { clinicId, enabled: true, module: { isActive: true } },
      include: { module: true }
    }),
    prisma.aIUsageLog.aggregate({
      where: { clinicId, createdAt: { gte: monthStart } },
      _sum: { estimatedCost: true, totalTokens: true }
    }),
    prisma.documentFile.aggregate({
      where: { clinicId },
      _sum: { fileSize: true }
    })
  ]);

  const basePlanPrice = 199;
  const activeModulesPrice = clinicModules.reduce((sum, item) => sum + Number(item.module.basePrice), 0);
  const aiUsagePrice = Number(aiUsage._sum.estimatedCost ?? 0);
  const storageMb = Number(documents._sum.fileSize ?? 0) / 1024 / 1024;
  const storagePrice = Number((storageMb * 0.05).toFixed(2));
  const securityPrice = clinicModules.some((item) => item.module.key === "security-advanced") ? 49.9 : 0;
  const monthlyPrice = Number((basePlanPrice + activeModulesPrice + storagePrice + aiUsagePrice + securityPrice).toFixed(2));

  return {
    basePlanPrice,
    activeModulesPrice,
    storagePrice,
    aiUsagePrice,
    securityPrice,
    monthlyPrice,
    aiTokensThisMonth: Number(aiUsage._sum.totalTokens ?? 0),
    activeModules: clinicModules.map((item) => item.module)
  };
}
