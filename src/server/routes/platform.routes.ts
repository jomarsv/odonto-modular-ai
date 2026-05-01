import { Router } from "express";
import { z } from "zod";
import { collectionNames, db, deleteDoc, getById, now, serializeDocs, updateDoc } from "../firestore.js";
import { authenticate } from "../middleware/auth.js";
import { createCustomFeatureBillingEvent } from "../services/billing.service.js";
import { logAction } from "../services/audit.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNotes: z.string().min(3),
  monthlyPrice: z.coerce.number().min(0).default(0)
});

const modulePriceSchema = z.object({
  basePrice: z.coerce.number().min(0),
  pricingNotes: z.string().max(500).optional()
});

export const platformRouter = Router();
platformRouter.use(authenticate);

function requireOelStartup(req: Parameters<typeof requireUser>[0]) {
  const user = requireUser(req);
  if (user.role !== "LEO_TECH_ADMIN") throw new HttpError(403, "Acesso restrito a OEL Startup.");
  return user;
}

platformRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    requireOelStartup(req);
    const [clinics, users, requests, aiUsage, billingEvents] = await Promise.all([
      db().collection(collectionNames.clinics).get(),
      db().collection(collectionNames.users).get(),
      db().collection(collectionNames.customFeatureRequests).get(),
      db().collection(collectionNames.aiUsageLogs).get(),
      db().collection(collectionNames.billingEvents).get()
    ]);
    const requestRows = serializeDocs<Record<string, unknown>>(requests);
    const aiRows = serializeDocs<Record<string, unknown>>(aiUsage);
    const billingRows = serializeDocs<Record<string, unknown>>(billingEvents);
    res.json({
      clinicsCount: clinics.size,
      usersCount: users.size,
      pendingCustomFeatures: requestRows.filter((item) => item.status === "REQUESTED").length,
      approvedCustomFeatures: requestRows.filter((item) => item.status === "APPROVED").length,
      aiTokensTotal: aiRows.reduce((sum, item) => sum + Number(item.totalTokens ?? 0), 0),
      billingEventsTotal: billingRows.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
    });
  })
);

platformRouter.get(
  "/clinics",
  asyncHandler(async (req, res) => {
    requireOelStartup(req);
    const clinics = serializeDocs<Record<string, unknown>>(await db().collection(collectionNames.clinics).get())
      .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
    const enriched = await Promise.all(
      clinics.map(async (clinic) => {
        const [users, requests, aiUsage] = await Promise.all([
          db().collection(collectionNames.users).where("clinicId", "==", clinic.id).get(),
          db().collection(collectionNames.customFeatureRequests).where("clinicId", "==", clinic.id).get(),
          db().collection(collectionNames.aiUsageLogs).where("clinicId", "==", clinic.id).get()
        ]);
        return {
          ...clinic,
          usersCount: users.size,
          customFeatureRequestsCount: requests.size,
          aiTokensTotal: serializeDocs<Record<string, unknown>>(aiUsage).reduce((sum, item) => sum + Number(item.totalTokens ?? 0), 0)
        };
      })
    );
    res.json(enriched);
  })
);

platformRouter.get(
  "/custom-features",
  asyncHandler(async (req, res) => {
    requireOelStartup(req);
    const rows = serializeDocs<Record<string, unknown>>(
      await db().collection(collectionNames.customFeatureRequests).get()
    )
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
      .slice(0, 200);
    const enriched = await Promise.all(
      rows.map(async (item) => ({
        ...item,
        clinic: item.clinicId ? await getById(collectionNames.clinics, String(item.clinicId)) : null,
        requestedBy: item.requestedById ? await getById(collectionNames.users, String(item.requestedById)) : null
      }))
    );
    res.json(enriched);
  })
);

platformRouter.get(
  "/modules",
  asyncHandler(async (req, res) => {
    requireOelStartup(req);
    const modules = serializeDocs<Record<string, unknown>>(
      await db().collection(collectionNames.modules).where("isActive", "==", true).get()
    ).sort((a, b) =>
      `${a.scope ?? ""}${a.specialtyName ?? ""}${a.category ?? ""}${a.name ?? ""}`.localeCompare(
        `${b.scope ?? ""}${b.specialtyName ?? ""}${b.category ?? ""}${b.name ?? ""}`
      )
    );
    res.json(modules);
  })
);

platformRouter.patch(
  "/modules/:id/price",
  asyncHandler(async (req, res) => {
    const user = requireOelStartup(req);
    const data = modulePriceSchema.parse(req.body);
    const module = await getById<Record<string, unknown>>(collectionNames.modules, String(req.params.id));
    if (!module) throw new HttpError(404, "Modulo nao encontrado.");
    const updated = await updateDoc(collectionNames.modules, String(req.params.id), {
      basePrice: data.basePrice,
      pricingNotes: data.pricingNotes ?? null,
      priceUpdatedById: user.id,
      priceUpdatedAt: now(),
      updatedAt: now()
    });
    await logAction({ clinicId: "__leo_tech_platform__", userId: user.id, action: "UPDATE_MODULE_PRICE", entity: "Module", entityId: String(req.params.id) });
    res.json(updated);
  })
);

platformRouter.patch(
  "/custom-features/:id/review",
  asyncHandler(async (req, res) => {
    const user = requireOelStartup(req);
    const data = reviewSchema.parse(req.body);
    const current = await getById<Record<string, unknown>>(collectionNames.customFeatureRequests, String(req.params.id));
    if (!current) throw new HttpError(404, "Solicitacao nao encontrada.");
    if (current.status === "APPROVED") throw new HttpError(400, "Solicitacao ja aprovada.");

    const updated = await updateDoc(collectionNames.customFeatureRequests, String(req.params.id), {
      status: data.status,
      reviewNotes: `OEL Startup: ${data.reviewNotes}`,
      reviewedById: user.id,
      reviewedAt: now(),
      approvedForUserId: data.status === "APPROVED" ? current.requestedById : null,
      monthlyPrice: data.status === "APPROVED" ? data.monthlyPrice : 0,
      enabled: data.status === "APPROVED",
      updatedAt: now()
    });

    if (data.status === "APPROVED") {
      await createCustomFeatureBillingEvent({
        clinicId: String(current.clinicId),
        requestId: String(req.params.id),
        userId: String(current.requestedById),
        moduleId: String(current.moduleId),
        title: String(current.title),
        monthlyPrice: data.monthlyPrice
      });
    }
    await logAction({ clinicId: String(current.clinicId), userId: user.id, action: "LEO_TECH_REVIEW", entity: "CustomFeatureRequest", entityId: String(req.params.id) });
    res.json(updated);
  })
);

platformRouter.delete(
  "/custom-features/:id",
  asyncHandler(async (req, res) => {
    const user = requireOelStartup(req);
    const current = await getById<Record<string, unknown>>(collectionNames.customFeatureRequests, String(req.params.id));
    if (!current) throw new HttpError(404, "Solicitacao nao encontrada.");

    await deleteDoc(collectionNames.customFeatureRequests, String(req.params.id));
    await logAction({
      clinicId: String(current.clinicId ?? "__leo_tech_platform__"),
      userId: user.id,
      action: "LEO_TECH_DELETE",
      entity: "CustomFeatureRequest",
      entityId: String(req.params.id)
    });
    res.status(204).send();
  })
);
