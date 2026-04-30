import { Router } from "express";
import { z } from "zod";
import { addDoc, collectionNames, db, getById, now, serializeDocs } from "../firestore.js";
import { authenticate } from "../middleware/auth.js";
import { logAction } from "../services/audit.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

const entrySchema = z.object({
  moduleId: z.string().min(2),
  patientId: z.string().optional(),
  title: z.string().min(3),
  notes: z.string().min(3),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).default("OPEN")
});

export const moduleWorkspaceRouter = Router();
moduleWorkspaceRouter.use(authenticate);

async function ensureActiveModule(clinicId: string, moduleId: string) {
  const module = await getById<Record<string, unknown>>(collectionNames.modules, moduleId);
  if (!module) throw new HttpError(404, "Modulo nao encontrado.");
  const clinicModule = await getById<Record<string, unknown>>(collectionNames.clinicModules, `${clinicId}_${moduleId}`);
  if (!clinicModule?.enabled) throw new HttpError(403, "Modulo nao ativo para esta clinica.");
  return module;
}

moduleWorkspaceRouter.get(
  "/:moduleId",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const moduleId = String(req.params.moduleId);
    await ensureActiveModule(user.clinicId, moduleId);
    const entries = serializeDocs<Record<string, unknown>>(
      await db()
        .collection(collectionNames.moduleWorkspaceEntries)
        .where("clinicId", "==", user.clinicId)
        .where("moduleId", "==", moduleId)
        .get()
    )
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
      .slice(0, 50);
    const enriched = await Promise.all(
      entries.map(async (entry) => ({
        ...entry,
        patient: entry.patientId ? await getById(collectionNames.patients, String(entry.patientId)) : null
      }))
    );
    res.json(enriched);
  })
);

moduleWorkspaceRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const data = entrySchema.parse(req.body);
    await ensureActiveModule(user.clinicId, data.moduleId);
    if (data.patientId) {
      const patient = await getById<Record<string, unknown>>(collectionNames.patients, data.patientId);
      if (!patient || patient.clinicId !== user.clinicId) throw new HttpError(404, "Paciente nao encontrado.");
    }
    const entry = await addDoc(collectionNames.moduleWorkspaceEntries, {
      clinicId: user.clinicId,
      moduleId: data.moduleId,
      patientId: data.patientId ?? null,
      title: data.title,
      notes: data.notes,
      status: data.status,
      createdById: user.id,
      createdAt: now(),
      updatedAt: now()
    });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "CREATE", entity: "ModuleWorkspaceEntry", entityId: entry.id });
    res.status(201).json(entry);
  })
);
