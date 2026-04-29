import { PrismaClient, ModuleCategory, UserRole, AppointmentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const modules = [
  ["patients", "Pacientes", "Cadastro, busca e perfil de pacientes.", ModuleCategory.CLINICAL, "0.00"],
  ["appointments", "Agenda", "Consultas, filtros e status de atendimento.", ModuleCategory.ADMINISTRATIVE, "0.00"],
  ["records", "Prontuario", "Prontuario odontologico basico e historico clinico.", ModuleCategory.CLINICAL, "0.00"],
  ["documents", "Documentos", "Upload logico de documentos e imagens.", ModuleCategory.ADMINISTRATIVE, "39.90"],
  ["ai-basic", "IA Basica", "Mensagens e resumos simples com consumo medido.", ModuleCategory.AI, "79.90"],
  ["ai-advanced", "IA Avancada", "Relatorios mais detalhados e contexto ampliado.", ModuleCategory.AI, "149.90"],
  ["billing", "Cobranca", "Estimativa mensal por modulos e consumo.", ModuleCategory.FINANCIAL, "0.00"],
  ["security-advanced", "Seguranca avancada", "Base futura para MFA, trilhas e politicas.", ModuleCategory.SECURITY, "49.90"]
] as const;

async function main() {
  for (const [key, name, description, category, basePrice] of modules) {
    await prisma.module.upsert({
      where: { key },
      update: { name, description, category, basePrice },
      create: { key, name, description, category, basePrice }
    });
  }

  const clinic = await prisma.clinic.upsert({
    where: { id: "demo-clinic" },
    update: {},
    create: {
      id: "demo-clinic",
      name: "Clinica Sorriso Modular",
      documentNumber: "12.345.678/0001-90",
      phone: "(11) 4002-8922",
      email: "contato@sorrisomodular.test",
      address: "Av. Saude, 1000"
    }
  });

  const passwordHash = await bcrypt.hash("demo1234", 12);
  const dentist = await prisma.user.upsert({
    where: { email: "dentista@demo.com" },
    update: { passwordHash, clinicId: clinic.id },
    create: {
      name: "Dra. Ana Modular",
      email: "dentista@demo.com",
      passwordHash,
      role: UserRole.DENTIST,
      clinicId: clinic.id
    }
  });

  const patient = await prisma.patient.upsert({
    where: { id: "demo-patient" },
    update: {},
    create: {
      id: "demo-patient",
      clinicId: clinic.id,
      fullName: "Carlos Almeida",
      birthDate: new Date("1988-05-10"),
      phone: "(11) 99999-0000",
      email: "carlos@example.com",
      cpf: "123.456.789-00",
      address: "Rua das Flores, 50",
      notes: "Paciente demo para validacao do MVP.",
      consentForAI: true
    }
  });

  await prisma.clinicalRecord.create({
    data: {
      clinicId: clinic.id,
      patientId: patient.id,
      dentistId: dentist.id,
      anamnesis: "Paciente relata sensibilidade ao frio.",
      diagnosisNotes: "Avaliar restauracao em molar inferior.",
      treatmentPlan: "Profilaxia, radiografia e acompanhamento.",
      evolutionNotes: "Primeira consulta registrada."
    }
  });

  await prisma.appointment.create({
    data: {
      clinicId: clinic.id,
      patientId: patient.id,
      dentistId: dentist.id,
      startTime: new Date(),
      endTime: new Date(Date.now() + 60 * 60 * 1000),
      status: AppointmentStatus.SCHEDULED,
      notes: "Consulta demo."
    }
  });

  const activeKeys = ["patients", "appointments", "records", "documents", "ai-basic", "billing"];
  const allModules = await prisma.module.findMany();
  for (const module of allModules) {
    await prisma.clinicModule.upsert({
      where: { clinicId_moduleId: { clinicId: clinic.id, moduleId: module.id } },
      update: {
        enabled: activeKeys.includes(module.key),
        activatedAt: activeKeys.includes(module.key) ? new Date() : null,
        deactivatedAt: activeKeys.includes(module.key) ? null : new Date()
      },
      create: {
        clinicId: clinic.id,
        moduleId: module.id,
        enabled: activeKeys.includes(module.key),
        activatedAt: activeKeys.includes(module.key) ? new Date() : null
      }
    });
  }

  console.log("Seed concluido. Login demo: dentista@demo.com / demo1234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
