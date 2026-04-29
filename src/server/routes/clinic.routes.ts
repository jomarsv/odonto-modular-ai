import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { collectionNames, getById, now, updateDoc } from "../firestore.js";
import { logAction } from "../services/audit.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

export const clinicRouter = Router();
clinicRouter.use(authenticate);

const clinicSchema = z.object({
  name: z.string().min(2),
  documentNumber: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  address: z.string().optional().nullable()
});

clinicRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const clinic = await getById(collectionNames.clinics, user.clinicId);
    if (!clinic) throw new HttpError(404, "Clinica nao encontrada.");
    res.json(clinic);
  })
);

clinicRouter.put(
  "/me",
  authorize(["ADMIN", "CLINIC_MANAGER"]),
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const data = clinicSchema.parse(req.body);
    const clinic = await updateDoc(collectionNames.clinics, user.clinicId, {
      ...data,
      email: data.email || null,
      updatedAt: now()
    });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "UPDATE", entity: "Clinic", entityId: user.clinicId });
    res.json(clinic);
  })
);
