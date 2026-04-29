import { Router } from "express";
import { collectionNames, db, serializeDocs } from "../firestore.js";
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
    const events = serializeDocs<Record<string, unknown>>(
      await db().collection(collectionNames.billingEvents).where("clinicId", "==", user.clinicId).get()
    )
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
      .slice(0, 50);
    res.json(events);
  })
);
