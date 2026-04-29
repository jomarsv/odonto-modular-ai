import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { config } from "../config.js";
import { addDoc, collectionNames, db, getById, now, serializeDocs } from "../firestore.js";
import { authenticate } from "../middleware/auth.js";
import { logAction } from "../services/audit.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

fs.mkdirSync(config.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`)
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

export const documentRouter = Router();
documentRouter.use(authenticate);

documentRouter.get(
  "/patient/:patientId",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const patientId = String(req.params.patientId);
    const docs = serializeDocs<Record<string, unknown>>(
      await db().collection(collectionNames.documentFiles).where("clinicId", "==", user.clinicId).where("patientId", "==", patientId).get()
    ).sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
    res.json(docs);
  })
);

documentRouter.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const patientId = String(req.body.patientId ?? "");
    if (!req.file) throw new HttpError(400, "Arquivo obrigatorio.");
    const patient = await getById<Record<string, unknown>>(collectionNames.patients, patientId);
    if (!patient || patient.clinicId !== user.clinicId) throw new HttpError(404, "Paciente nao encontrado.");

    const doc = await addDoc(collectionNames.documentFiles, {
      clinicId: user.clinicId,
      patientId,
      uploadedById: user.id,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileUrl: `/uploads/${path.basename(req.file.path)}`,
      fileSize: req.file.size,
      createdAt: now()
    });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "UPLOAD", entity: "DocumentFile", entityId: doc.id });
    res.status(201).json(doc);
  })
);
