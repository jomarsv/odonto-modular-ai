import { Router } from "express";
import { z } from "zod";
import { appointmentStatuses } from "../domain.js";
import { addDoc, collectionNames, db, getById, now, serializeDocs, updateDoc } from "../firestore.js";
import { authenticate } from "../middleware/auth.js";
import { requireModule } from "../middleware/modules.js";
import { logAction } from "../services/audit.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

export const appointmentRouter = Router();
appointmentRouter.use(authenticate);
appointmentRouter.use(requireModule(["appointments"]));

const appointmentSchema = z.object({
  patientId: z.string().min(1),
  dentistId: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  status: z.enum(appointmentStatuses).default("SCHEDULED"),
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
    const snapshot = await db().collection(collectionNames.appointments).where("clinicId", "==", user.clinicId).get();
    const rows = serializeDocs<Record<string, unknown>>(snapshot)
      .filter((item) => !dentistId || item.dentistId === dentistId)
      .filter((item) => {
        if (!start || !end) return true;
        const time = new Date(String(item.startTime));
        return time >= start && time <= end;
      })
      .sort((a, b) => String(a.startTime ?? "").localeCompare(String(b.startTime ?? "")));
    const appointments = await Promise.all(
      rows.map(async (item) => ({
        ...item,
        patient: item.patientId ? await getById(collectionNames.patients, String(item.patientId)) : null,
        dentist: item.dentistId ? await getById(collectionNames.users, String(item.dentistId)) : null
      }))
    );
    res.json(appointments);
  })
);

appointmentRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const data = appointmentSchema.parse(req.body);
    const patient = await getById<Record<string, unknown>>(collectionNames.patients, data.patientId);
    if (!patient || patient.clinicId !== user.clinicId) throw new HttpError(404, "Paciente nao encontrado.");
    const appointment = await addDoc(collectionNames.appointments, {
      clinicId: user.clinicId,
      patientId: data.patientId,
      dentistId: data.dentistId ?? user.id,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      status: data.status,
      notes: data.notes,
      createdAt: now(),
      updatedAt: now()
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
    const { status } = z.object({ status: z.enum(appointmentStatuses) }).parse(req.body);
    const exists = await getById<Record<string, unknown>>(collectionNames.appointments, id);
    if (!exists || exists.clinicId !== user.clinicId) throw new HttpError(404, "Consulta nao encontrada.");
    const appointment = await updateDoc(collectionNames.appointments, id, { status, updatedAt: now() });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "STATUS_UPDATE", entity: "Appointment", entityId: appointment.id });
    res.json(appointment);
  })
);
