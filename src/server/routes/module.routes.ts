import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { logAction } from "../services/audit.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

export const moduleRouter = Router();
moduleRouter.use(authenticate);

moduleRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const modules = await prisma.module.findMany({
      where: { isActive: true },
      include: { clinicModules: { where: { clinicId: user.clinicId } } },
      orderBy: [{ category: "asc" }, { name: "asc" }]
    });
    res.json(
      modules.map((module) => ({
        ...module,
        enabled: module.clinicModules[0]?.enabled ?? false,
        clinicModuleId: module.clinicModules[0]?.id
      }))
    );
  })
);

moduleRouter.patch(
  "/:moduleId",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const moduleId = String(req.params.moduleId);
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    const module = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) throw new HttpError(404, "Modulo nao encontrado.");
    const clinicModule = await prisma.clinicModule.upsert({
      where: { clinicId_moduleId: { clinicId: user.clinicId, moduleId: module.id } },
      update: { enabled, activatedAt: enabled ? new Date() : undefined, deactivatedAt: enabled ? null : new Date() },
      create: { clinicId: user.clinicId, moduleId: module.id, enabled, activatedAt: enabled ? new Date() : null }
    });
    await logAction({
      clinicId: user.clinicId,
      userId: user.id,
      action: enabled ? "ENABLE_MODULE" : "DISABLE_MODULE",
      entity: "Module",
      entityId: module.id
    });
    res.json(clinicModule);
  })
);
