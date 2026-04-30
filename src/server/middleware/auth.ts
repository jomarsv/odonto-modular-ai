import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import type { UserRole } from "../domain.js";
import { collectionNames, db, serializeDoc } from "../firestore.js";
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
    const user = serializeDoc<{ name: string; email: string; role: UserRole; clinicId?: string }>(
      await db().collection(collectionNames.users).doc(payload.sub).get()
    );
    if (!user) throw new HttpError(401, "Usuario nao encontrado.");
    if (!user.clinicId && user.role !== "LEO_TECH_ADMIN") throw new HttpError(401, "Usuario sem clinica vinculada.");
    req.user = { ...user, clinicId: user.clinicId ?? "__leo_tech_platform__" };
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
