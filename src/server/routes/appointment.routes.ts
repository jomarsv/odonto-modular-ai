import { Router } from "express";
import { z } from "zod";
import { AppointmentStatus } from "@prisma/client";
import { prisma } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { logAction } from "../services/audit.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

export const appointmentRouter = Router();
appointmentRouter.use(authenticate);

const appointmentSchema = z.object({
  patientId: z.string().min(1),
  dentistId: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  status: z.nativeEnum(AppointmentStatus).default("SCHEDULED"),
  notes: z.string().optional().nullable()
});

appointmentRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    const dentistId = typeof req.query.dentistId === "string" ? req.query.dentistId : undefined;
    const start = date ? new Date(`${date}T00:00:00.000Z`) : undefined;
    const end = date ? new Date(`${date}T23:59:59.999Z`) : undefined;
    const appointments = await prisma.appointment.findMany({
      where: { clinicId: user.clinicId, dentistId, startTime: start && end ? { gte: start, lte: end } : undefined },
      include: { patient: true, dentist: { select: { id: true, name: true } } },
      orderBy: { startTime: "asc" }
    });
    res.json(appointments);
  })
);

appointmentRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const data = appointmentSchema.parse(req.body);
    const patient = await prisma.patient.findFirst({ where: { id: data.patientId, clinicId: user.clinicId } });
    if (!patient) throw new HttpError(404, "Paciente nao encontrado.");
    const appointment = await prisma.appointment.create({
      data: {
        clinicId: user.clinicId,
        patientId: data.patientId,
        dentistId: data.dentistId ?? user.id,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        status: data.status,
        notes: data.notes
      }
    });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "CREATE", entity: "Appointment", entityId: appointment.id });
    res.status(201).json(appointment);
  })
);

appointmentRouter.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const id = String(req.params.id);
    const { status } = z.object({ status: z.nativeEnum(AppointmentStatus) }).parse(req.body);
    const exists = await prisma.appointment.findFirst({ where: { id, clinicId: user.clinicId } });
    if (!exists) throw new HttpError(404, "Consulta nao encontrada.");
    const appointment = await prisma.appointment.update({ where: { id }, data: { status } });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "STATUS_UPDATE", entity: "Appointment", entityId: appointment.id });
    res.json(appointment);
  })
);
