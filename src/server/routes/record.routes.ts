import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { logAction } from "../services/audit.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

export const recordRouter = Router();
recordRouter.use(authenticate);

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
    const records = await prisma.clinicalRecord.findMany({
      where: { clinicId: user.clinicId, patientId },
      include: { dentist: { select: { name: true } } },
      orderBy: { createdAt: "desc" }
    });
    res.json(records);
  })
);

recordRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const data = recordSchema.parse(req.body);
    const patient = await prisma.patient.findFirst({ where: { id: data.patientId, clinicId: user.clinicId } });
    if (!patient) throw new HttpError(404, "Paciente nao encontrado.");
    const record = await prisma.clinicalRecord.create({
      data: { ...data, dentistId: data.dentistId ?? user.id, clinicId: user.clinicId }
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
    const exists = await prisma.clinicalRecord.findFirst({ where: { id, clinicId: user.clinicId } });
    if (!exists) throw new HttpError(404, "Prontuario nao encontrado.");
    const record = await prisma.clinicalRecord.update({ where: { id }, data });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "UPDATE", entity: "ClinicalRecord", entityId: record.id });
    res.json(record);
  })
);
