import { Router } from "express";
import { z } from "zod";
import { collectionNames, db, getById, now, serializeDocs, setDoc } from "../firestore.js";
import { authenticate } from "../middleware/auth.js";
import { logAction } from "../services/audit.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

export const moduleRouter = Router();
moduleRouter.use(authenticate);

moduleRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const [modulesSnapshot, clinicModulesSnapshot] = await Promise.all([
      db().collection(collectionNames.modules).where("isActive", "==", true).get(),
      db().collection(collectionNames.clinicModules).where("clinicId", "==", user.clinicId).get()
    ]);
    const clinicModules = serializeDocs<Record<string, unknown>>(clinicModulesSnapshot);
    const modules = serializeDocs<Record<string, unknown>>(modulesSnapshot).sort((a, b) =>
      `${a.category ?? ""}${a.name ?? ""}`.localeCompare(`${b.category ?? ""}${b.name ?? ""}`)
    );
    res.json(
      modules.map((module) => ({
        ...module,
        enabled: clinicModules.find((item) => item.moduleId === module.id)?.enabled ?? false,
        clinicModuleId: clinicModules.find((item) => item.moduleId === module.id)?.id
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
    const module = await getById<Record<string, unknown>>(collectionNames.modules, moduleId);
    if (!module) throw new HttpError(404, "Modulo nao encontrado.");
    const clinicModule = await setDoc(collectionNames.clinicModules, `${user.clinicId}_${module.id}`, {
      clinicId: user.clinicId,
      moduleId: module.id,
      enabled,
      activatedAt: enabled ? now() : null,
      deactivatedAt: enabled ? null : now()
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
