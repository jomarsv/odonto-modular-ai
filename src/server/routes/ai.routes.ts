import { Router } from "express";
import { z } from "zod";
import { aiPrecisionLevels } from "../domain.js";
import { collectionNames, db, getById, serializeDocs } from "../firestore.js";
import { authenticate } from "../middleware/auth.js";
import { requireModule } from "../middleware/modules.js";
import { generateText } from "../services/ai.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

export const aiRouter = Router();
aiRouter.use(authenticate);
aiRouter.use(requireModule(["ai-basic", "ai-advanced"]));

const aiSchema = z.object({
  featureKey: z.enum(["record-summary", "clinical-report", "patient-guidance", "specialty-analysis", "specialty-question"]),
  precisionLevel: z.enum(aiPrecisionLevels),
  input: z.string().min(5),
  context: z.string().optional(),
  patientId: z.string().optional()
});

aiRouter.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const data = aiSchema.parse(req.body);
    const [clinicModules, modules] = await Promise.all([
      db().collection(collectionNames.clinicModules).where("clinicId", "==", user.clinicId).where("enabled", "==", true).get(),
      db().collection(collectionNames.modules).where("category", "==", "AI").get()
    ]);
    const aiModuleIds = new Set(serializeDocs(modules).map((module) => module.id));
    const aiModule = serializeDocs<Record<string, unknown>>(clinicModules).find((item) => aiModuleIds.has(String(item.moduleId)));
    if (!aiModule) throw new HttpError(403, "Modulo de IA nao ativo para esta clinica.");
    if (data.patientId) {
      const patient = await getById<Record<string, unknown>>(collectionNames.patients, data.patientId);
      if (!patient || patient.clinicId !== user.clinicId) throw new HttpError(404, "Paciente nao encontrado.");
    }
    const result = await generateText({ ...data, userId: user.id, clinicId: user.clinicId });
    res.json(result);
  })
);

aiRouter.get(
  "/usage",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const logsRaw = serializeDocs<Record<string, unknown>>(
      await db().collection(collectionNames.aiUsageLogs).where("clinicId", "==", user.clinicId).get()
    )
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
      .slice(0, 50);
    const logs = await Promise.all(
      logsRaw.map(async (log) => ({
        ...log,
        patient: log.patientId ? await getById(collectionNames.patients, String(log.patientId)) : null,
        user: log.userId ? await getById(collectionNames.users, String(log.userId)) : null
      }))
    );
    res.json(logs);
  })
);
