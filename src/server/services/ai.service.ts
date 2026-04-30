import type { AIPrecisionLevel } from "../domain.js";
import { addDoc, collectionNames, now } from "../firestore.js";
import { createAIConsumptionBillingEvent, estimateAICost } from "./billing.service.js";

const disclaimer =
  "Conteudo gerado por inteligencia artificial para apoio profissional. A decisao clinica final deve ser tomada por cirurgiao-dentista habilitado.";

const featureLabels: Record<string, string> = {
  "record-summary": "Resumo do prontuario",
  "clinical-report": "Relatorio clinico simples",
  "patient-guidance": "Mensagem de orientacao ao paciente",
  "exam-image-analysis": "Analise de imagem de exame odontologico"
};

function modelForPrecision(level: AIPrecisionLevel) {
  return process.env[`AI_MODEL_${level}`] ?? `mock-${level.toLowerCase()}`;
}

function roughTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

function buildPrompt(input: { featureKey: string; precisionLevel: AIPrecisionLevel; input: string; context?: string }) {
  return [
    `Funcao: ${featureLabels[input.featureKey] ?? input.featureKey}`,
    `Nivel de precisao: ${input.precisionLevel}`,
    input.context ? `Contexto: ${input.context}` : "",
    `Entrada: ${input.input}`,
    "Responda em portugues do Brasil, com tom profissional e claro."
  ]
    .filter(Boolean)
    .join("\n");
}

function mockGenerate(featureKey: string, precisionLevel: AIPrecisionLevel, input: string) {
  const intro = featureLabels[featureKey] ?? "Apoio odontologico";
  if (featureKey === "record-summary") {
    return `${intro}\n\nQueixa/Contexto\n${extractLine(input, "Paciente")}\n${extractSection(input, "Historico clinico")}\n\nAchados registrados\n${summarizeClinicalInput(input)}\n\nPlano em andamento\n${extractSection(input, "Procedimentos")}\n\nPendencias e alertas\n- Revisar informacoes clinicas antes de registrar conduta definitiva.\n- Confirmar achados em exame clinico e exames complementares quando necessario.\n\n${disclaimer}`;
  }
  if (featureKey === "exam-image-analysis") {
    return `${intro}\n\nAnalise simulada de exame por imagem.\n\nResumo: a imagem foi registrada para triagem e apoio profissional. Como este MVP ainda nao executa visao computacional real, o resultado considera metadados, tipo de exame e observacoes informadas.\n\nPontos de atencao:\n- Conferir qualidade, enquadramento e identificacao do paciente.\n- Validar achados diretamente na imagem original.\n- Registrar interpretacao final no prontuario somente apos revisao profissional.\n\nBase analisada: ${input.slice(0, 900)}\n\n${disclaimer}`;
  }
  const detail =
    precisionLevel === "BASIC"
      ? "Versao objetiva com foco nos pontos essenciais."
      : precisionLevel === "STANDARD"
        ? "Versao estruturada com contexto clinico moderado."
        : precisionLevel === "ADVANCED"
          ? "Versao detalhada com organizacao de achados, condutas e proximos passos."
          : "Versao especializada simulada, exigindo revisao humana obrigatoria.";
  return `${intro}\n\n${detail}\n\nBase analisada: ${input.slice(0, 900)}\n\n${disclaimer}`;
}

function extractLine(input: string, label: string) {
  return input
    .split("\n")
    .find((line) => line.toLowerCase().startsWith(label.toLowerCase()))
    ?.trim() || `${label}: nao informado`;
}

function extractSection(input: string, title: string) {
  const lines = input.split("\n");
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `${title}:`.toLowerCase());
  if (start < 0) return "- Nao informado.";
  const next = lines.findIndex((line, index) => index > start && line.trim().endsWith(":") && !line.trim().startsWith("-"));
  return lines.slice(start + 1, next > start ? next : undefined).join("\n").trim() || "- Nao informado.";
}

function summarizeClinicalInput(input: string) {
  const relevant = input
    .split("\n")
    .filter((line) => /Anamnese|Diagnostico|Plano de tratamento|Evolucao/i.test(line))
    .slice(0, 8);
  return relevant.length ? relevant.join("\n") : "- Sem achados clinicos textuais suficientes.";
}

export async function generateText(input: {
  featureKey: string;
  precisionLevel: AIPrecisionLevel;
  input: string;
  context?: string;
  userId: string;
  clinicId: string;
  patientId?: string;
}) {
  const prompt = buildPrompt(input);
  const modelName = modelForPrecision(input.precisionLevel);
  const generatedText = mockGenerate(input.featureKey, input.precisionLevel, input.input);
  const inputTokens = roughTokenCount(prompt);
  const outputTokens = roughTokenCount(generatedText);
  const totalTokens = inputTokens + outputTokens;
  const estimatedCost = estimateAICost({
    inputTokens,
    outputTokens,
    precisionLevel: input.precisionLevel,
    modelName,
    featureKey: input.featureKey
  });

  const usageLog = await addDoc(collectionNames.aiUsageLogs, {
    clinicId: input.clinicId,
    userId: input.userId,
    patientId: input.patientId ?? null,
    featureKey: input.featureKey,
    modelName,
    precisionLevel: input.precisionLevel,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCost,
    requestSummary: input.input.slice(0, 500),
    createdAt: now()
  });

  await createAIConsumptionBillingEvent({
    clinicId: input.clinicId,
    amount: estimatedCost,
    featureKey: input.featureKey,
    totalTokens,
    usageLogId: usageLog.id
  });

  return { text: generatedText, usage: usageLog, disclaimer };
}
