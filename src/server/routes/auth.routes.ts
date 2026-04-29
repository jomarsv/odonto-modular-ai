import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "../db.js";
import { config } from "../config.js";
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
  role: z.nativeEnum(UserRole).default("CLINIC_MANAGER")
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email }, include: { clinic: true } });
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      throw new HttpError(401, "Credenciais invalidas.");
    }
    if (!user.clinicId) throw new HttpError(403, "Usuario sem clinica.");
    const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: "8h" });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, clinicId: user.clinicId },
      clinic: user.clinic
    });
  })
);

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) throw new HttpError(409, "E-mail ja cadastrado.");
    const passwordHash = await bcrypt.hash(data.password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({ data: { name: data.clinicName, email: data.email } });
      const user = await tx.user.create({
        data: { name: data.name, email: data.email, passwordHash, role: data.role, clinicId: clinic.id }
      });
      const modules = await tx.module.findMany({ where: { key: { in: ["patients", "appointments", "records", "billing"] } } });
      for (const module of modules) {
        await tx.clinicModule.create({
          data: { clinicId: clinic.id, moduleId: module.id, enabled: true, activatedAt: new Date() }
        });
      }
      return { clinic, user };
    });
    const token = jwt.sign({ sub: result.user.id }, config.jwtSecret, { expiresIn: "8h" });
    res.status(201).json({ token, user: result.user, clinic: result.clinic });
  })
);

authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, email: true, role: true, clinic: true }
    });
    res.json(profile);
  })
);
