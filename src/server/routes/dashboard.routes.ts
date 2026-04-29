import { Router } from "express";
import { collectionNames, db, serializeDocs } from "../firestore.js";
import { authenticate } from "../middleware/auth.js";
import { getMonthlyEstimate } from "../services/billing.service.js";
import { asyncHandler, requireUser } from "../utils/http.js";

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [patients, appointments, modules, aiUsageRows, billing] = await Promise.all([
      db().collection(collectionNames.patients).where("clinicId", "==", user.clinicId).get(),
      db().collection(collectionNames.appointments).where("clinicId", "==", user.clinicId).get(),
      db().collection(collectionNames.clinicModules).where("clinicId", "==", user.clinicId).where("enabled", "==", true).get(),
      db().collection(collectionNames.aiUsageLogs).where("clinicId", "==", user.clinicId).get(),
      getMonthlyEstimate(user.clinicId)
    ]);
    const appointmentsRows = serializeDocs<Record<string, unknown>>(appointments);
    const aiRows = serializeDocs<Record<string, unknown>>(aiUsageRows).filter((item) => new Date(String(item.createdAt)) >= monthStart);

    res.json({
      patientsCount: patients.size,
      todayAppointments: appointmentsRows.filter((item) => {
        const time = new Date(String(item.startTime));
        return time >= start && time <= end;
      }).length,
      activeModules: modules.size,
      aiTokensThisMonth: aiRows.reduce((sum, item) => sum + Number(item.totalTokens ?? 0), 0),
      aiCostThisMonth: aiRows.reduce((sum, item) => sum + Number(item.estimatedCost ?? 0), 0),
      monthlyPrice: billing.monthlyPrice
    });
  })
);
