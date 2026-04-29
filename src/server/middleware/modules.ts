import type { NextFunction, Request, Response } from "express";
import { collectionNames, db } from "../firestore.js";
import { HttpError } from "../utils/http.js";

export function requireModule(moduleKeys: string[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, "Nao autenticado.");
      const snapshot = await db()
        .collection(collectionNames.clinicModules)
        .where("clinicId", "==", req.user.clinicId)
        .where("enabled", "==", true)
        .get();
      const enabled = new Set(snapshot.docs.map((doc) => String(doc.data().moduleId)));
      if (!moduleKeys.some((key) => enabled.has(key))) {
        throw new HttpError(403, "Modulo nao ativo para esta clinica.");
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
