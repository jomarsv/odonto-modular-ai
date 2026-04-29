import { Router } from "express";
import { z } from "zod";
import { AIPrecisionLevel } from "@prisma/client";
import { prisma } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { generateText } from "../services/ai.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

export const aiRouter = Router();
aiRouter.use(authenticate);

const aiSchema = z.object({
  featureKey: z.enum(["record-summary", "clinical-report", "patient-guidance"]),
  precisionLevel: z.nativeEnum(AIPrecisionLevel),
  input: z.string().min(5),
  context: z.string().optional(),
  patientId: z.string().optional()
});

aiRouter.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const data = aiSchema.parse(req.body);
    const aiModule = await prisma.clinicModule.findFirst({
      where: { clinicId: user.clinicId, enabled: true, module: { category: "AI" } },
      include: { module: true }
    });
    if (!aiModule) throw new HttpError(403, "Modulo de IA nao ativo para esta clinica.");
    if (data.patientId) {
      const patient = await prisma.patient.findFirst({ where: { id: data.patientId, clinicId: user.clinicId } });
      if (!patient) throw new HttpError(404, "Paciente nao encontrado.");
    }
    const result = await generateText({ ...data, userId: user.id, clinicId: user.clinicId });
    res.json(result);
  })
);

aiRouter.get(
  "/usage",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const logs = await prisma.aIUsageLog.findMany({
      where: { clinicId: user.clinicId },
      include: { patient: { select: { fullName: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.json(logs);
  })
);
