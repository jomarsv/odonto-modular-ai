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

const procedureSchema = z.object({
  patientId: z.string().min(1),
  tooth: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  procedureName: z.string().min(2),
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED"]).default("PLANNED"),
  notes: z.string().optional().nullable()
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

recordRouter.get(
  "/patient/:patientId/summary",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const patientId = String(req.params.patientId);
    const patient = await getById<Record<string, unknown>>(collectionNames.patients, patientId);
    if (!patient || patient.clinicId !== user.clinicId) throw new HttpError(404, "Paciente nao encontrado.");
    const [records, procedures, documents, appointments] = await Promise.all([
      db().collection(collectionNames.clinicalRecords).where("clinicId", "==", user.clinicId).where("patientId", "==", patientId).get(),
      db().collection(collectionNames.clinicalProcedures).where("clinicId", "==", user.clinicId).where("patientId", "==", patientId).get(),
      db().collection(collectionNames.documentFiles).where("clinicId", "==", user.clinicId).where("patientId", "==", patientId).get(),
      db().collection(collectionNames.appointments).where("clinicId", "==", user.clinicId).where("patientId", "==", patientId).get()
    ]);
    res.json({
      patient,
      records: serializeDocs<Record<string, unknown>>(records).sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))),
      procedures: serializeDocs<Record<string, unknown>>(procedures).sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))),
      documents: serializeDocs<Record<string, unknown>>(documents).sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))),
      appointments: serializeDocs<Record<string, unknown>>(appointments).sort((a, b) => String(b.startTime ?? "").localeCompare(String(a.startTime ?? "")))
    });
  })
);

recordRouter.get(
  "/procedures/patient/:patientId",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const patientId = String(req.params.patientId);
    const procedures = serializeDocs<Record<string, unknown>>(
      await db().collection(collectionNames.clinicalProcedures).where("clinicId", "==", user.clinicId).where("patientId", "==", patientId).get()
    ).sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
    res.json(procedures);
  })
);

recordRouter.post(
  "/procedures",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const data = procedureSchema.parse(req.body);
    const patient = await getById<Record<string, unknown>>(collectionNames.patients, data.patientId);
    if (!patient || patient.clinicId !== user.clinicId) throw new HttpError(404, "Paciente nao encontrado.");
    const procedure = await addDoc(collectionNames.clinicalProcedures, {
      ...data,
      dentistId: user.id,
      clinicId: user.clinicId,
      createdAt: now(),
      updatedAt: now()
    });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "CREATE", entity: "ClinicalProcedure", entityId: procedure.id });
    res.status(201).json(procedure);
  })
);

recordRouter.patch(
  "/procedures/:id/status",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const id = String(req.params.id);
    const { status } = z.object({ status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED"]) }).parse(req.body);
    const exists = await getById<Record<string, unknown>>(collectionNames.clinicalProcedures, id);
    if (!exists || exists.clinicId !== user.clinicId) throw new HttpError(404, "Procedimento nao encontrado.");
    const procedure = await updateDoc(collectionNames.clinicalProcedures, id, { status, updatedAt: now() });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "UPDATE_STATUS", entity: "ClinicalProcedure", entityId: id });
    res.json(procedure);
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
