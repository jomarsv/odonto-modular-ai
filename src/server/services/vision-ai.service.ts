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

function fallbackAnalysis(input: {
  examType: string;
  fileName: string;
  clinicalQuestion?: string;
}) {
  return `Analise visual simulada de exame odontologico\n\nO provider de visao computacional real nao esta configurado ou o arquivo da imagem nao esta disponivel no runtime atual.\n\nAchados assistivos simulados:\n- Conferir nitidez, contraste, enquadramento e identificacao do paciente.\n- Avaliar estruturas dentarias e osseas relevantes ao tipo de exame: ${input.examType}.\n- Correlacionar com anamnese, exame clinico e historico radiografico.\n\nHipoteses/diagnostico assistivo: nao determinado neste modo simulado.\n\nPergunta clinica: ${input.clinicalQuestion || "Nao informada"}\nArquivo: ${input.fileName}\n\n${disclaimer}`;
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
  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let modelName = config.openaiVisionModel;
  let usedProvider = "openai";

  try {
    if (!client || !input.filePath) throw new Error("Vision provider unavailable.");
    const bytes = await fs.readFile(input.filePath);
    const imageDataUrl = `data:${input.fileType};base64,${bytes.toString("base64")}`;
    const prompt = [
      "Voce e um assistente de apoio odontologico para analise visual de exames.",
      "Analise a imagem enviada e produza um relatorio estruturado em portugues do Brasil.",
      "Nao afirme certeza diagnostica. Use linguagem de hipotese, achado sugestivo e necessidade de confirmacao.",
      "Inclua obrigatoriamente: qualidade tecnica, achados visuais, hipoteses diagnosticas assistivas, limitacoes, recomendacoes de revisao profissional e proximos passos.",
      `Paciente: ${input.patientName}`,
      `Tipo de exame: ${input.examType}`,
      `Pergunta clinica: ${input.clinicalQuestion || "Nao informada"}`,
      `Nivel de precisao: ${input.precisionLevel}`
    ].join("\n");
    const response = await client.responses.create({
      model: modelName,
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
    text = `${response.output_text}\n\n${disclaimer}`;
    inputTokens = roughTokenCount(prompt) + imageTokenEstimate(input.precisionLevel);
    outputTokens = roughTokenCount(text);
  } catch {
    usedProvider = "mock";
    modelName = "mock-vision";
    text = fallbackAnalysis(input);
    inputTokens = roughTokenCount(`${input.examType} ${input.fileName} ${input.clinicalQuestion ?? ""}`) + 300;
    outputTokens = roughTokenCount(text);
  }

  const totalTokens = inputTokens + outputTokens;
  const estimatedCost = estimateAICost({
    inputTokens,
    outputTokens,
    precisionLevel: input.precisionLevel,
    modelName,
    featureKey: "exam-image-analysis"
  });

  const usageLog = await addDoc(collectionNames.aiUsageLogs, {
    clinicId: input.clinicId,
    userId: input.userId,
    patientId: input.patientId,
    featureKey: "exam-image-analysis",
    modelName,
    precisionLevel: input.precisionLevel,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCost,
    requestSummary: `${input.examType}: ${input.clinicalQuestion ?? ""}`.slice(0, 500),
    metadata: { provider: usedProvider, fileName: input.fileName, fileType: input.fileType },
    createdAt: now()
  });

  await createAIConsumptionBillingEvent({
    clinicId: input.clinicId,
    amount: estimatedCost,
    featureKey: "exam-image-analysis",
    totalTokens,
    usageLogId: usageLog.id
  });

  return { text, usage: usageLog, disclaimer, provider: usedProvider };
}
