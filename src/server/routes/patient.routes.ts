import { Router } from "express";
import { z } from "zod";
import { collectionNames, addDoc, db, getById, now, serializeDocs, updateDoc } from "../firestore.js";
import { authenticate } from "../middleware/auth.js";
import { logAction } from "../services/audit.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

export const patientRouter = Router();
patientRouter.use(authenticate);

const patientSchema = z.object({
  fullName: z.string().min(2),
  birthDate: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  cpf: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  consentForAI: z.boolean().optional()
});

patientRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const snapshot = await db().collection(collectionNames.patients).where("clinicId", "==", user.clinicId).get();
    const patients = serializeDocs<Record<string, unknown>>(snapshot)
      .filter((patient) => !search || String(patient.fullName ?? "").toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
    res.json(patients);
  })
);

patientRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const data = patientSchema.parse(req.body);
    const patient = await addDoc(collectionNames.patients, {
      ...data,
      email: data.email || null,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      clinicId: user.clinicId,
      createdAt: now(),
      updatedAt: now()
    });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "CREATE", entity: "Patient", entityId: patient.id });
    res.status(201).json(patient);
  })
);

patientRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const id = String(req.params.id);
    const patient = await getById<Record<string, unknown>>(collectionNames.patients, id);
    if (patient?.clinicId !== user.clinicId) throw new HttpError(404, "Paciente nao encontrado.");
    const [records, documents, appointments] = await Promise.all([
      db().collection(collectionNames.clinicalRecords).where("clinicId", "==", user.clinicId).where("patientId", "==", id).get(),
      db().collection(collectionNames.documentFiles).where("clinicId", "==", user.clinicId).where("patientId", "==", id).get(),
      db().collection(collectionNames.appointments).where("clinicId", "==", user.clinicId).where("patientId", "==", id).get()
    ]);
    const response = {
      ...patient,
      clinicalRecords: serializeDocs<Record<string, unknown>>(records).sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
      ),
      documents: serializeDocs<Record<string, unknown>>(documents).sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
      ),
      appointments: serializeDocs<Record<string, unknown>>(appointments).sort((a, b) =>
        String(b.startTime ?? "").localeCompare(String(a.startTime ?? ""))
      )
    };
    if (!patient) throw new HttpError(404, "Paciente nao encontrado.");
    res.json(response);
  })
);

patientRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const id = String(req.params.id);
    const data = patientSchema.partial().parse(req.body);
    const exists = await getById<Record<string, unknown>>(collectionNames.patients, id);
    if (!exists || exists.clinicId !== user.clinicId) throw new HttpError(404, "Paciente nao encontrado.");
    const patient = await updateDoc(collectionNames.patients, id, {
      ...data,
      email: data.email || undefined,
      birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
      updatedAt: now()
    });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "UPDATE", entity: "Patient", entityId: patient.id });
    res.json(patient);
  })
);
