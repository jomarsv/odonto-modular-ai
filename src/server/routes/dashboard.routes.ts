import { Router } from "express";
import { prisma } from "../db.js";
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

    const [patientsCount, todayAppointments, activeModules, aiUsage, billing] = await Promise.all([
      prisma.patient.count({ where: { clinicId: user.clinicId } }),
      prisma.appointment.count({ where: { clinicId: user.clinicId, startTime: { gte: start, lte: end } } }),
      prisma.clinicModule.count({ where: { clinicId: user.clinicId, enabled: true } }),
      prisma.aIUsageLog.aggregate({
        where: { clinicId: user.clinicId, createdAt: { gte: monthStart } },
        _sum: { totalTokens: true, estimatedCost: true }
      }),
      getMonthlyEstimate(user.clinicId)
    ]);

    res.json({
      patientsCount,
      todayAppointments,
      activeModules,
      aiTokensThisMonth: Number(aiUsage._sum.totalTokens ?? 0),
      aiCostThisMonth: Number(aiUsage._sum.estimatedCost ?? 0),
      monthlyPrice: billing.monthlyPrice
    });
  })
);
