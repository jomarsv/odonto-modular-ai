import { Router } from "express";
import { z } from "zod";
import { collectionNames, db, getById, now, serializeDocs, setDoc } from "../firestore.js";
import { authenticate } from "../middleware/auth.js";
import { logAction } from "../services/audit.service.js";
import { createModuleBillingEvent } from "../services/billing.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

export const moduleRouter = Router();
moduleRouter.use(authenticate);

const availableModules = [
  ["patients", "Pacientes", "Cadastro, busca e perfil de pacientes.", "CLINICAL", 0],
  ["appointments", "Agenda", "Consultas, filtros e status de atendimento.", "ADMINISTRATIVE", 0],
  ["records", "Prontuario", "Prontuario odontologico basico e historico clinico.", "CLINICAL", 0],
  ["documents", "Documentos", "Upload logico de documentos e imagens.", "ADMINISTRATIVE", 39.9],
  ["ai-basic", "IA Basica", "Mensagens e resumos simples com consumo medido.", "AI", 79.9],
  ["ai-advanced", "IA Avancada", "Relatorios mais detalhados e contexto ampliado.", "AI", 149.9],
  ["exam-images-ai", "IA para imagens de exames", "Upload de imagens odontologicas e analise assistida por IA.", "AI", 199.9],
  ["billing", "Cobranca", "Estimativa mensal por modulos e consumo.", "FINANCIAL", 0],
  ["security-advanced", "Seguranca avancada", "Base futura para MFA, trilhas e politicas.", "SECURITY", 49.9]
] as const;

async function ensureAvailableModules() {
  await Promise.all(
    availableModules.map(([key, name, description, category, basePrice]) =>
      setDoc(collectionNames.modules, key, {
        key,
        name,
        description,
        category,
        basePrice,
        isActive: true,
        updatedAt: now()
      })
    )
  );
}

moduleRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    await ensureAvailableModules();
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
    const previous = await getById<Record<string, unknown>>(collectionNames.clinicModules, `${user.clinicId}_${module.id}`);
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
    if (previous?.enabled !== enabled) {
      await createModuleBillingEvent({
        clinicId: user.clinicId,
        moduleId: String(module.id),
        moduleName: String(module.name ?? module.key ?? module.id),
        enabled,
        monthlyPrice: Number(module.basePrice ?? 0)
      });
    }
    res.json(clinicModule);
  })
);
