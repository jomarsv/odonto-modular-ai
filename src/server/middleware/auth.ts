import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { HttpError } from "../utils/http.js";

type JwtPayload = {
  sub: string;
};

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return next(new HttpError(401, "Token ausente."));

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, clinicId: true }
    });
    if (!user?.clinicId) throw new HttpError(401, "Usuario sem clinica vinculada.");
    req.user = { ...user, clinicId: user.clinicId };
    return next();
  } catch (error) {
    return next(error instanceof HttpError ? error : new HttpError(401, "Token invalido."));
  }
}

export function authorize(roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Nao autenticado."));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "Acesso negado."));
    return next();
  };
}
