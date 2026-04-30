import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { config } from "../config.js";
import { addDoc, collectionNames, db, getById, now, serializeDocs, updateDoc } from "../firestore.js";
import { aiPrecisionLevels } from "../domain.js";
import { authenticate } from "../middleware/auth.js";
import { requireModule } from "../middleware/modules.js";
import { analyzeExamImage } from "../services/vision-ai.service.js";
import { logAction } from "../services/audit.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

fs.mkdirSync(config.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-exam-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new HttpError(400, "Envie uma imagem valida."));
    cb(null, true);
  }
});

const analyzeSchema = z.object({
  precisionLevel: z.enum(aiPrecisionLevels).default("SPECIALIST"),
  clinicalQuestion: z.string().max(1000).optional()
});

export const examImageRouter = Router();
examImageRouter.use(authenticate);
examImageRouter.use(requireModule(["exam-images-ai"]));

examImageRouter.get(
  "/patient/:patientId",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const patientId = String(req.params.patientId);
    const patient = await getById<Record<string, unknown>>(collectionNames.patients, patientId);
    if (!patient || patient.clinicId !== user.clinicId) throw new HttpError(404, "Paciente nao encontrado.");
    const exams = serializeDocs<Record<string, unknown>>(
      await db().collection(collectionNames.examImages).where("clinicId", "==", user.clinicId).where("patientId", "==", patientId).get()
    ).sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
    res.json(exams);
  })
);

examImageRouter.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const patientId = String(req.body.patientId ?? "");
    if (!req.file) throw new HttpError(400, "Imagem obrigatoria.");
    const patient = await getById<Record<string, unknown>>(collectionNames.patients, patientId);
    if (!patient || patient.clinicId !== user.clinicId) throw new HttpError(404, "Paciente nao encontrado.");

    const exam = await addDoc(collectionNames.examImages, {
      clinicId: user.clinicId,
      patientId,
      uploadedById: user.id,
      examType: String(req.body.examType ?? "Imagem odontologica"),
      clinicalQuestion: String(req.body.clinicalQuestion ?? ""),
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileUrl: `/uploads/${path.basename(req.file.path)}`,
      filePath: req.file.path,
      fileSize: req.file.size,
      analysisStatus: "PENDING",
      analysisResult: null,
      analyzedAt: null,
      createdAt: now()
    });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "UPLOAD", entity: "ExamImage", entityId: exam.id });
    res.status(201).json(exam);
  })
);

examImageRouter.post(
  "/:examId/analyze",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const examId = String(req.params.examId);
    const data = analyzeSchema.parse(req.body);
    const exam = await getById<Record<string, unknown>>(collectionNames.examImages, examId);
    if (!exam || exam.clinicId !== user.clinicId) throw new HttpError(404, "Exame nao encontrado.");
    const patient = await getById<Record<string, unknown>>(collectionNames.patients, String(exam.patientId));
    if (!patient || patient.clinicId !== user.clinicId) throw new HttpError(404, "Paciente nao encontrado.");

    const analysis = await analyzeExamImage({
      precisionLevel: data.precisionLevel,
      userId: user.id,
      clinicId: user.clinicId,
      patientId: String(exam.patientId),
      patientName: String(patient.fullName ?? ""),
      examType: String(exam.examType ?? "Imagem odontologica"),
      fileName: String(exam.fileName ?? ""),
      fileType: String(exam.fileType ?? "image/jpeg"),
      filePath: typeof exam.filePath === "string" ? exam.filePath : null,
      clinicalQuestion: data.clinicalQuestion || String(exam.clinicalQuestion ?? "")
    });

    const updated = await updateDoc(collectionNames.examImages, examId, {
      analysisStatus: "COMPLETED",
      analysisResult: analysis.text,
      analysisProvider: analysis.provider,
      precisionLevel: data.precisionLevel,
      analyzedById: user.id,
      analyzedAt: now()
    });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "AI_ANALYZE", entity: "ExamImage", entityId: examId });
    res.json({ exam: updated, analysis });
  })
);
