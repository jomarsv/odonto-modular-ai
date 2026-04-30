import { Router } from "express";
import { collectionNames, db, serializeDocs } from "../firestore.js";
import { authenticate } from "../middleware/auth.js";
import { requireModule } from "../middleware/modules.js";
import { getMonthlyEstimate } from "../services/billing.service.js";
import { asyncHandler, requireUser } from "../utils/http.js";

export const billingRouter = Router();
billingRouter.use(authenticate);
billingRouter.use(requireModule(["billing"]));

billingRouter.get(
  "/estimate",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    res.json(await getMonthlyEstimate(user.clinicId));
  })
);

billingRouter.get(
  "/events",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const events = serializeDocs<Record<string, unknown>>(
      await db().collection(collectionNames.billingEvents).where("clinicId", "==", user.clinicId).get()
    )
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
      .slice(0, 50);
    res.json(events);
  })
);

billingRouter.get(
  "/invoice/current",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const estimate = await getMonthlyEstimate(user.clinicId);
    const events = serializeDocs<Record<string, unknown>>(
      await db().collection(collectionNames.billingEvents).where("clinicId", "==", user.clinicId).get()
    ).filter((event) => {
      const createdAt = new Date(String(event.createdAt));
      return createdAt >= new Date(String(estimate.cycleStart)) && createdAt < new Date(String(estimate.cycleEnd));
    });
    const items = [
      { type: "BASE_PLAN", description: "Plano base mensal", amount: estimate.basePlanPrice },
      { type: "MODULES", description: "Mensalidade dos modulos ativos", amount: estimate.activeModulesPrice },
      { type: "CUSTOM_FEATURES", description: "Funcionalidades personalizadas aprovadas por usuario", amount: estimate.customFeaturesPrice },
      { type: "STORAGE", description: "Consumo estimado de armazenamento", amount: estimate.storagePrice },
      { type: "AI_USAGE", description: "Consumo de IA por tokens no ciclo", amount: estimate.aiOtherUsagePrice },
      { type: "AI_QUESTIONS", description: `Perguntas para IA no ciclo (${estimate.aiQuestionsThisMonth})`, amount: estimate.aiQuestionPrice },
      { type: "SECURITY", description: "Recursos de seguranca", amount: estimate.securityPrice }
    ].filter((item) => Number(item.amount) > 0);

    res.json({
      status: "DRAFT",
      billingPolicy: estimate.billingPolicy,
      cycleStart: estimate.cycleStart,
      cycleEnd: estimate.cycleEnd,
      items,
      events: events.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))),
      total: estimate.monthlyPrice
    });
  })
);
