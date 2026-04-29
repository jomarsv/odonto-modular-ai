import bcrypt from "bcryptjs";
import { collectionNames, db, now, setDoc } from "../src/server/firestore.js";

const modules = [
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

async function main() {
  for (const [key, name, description, category, basePrice] of modules) {
    await setDoc(collectionNames.modules, key, {
      key,
      name,
      description,
      category,
      basePrice,
      isActive: true,
      createdAt: now(),
      updatedAt: now()
    });
  }

  const clinicId = "demo-clinic";
  const dentistId = "demo-dentist";
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
  for (const [key] of modules) {
    await setDoc(collectionNames.clinicModules, `${clinicId}_${key}`, {
      clinicId,
      moduleId: key,
      enabled: activeKeys.includes(key),
      activatedAt: activeKeys.includes(key) ? now() : null,
      deactivatedAt: activeKeys.includes(key) ? null : now()
    });
  }

  console.log("Seed Firestore concluido. Login demo: dentista@demo.com / demo1234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db().terminate();
  });
