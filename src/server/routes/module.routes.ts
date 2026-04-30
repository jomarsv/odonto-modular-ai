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
  { key: "patients", name: "Pacientes", description: "Cadastro, busca e perfil de pacientes.", category: "CLINICAL", basePrice: 0, scope: "COMMON", specialtyKey: null, specialtyName: null },
  { key: "appointments", name: "Agenda", description: "Consultas, filtros e status de atendimento.", category: "ADMINISTRATIVE", basePrice: 0, scope: "COMMON", specialtyKey: null, specialtyName: null },
  { key: "records", name: "Prontuario", description: "Prontuario odontologico basico e historico clinico.", category: "CLINICAL", basePrice: 0, scope: "COMMON", specialtyKey: null, specialtyName: null },
  { key: "documents", name: "Documentos", description: "Upload logico de documentos e imagens.", category: "ADMINISTRATIVE", basePrice: 39.9, scope: "COMMON", specialtyKey: null, specialtyName: null },
  { key: "ai-basic", name: "IA Basica", description: "Mensagens e resumos simples com consumo medido.", category: "AI", basePrice: 79.9, scope: "COMMON", specialtyKey: null, specialtyName: null },
  { key: "ai-advanced", name: "IA Avancada", description: "Relatorios mais detalhados e contexto ampliado.", category: "AI", basePrice: 149.9, scope: "COMMON", specialtyKey: null, specialtyName: null },
  { key: "billing", name: "Cobranca", description: "Estimativa mensal por modulos e consumo.", category: "FINANCIAL", basePrice: 0, scope: "COMMON", specialtyKey: null, specialtyName: null },
  { key: "security-advanced", name: "Seguranca avancada", description: "Base futura para MFA, trilhas e politicas.", category: "SECURITY", basePrice: 49.9, scope: "COMMON", specialtyKey: null, specialtyName: null },
  { key: "exam-images-ai", name: "IA para imagens de exames", description: "Upload de imagens odontologicas e analise assistida por IA.", category: "AI", basePrice: 199.9, scope: "SPECIALTY", specialtyKey: "radiology", specialtyName: "Radiologia odontologica" },
  { key: "radiology-reports", name: "Laudos radiologicos", description: "Base para laudos de radiografias, tomografias e anexos de imagem.", category: "SPECIALTY", basePrice: 129.9, scope: "SPECIALTY", specialtyKey: "radiology", specialtyName: "Radiologia odontologica" },
  { key: "endodontics-planning", name: "Planejamento endodontico", description: "Ficha por subareas clinicas/cientificas da Endodontia: convencional, microscopica, cirurgica, regenerativa, vital, diagnostico avancado, microbiologia e tecnologia.", category: "SPECIALTY", basePrice: 89.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "orthodontics-planning", name: "Planejamento ortodontico", description: "Base para documentacao ortodontica, objetivos e acompanhamento.", category: "SPECIALTY", basePrice: 119.9, scope: "SPECIALTY", specialtyKey: "orthodontics", specialtyName: "Ortodontia" },
  { key: "implantology-planning", name: "Planejamento de implantes", description: "Base para planejamento cirurgico-protetico e checklist de implantes.", category: "SPECIALTY", basePrice: 149.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "periodontics-chart", name: "Periodontograma", description: "Estrutura futura para sondagem, mobilidade, recessao e sangramento.", category: "SPECIALTY", basePrice: 99.9, scope: "SPECIALTY", specialtyKey: "periodontics", specialtyName: "Periodontia" },
  { key: "pediatric-dentistry", name: "Odontopediatria", description: "Fluxos de atendimento infantil, responsaveis, comportamento e prevencao.", category: "SPECIALTY", basePrice: 79.9, scope: "SPECIALTY", specialtyKey: "pediatric", specialtyName: "Odontopediatria" },
  { key: "aesthetic-dentistry", name: "Odontologia estetica", description: "Planejamento estetico, fotografias, mockups e acompanhamento.", category: "SPECIALTY", basePrice: 109.9, scope: "SPECIALTY", specialtyKey: "aesthetics", specialtyName: "Odontologia estetica" }
] as const;

async function ensureAvailableModules() {
  await Promise.all(
    availableModules.map((module) =>
      setDoc(collectionNames.modules, module.key, {
        ...module,
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
    const modules = serializeDocs<Record<string, unknown>>(modulesSnapshot).sort((a, b) => {
      const scopeA = String(a.scope ?? "COMMON");
      const scopeB = String(b.scope ?? "COMMON");
      return `${scopeA}${a.specialtyName ?? ""}${a.category ?? ""}${a.name ?? ""}`.localeCompare(
        `${scopeB}${b.specialtyName ?? ""}${b.category ?? ""}${b.name ?? ""}`
      );
    });
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
