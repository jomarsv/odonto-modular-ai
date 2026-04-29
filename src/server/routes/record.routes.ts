import { Router } from "express";
import { z } from "zod";
import { addDoc, collectionNames, db, getById, now, serializeDocs, updateDoc } from "../firestore.js";
import { authenticate } from "../middleware/auth.js";
import { requireModule } from "../middleware/modules.js";
import { logAction } from "../services/audit.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

export const recordRouter = Router();
recordRouter.use(authenticate);
recordRouter.use(requireModule(["records"]));

const recordSchema = z.object({
  patientId: z.string().min(1),
  dentistId: z.string().optional(),
  anamnesis: z.string().optional().nullable(),
  diagnosisNotes: z.string().optional().nullable(),
  treatmentPlan: z.string().optional().nullable(),
  evolutionNotes: z.string().optional().nullable()
});

recordRouter.get(
  "/patient/:patientId",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const patientId = String(req.params.patientId);
    const snapshot = await db()
      .collection(collectionNames.clinicalRecords)
      .where("clinicId", "==", user.clinicId)
      .where("patientId", "==", patientId)
      .get();
    const records = await Promise.all(
      serializeDocs<Record<string, unknown>>(snapshot)
        .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
        .map(async (record) => ({
          ...record,
          dentist: record.dentistId ? await getById(collectionNames.users, String(record.dentistId)) : null
        }))
    );
    res.json(records);
  })
);

recordRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const data = recordSchema.parse(req.body);
    const patient = await getById<Record<string, unknown>>(collectionNames.patients, data.patientId);
    if (!patient || patient.clinicId !== user.clinicId) throw new HttpError(404, "Paciente nao encontrado.");
    const record = await addDoc(collectionNames.clinicalRecords, {
      ...data,
      dentistId: data.dentistId ?? user.id,
      clinicId: user.clinicId,
      createdAt: now(),
      updatedAt: now()
    });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "CREATE", entity: "ClinicalRecord", entityId: record.id });
    res.status(201).json(record);
  })
);

recordRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const id = String(req.params.id);
    const data = recordSchema.partial().parse(req.body);
    const exists = await getById<Record<string, unknown>>(collectionNames.clinicalRecords, id);
    if (!exists || exists.clinicId !== user.clinicId) throw new HttpError(404, "Prontuario nao encontrado.");
    const record = await updateDoc(collectionNames.clinicalRecords, id, { ...data, updatedAt: now() });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "UPDATE", entity: "ClinicalRecord", entityId: record.id });
    res.json(record);
  })
);
