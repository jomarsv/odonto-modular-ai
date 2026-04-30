import { Router } from "express";
import { z } from "zod";
import { addDoc, collectionNames, db, getById, now, serializeDocs, updateDoc } from "../firestore.js";
import { config } from "../config.js";
import { authenticate } from "../middleware/auth.js";
import { logAction } from "../services/audit.service.js";
import { createCustomFeatureBillingEvent } from "../services/billing.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

const createSchema = z.object({
  moduleId: z.string().min(2),
  specialtyKey: z.string().min(2),
  specialtyName: z.string().min(2),
  title: z.string().min(5),
  description: z.string().min(10),
  expectedBenefit: z.string().min(5),
  suggestedMonthlyBudget: z.coerce.number().min(0).optional()
});

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNotes: z.string().min(3),
  monthlyPrice: z.coerce.number().min(0).default(0)
});

export const customFeatureRouter = Router();
customFeatureRouter.use(authenticate);

function canReviewAsLeoTech(user: { role: string; email?: string }) {
  return user.role === "ADMIN" && config.leoTechAdminEmails.includes(String(user.email ?? "").toLowerCase());
}

function canViewClinicRequests(role: string) {
  return role === "ADMIN" || role === "CLINIC_MANAGER";
}

async function ensureActiveSpecialtyModule(clinicId: string, moduleId: string) {
  const module = await getById<Record<string, unknown>>(collectionNames.modules, moduleId);
  if (!module) throw new HttpError(404, "Modulo nao encontrado.");
  if (module.scope !== "SPECIALTY") throw new HttpError(400, "Solicitacoes personalizadas devem estar vinculadas a uma especialidade.");
  const clinicModule = await getById<Record<string, unknown>>(collectionNames.clinicModules, `${clinicId}_${moduleId}`);
  if (!clinicModule?.enabled) throw new HttpError(403, "Modulo de especialidade nao ativo para esta clinica.");
  return module;
}

customFeatureRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const moduleId = req.query.moduleId ? String(req.query.moduleId) : "";
    let rows = serializeDocs<Record<string, unknown>>(
      await db().collection(collectionNames.customFeatureRequests).where("clinicId", "==", user.clinicId).get()
    );
    if (moduleId) rows = rows.filter((item) => item.moduleId === moduleId);
    if (!canViewClinicRequests(user.role)) {
      rows = rows.filter((item) => item.requestedById === user.id || item.approvedForUserId === user.id);
    }
    const enriched = await Promise.all(
      rows
        .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
        .slice(0, 100)
        .map(async (item) => ({
          ...item,
          requestedBy: item.requestedById ? await getById(collectionNames.users, String(item.requestedById)) : null
        }))
    );
    res.json(enriched);
  })
);

customFeatureRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const data = createSchema.parse(req.body);
    const module = await ensureActiveSpecialtyModule(user.clinicId, data.moduleId);
    const request = await addDoc(collectionNames.customFeatureRequests, {
      clinicId: user.clinicId,
      moduleId: data.moduleId,
      moduleName: module.name,
      specialtyKey: data.specialtyKey,
      specialtyName: data.specialtyName,
      title: data.title,
      description: data.description,
      expectedBenefit: data.expectedBenefit,
      suggestedMonthlyBudget: data.suggestedMonthlyBudget ?? 0,
      status: "REQUESTED",
      requestedById: user.id,
      approvedForUserId: null,
      monthlyPrice: 0,
      enabled: false,
      reviewNotes: null,
      reviewedById: null,
      reviewedAt: null,
      createdAt: now(),
      updatedAt: now()
    });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "CREATE", entity: "CustomFeatureRequest", entityId: request.id });
    res.status(201).json(request);
  })
);

customFeatureRouter.patch(
  "/:id/review",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    if (!canReviewAsLeoTech(user)) throw new HttpError(403, "Somente a equipe LEO-Tech pode revisar solicitacoes.");
    const data = reviewSchema.parse(req.body);
    const current = await getById<Record<string, unknown>>(collectionNames.customFeatureRequests, String(req.params.id));
    if (!current || current.clinicId !== user.clinicId) throw new HttpError(404, "Solicitacao nao encontrada.");
    if (current.status === "APPROVED") throw new HttpError(400, "Solicitacao ja aprovada.");

    const updated = await updateDoc(collectionNames.customFeatureRequests, String(req.params.id), {
      status: data.status,
      reviewNotes: `LEO-Tech: ${data.reviewNotes}`,
      reviewedById: user.id,
      reviewedAt: now(),
      approvedForUserId: data.status === "APPROVED" ? current.requestedById : null,
      monthlyPrice: data.status === "APPROVED" ? data.monthlyPrice : 0,
      enabled: data.status === "APPROVED",
      updatedAt: now()
    });

    if (data.status === "APPROVED") {
      await createCustomFeatureBillingEvent({
        clinicId: user.clinicId,
        requestId: String(req.params.id),
        userId: String(current.requestedById),
        moduleId: String(current.moduleId),
        title: String(current.title),
        monthlyPrice: data.monthlyPrice
      });
    }
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "REVIEW", entity: "CustomFeatureRequest", entityId: String(req.params.id) });
    res.json(updated);
  })
);
