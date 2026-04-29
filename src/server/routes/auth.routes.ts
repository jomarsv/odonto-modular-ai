import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { userRoles } from "../domain.js";
import type { UserRole } from "../domain.js";
import { collectionNames, db, getById, now, serializeDoc, serializeDocs, setDoc } from "../firestore.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  clinicName: z.string().min(2),
  role: z.enum(userRoles).default("CLINIC_MANAGER")
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const users = await db().collection(collectionNames.users).where("email", "==", data.email).limit(1).get();
    const user = serializeDocs<{ name: string; email: string; passwordHash: string; role: UserRole; clinicId?: string }>(users)[0];
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      throw new HttpError(401, "Credenciais invalidas.");
    }
    if (!user.clinicId) throw new HttpError(403, "Usuario sem clinica.");
    const clinic = await getById(collectionNames.clinics, user.clinicId);
    const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: "8h" });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, clinicId: user.clinicId },
      clinic
    });
  })
);

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const exists = !(await db().collection(collectionNames.users).where("email", "==", data.email).limit(1).get()).empty;
    if (exists) throw new HttpError(409, "E-mail ja cadastrado.");
    const passwordHash = await bcrypt.hash(data.password, 12);
    const clinicRef = db().collection(collectionNames.clinics).doc();
    const userRef = db().collection(collectionNames.users).doc();
    await setDoc(collectionNames.clinics, clinicRef.id, {
      name: data.clinicName,
      email: data.email,
      createdAt: now(),
      updatedAt: now()
    });
    await setDoc(collectionNames.users, userRef.id, {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      clinicId: clinicRef.id,
      createdAt: now(),
      updatedAt: now()
    });
    const modules = serializeDocs<{ key: string }>(
      await db().collection(collectionNames.modules).where("key", "in", ["patients", "appointments", "records", "billing"]).get()
    );
    await Promise.all(
      modules.map((module) =>
        setDoc(collectionNames.clinicModules, `${clinicRef.id}_${module.id}`, {
          clinicId: clinicRef.id,
          moduleId: module.id,
          enabled: true,
          activatedAt: now()
        })
      )
    );
    const user = await getById(collectionNames.users, userRef.id);
    const clinic = await getById(collectionNames.clinics, clinicRef.id);
    const token = jwt.sign({ sub: userRef.id }, config.jwtSecret, { expiresIn: "8h" });
    res.status(201).json({ token, user, clinic });
  })
);

authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const profile = serializeDoc<{ name: string; email: string; role: UserRole; clinicId: string }>(
      await db().collection(collectionNames.users).doc(user.id).get()
    );
    const clinic = profile?.clinicId ? await getById(collectionNames.clinics, profile.clinicId) : null;
    res.json(profile ? { ...profile, clinic } : null);
  })
);
