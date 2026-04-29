import { Router } from "express";
import { collectionNames, db, serializeDocs } from "../firestore.js";
import { authenticate } from "../middleware/auth.js";
import { getMonthlyEstimate } from "../services/billing.service.js";
import { asyncHandler, requireUser } from "../utils/http.js";

export const accountRouter = Router();
accountRouter.use(authenticate);

accountRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const [users, modules, aiLogs, billing] = await Promise.all([
      db().collection(collectionNames.users).where("clinicId", "==", user.clinicId).get(),
      db().collection(collectionNames.clinicModules).where("clinicId", "==", user.clinicId).where("enabled", "==", true).get(),
      db().collection(collectionNames.aiUsageLogs).where("clinicId", "==", user.clinicId).get(),
      getMonthlyEstimate(user.clinicId)
    ]);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const aiRows = serializeDocs<Record<string, unknown>>(aiLogs).filter((item) => new Date(String(item.createdAt)) >= monthStart);
    res.json({
      usersCount: users.size,
      activeModulesCount: modules.size,
      activeModules: billing.activeModules,
      aiTokensThisMonth: aiRows.reduce((sum, item) => sum + Number(item.totalTokens ?? 0), 0),
      aiCostThisMonth: aiRows.reduce((sum, item) => sum + Number(item.estimatedCost ?? 0), 0),
      monthlyPrice: billing.monthlyPrice
    });
  })
);
