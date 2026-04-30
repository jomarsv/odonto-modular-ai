import bcrypt from "bcryptjs";
import { collectionNames, db, now, setDoc } from "../src/server/firestore.js";

const modules = [
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
  { key: "endodontics-planning", name: "Planejamento endodontico", description: "Ficha base para diagnostico, plano endodontico, canais, testes, achados e acompanhamento.", category: "SPECIALTY", basePrice: 89.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "endodontics-conventional", name: "Endodontia clinica convencional", description: "Tratamento de canal, retratamento, controle de infeccoes pulpares e diagnostico de dor endodontica.", category: "SPECIALTY", basePrice: 79.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "endodontics-microscopic", name: "Endodontia microscopica", description: "Microscopio operatorio para canais calcificados, instrumentos fraturados e anatomias complexas.", category: "SPECIALTY", basePrice: 129.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "endodontics-surgical", name: "Endodontia cirurgica / parendodontica", description: "Apicectomia, curetagem periapical, retrobturacao e manejo de falhas do tratamento convencional.", category: "SPECIALTY", basePrice: 149.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "endodontics-regenerative", name: "Endodontia regenerativa", description: "Regeneracao tecidual e manejo de dentes imaturos com necrose pulpar e raiz incompleta.", category: "SPECIALTY", basePrice: 159.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "endodontics-vital", name: "Endodontia biologica / vital", description: "Preservacao da polpa viva, capeamentos pulpares, pulpotomia e tratamentos conservadores.", category: "SPECIALTY", basePrice: 99.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "endodontics-advanced-diagnosis", name: "Diagnostico endodontico avancado", description: "Testes de vitalidade, interpretacao de dor e correlacao com radiografia ou CBCT.", category: "SPECIALTY", basePrice: 119.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "endodontics-microbiology", name: "Microbiologia endodontica", description: "Biofilmes, bacterias dos canais radiculares, infeccao persistente e resistencia microbiana.", category: "SPECIALTY", basePrice: 109.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "endodontics-technology", name: "Endodontia tecnologica", description: "Instrumentacao rotatoria/reciprocante, localizadores apicais e sistemas avancados de irrigacao.", category: "SPECIALTY", basePrice: 119.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "orthodontics-planning", name: "Planejamento ortodontico", description: "Base para documentacao ortodontica, objetivos e acompanhamento.", category: "SPECIALTY", basePrice: 119.9, scope: "SPECIALTY", specialtyKey: "orthodontics", specialtyName: "Ortodontia" },
  { key: "implantology-planning", name: "Planejamento de implantes", description: "Base para planejamento cirurgico-protetico, avaliacao de risco e checklist de implantes.", category: "SPECIALTY", basePrice: 149.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-surgical", name: "Implantodontia cirurgica", description: "Instalacao de implantes, acesso osseo, volume/densidade ossea, implantes unitarios, multiplos e imediatos.", category: "SPECIALTY", basePrice: 139.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-prosthetic", name: "Implantodontia protetica", description: "Reabilitacao sobre implantes, coroas, proteses fixas, protocolo, ajustes oclusais e estetica funcional.", category: "SPECIALTY", basePrice: 129.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-bone-regeneration", name: "Implantodontia com regeneracao ossea", description: "Enxertos osseos, regeneracao ossea guiada, biomateriais e preparo de leito para implantes.", category: "SPECIALTY", basePrice: 159.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-advanced-surgeries", name: "Implantodontia com cirurgias avancadas", description: "Sinus lift, expansao ossea, split crest e cirurgias reconstrutivas.", category: "SPECIALTY", basePrice: 179.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-immediate", name: "Implantodontia imediata", description: "Implante no momento da extracao, estabilidade primaria, reducao de tempo e planejamento preciso.", category: "SPECIALTY", basePrice: 149.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-guided", name: "Implantodontia guiada", description: "Planejamento digital com CBCT/software, guias cirurgicos e execucao minimamente invasiva.", category: "SPECIALTY", basePrice: 169.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-aesthetic", name: "Implantodontia estetica", description: "Regiao anterior, contorno gengival, harmonia facial e perfil de emergencia.", category: "SPECIALTY", basePrice: 149.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-peri-implant", name: "Implantodontia peri-implantar", description: "Peri-implantite, mucosite peri-implantar, manutencao preventiva e complicacoes.", category: "SPECIALTY", basePrice: 119.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-biomaterials", name: "Implantodontia biomateriais e superficies", description: "Tipos de implantes, tratamentos de superficie, biomateriais e osseointegracao.", category: "SPECIALTY", basePrice: 109.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-digital-ai", name: "Implantodontia digital / inteligente", description: "Planejamento digital completo, simulacao, integracao com IA e predicao de sucesso do implante.", category: "SPECIALTY", basePrice: 189.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "periodontics-chart", name: "Periodontograma", description: "Estrutura futura para sondagem, mobilidade, recessao e sangramento.", category: "SPECIALTY", basePrice: 99.9, scope: "SPECIALTY", specialtyKey: "periodontics", specialtyName: "Periodontia" },
  { key: "pediatric-dentistry", name: "Odontopediatria", description: "Fluxos de atendimento infantil, responsaveis, comportamento e prevencao.", category: "SPECIALTY", basePrice: 79.9, scope: "SPECIALTY", specialtyKey: "pediatric", specialtyName: "Odontopediatria" },
  { key: "aesthetic-dentistry", name: "Odontologia estetica", description: "Planejamento estetico, fotografias, mockups e acompanhamento.", category: "SPECIALTY", basePrice: 109.9, scope: "SPECIALTY", specialtyKey: "aesthetics", specialtyName: "Odontologia estetica" }
] as const;

async function main() {
  for (const module of modules) {
    await setDoc(collectionNames.modules, module.key, {
      ...module,
      isActive: true,
      createdAt: now(),
      updatedAt: now()
    });
  }

  const clinicId = "demo-clinic";
  const dentistId = "demo-dentist";
  const leoTechAdminId = "leo-tech-admin";
  const patientId = "demo-patient";
  const passwordHash = await bcrypt.hash("demo1234", 12);

  await setDoc(collectionNames.clinics, clinicId, {
    name: "Clinica Sorriso Modular",
    documentNumber: "12.345.678/0001-90",
    phone: "(11) 4002-8922",
    email: "contato@sorrisomodular.test",
    address: "Av. Saude, 1000",
    createdAt: now(),
    updatedAt: now()
  });

  await setDoc(collectionNames.users, dentistId, {
    name: "Dra. Ana Modular",
    email: "dentista@demo.com",
    passwordHash,
    role: "DENTIST",
    clinicId,
    createdAt: now(),
    updatedAt: now()
  });

  await setDoc(collectionNames.users, leoTechAdminId, {
    name: "LEO-Tech Admin",
    email: "admin@leo-tech.com.br",
    passwordHash,
    role: "LEO_TECH_ADMIN",
    clinicId: null,
    createdAt: now(),
    updatedAt: now()
  });

  await setDoc(collectionNames.patients, patientId, {
    clinicId,
    fullName: "Carlos Almeida",
    birthDate: new Date("1988-05-10"),
    phone: "(11) 99999-0000",
    email: "carlos@example.com",
    cpf: "123.456.789-00",
    address: "Rua das Flores, 50",
    notes: "Paciente demo para validacao do MVP.",
    consentForAI: true,
    createdAt: now(),
    updatedAt: now()
  });

  await setDoc(collectionNames.clinicalRecords, "demo-record", {
    clinicId,
    patientId,
    dentistId,
    anamnesis: "Paciente relata sensibilidade ao frio.",
    diagnosisNotes: "Avaliar restauracao em molar inferior.",
    treatmentPlan: "Profilaxia, radiografia e acompanhamento.",
    evolutionNotes: "Primeira consulta registrada.",
    createdAt: now(),
    updatedAt: now()
  });

  await setDoc(collectionNames.appointments, "demo-appointment", {
    clinicId,
    patientId,
    dentistId,
    startTime: new Date(),
    endTime: new Date(Date.now() + 60 * 60 * 1000),
    status: "SCHEDULED",
    notes: "Consulta demo.",
    createdAt: now(),
    updatedAt: now()
  });

  const activeKeys = ["patients", "appointments", "records", "documents", "ai-basic", "billing"];
  for (const module of modules) {
    await setDoc(collectionNames.clinicModules, `${clinicId}_${module.key}`, {
      clinicId,
      moduleId: module.key,
      enabled: activeKeys.includes(module.key),
      activatedAt: activeKeys.includes(module.key) ? now() : null,
      deactivatedAt: activeKeys.includes(module.key) ? null : now()
    });
  }

  console.log("Seed Firestore concluido. Login demo: dentista@demo.com / demo1234");
  console.log("Login LEO-Tech: admin@leo-tech.com.br / demo1234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db().terminate();
  });
