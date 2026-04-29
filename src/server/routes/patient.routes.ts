import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
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
    const patients = await prisma.patient.findMany({
      where: { clinicId: user.clinicId, fullName: search ? { contains: search, mode: "insensitive" } : undefined },
      orderBy: { createdAt: "desc" }
    });
    res.json(patients);
  })
);

patientRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const data = patientSchema.parse(req.body);
    const patient = await prisma.patient.create({
      data: { ...data, email: data.email || null, birthDate: data.birthDate ? new Date(data.birthDate) : null, clinicId: user.clinicId }
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
    const patient = await prisma.patient.findFirst({
      where: { id, clinicId: user.clinicId },
      include: {
        clinicalRecords: { orderBy: { createdAt: "desc" }, include: { dentist: { select: { name: true } } } },
        documents: { orderBy: { createdAt: "desc" } },
        appointments: { orderBy: { startTime: "desc" } }
      }
    });
    if (!patient) throw new HttpError(404, "Paciente nao encontrado.");
    res.json(patient);
  })
);

patientRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const id = String(req.params.id);
    const data = patientSchema.partial().parse(req.body);
    const exists = await prisma.patient.findFirst({ where: { id, clinicId: user.clinicId } });
    if (!exists) throw new HttpError(404, "Paciente nao encontrado.");
    const patient = await prisma.patient.update({
      where: { id },
      data: { ...data, email: data.email || undefined, birthDate: data.birthDate ? new Date(data.birthDate) : undefined }
    });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "UPDATE", entity: "Patient", entityId: patient.id });
    res.json(patient);
  })
);
