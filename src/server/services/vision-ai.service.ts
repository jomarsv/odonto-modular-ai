import fs from "node:fs/promises";
import OpenAI from "openai";
import type { AIPrecisionLevel } from "../domain.js";
import { config } from "../config.js";
import { addDoc, collectionNames, now } from "../firestore.js";
import { createAIConsumptionBillingEvent, estimateAICost } from "./billing.service.js";

const disclaimer =
  "Conteudo gerado por inteligencia artificial para apoio profissional. A decisao clinica final deve ser tomada por cirurgiao-dentista habilitado.";

function openaiClient() {
  if (!config.openaiApiKey) return null;
  return new OpenAI({ apiKey: config.openaiApiKey });
}

function roughTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

function imageTokenEstimate(precisionLevel: AIPrecisionLevel) {
  if (precisionLevel === "SPECIALIST") return 1600;
  if (precisionLevel === "ADVANCED") return 1100;
  if (precisionLevel === "STANDARD") return 700;
  return 300;
}

function detailForPrecision(precisionLevel: AIPrecisionLevel) {
  return precisionLevel === "SPECIALIST" || precisionLevel === "ADVANCED" ? "high" : "auto";
}

export async function analyzeExamImage(input: {
  clinicId: string;
  userId: string;
  patientId: string;
  patientName: string;
  examType: string;
  fileName: string;
  fileType: string;
  filePath?: string | null;
  clinicalQuestion?: string;
  precisionLevel: AIPrecisionLevel;
}) {
  const client = openaiClient();
  if (!client) throw new Error("OPENAI_API_KEY nao configurada. A analise de imagem exige visao computacional real.");
  if (!input.filePath) throw new Error("Arquivo da imagem indisponivel para analise visual real.");

  const bytes = await fs.readFile(input.filePath);
  const imageDataUrl = `data:${input.fileType};base64,${bytes.toString("base64")}`;
  const prompt = [
    "Voce e um assistente de apoio odontologico para analise visual de exames.",
    "Analise os pixels da imagem enviada e produza um relatorio estruturado em portugues do Brasil.",
    "Aponte achados visuais observaveis e hipoteses diagnosticas odontologicas assistivas quando houver elementos suficientes.",
    "Nao invente achados que nao estejam visiveis. Quando a imagem for inadequada, explique exatamente a limitacao tecnica.",
    "Inclua obrigatoriamente estas secoes: Qualidade tecnica, Achados visuais, Hipoteses diagnosticas assistivas, Condutas sugeridas para confirmacao, Limitacoes e Aviso profissional.",
    "Nao diga que a analise e simulada.",
    `Paciente: ${input.patientName}`,
    `Tipo de exame: ${input.examType}`,
    `Pergunta clinica: ${input.clinicalQuestion || "Nao informada"}`,
    `Nivel de precisao: ${input.precisionLevel}`
  ].join("\n");
  const response = await client.responses.create({
    model: config.openaiVisionModel,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: imageDataUrl, detail: detailForPrecision(input.precisionLevel) }
        ]
      }
    ]
  });
  const text = `${response.output_text}\n\n${disclaimer}`;
  const inputTokens = roughTokenCount(prompt) + imageTokenEstimate(input.precisionLevel);
  const outputTokens = roughTokenCount(text);

  const totalTokens = inputTokens + outputTokens;
  const estimatedCost = estimateAICost({
    inputTokens,
    outputTokens,
    precisionLevel: input.precisionLevel,
    modelName: config.openaiVisionModel,
    featureKey: "exam-image-analysis"
  });

  const usageLog = await addDoc(collectionNames.aiUsageLogs, {
    clinicId: input.clinicId,
    userId: input.userId,
    patientId: input.patientId,
    featureKey: "exam-image-analysis",
    modelName: config.openaiVisionModel,
    precisionLevel: input.precisionLevel,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCost,
    requestSummary: `${input.examType}: ${input.clinicalQuestion ?? ""}`.slice(0, 500),
    metadata: { provider: "openai", fileName: input.fileName, fileType: input.fileType },
    createdAt: now()
  });

  await createAIConsumptionBillingEvent({
    clinicId: input.clinicId,
    amount: estimatedCost,
    featureKey: "exam-image-analysis",
    totalTokens,
    usageLogId: usageLog.id
  });

  return { text, usage: usageLog, disclaimer, provider: "openai" };
}
