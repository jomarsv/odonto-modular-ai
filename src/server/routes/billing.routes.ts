import { Router } from "express";
import { prisma } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { getMonthlyEstimate } from "../services/billing.service.js";
import { asyncHandler, requireUser } from "../utils/http.js";

export const billingRouter = Router();
billingRouter.use(authenticate);

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
    const events = await prisma.billingEvent.findMany({
      where: { clinicId: user.clinicId },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.json(events);
  })
);
