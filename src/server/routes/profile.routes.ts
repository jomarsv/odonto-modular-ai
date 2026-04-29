import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { collectionNames, db, now, serializeDoc, updateDoc } from "../firestore.js";
import { logAction } from "../services/audit.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

export const profileRouter = Router();
profileRouter.use(authenticate);

const profileSchema = z.object({
  name: z.string().min(2)
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8)
});

function withoutPasswordHash<T extends Record<string, unknown> | null>(user: T) {
  if (!user) return user;
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

profileRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const profile = serializeDoc<Record<string, unknown>>(await db().collection(collectionNames.users).doc(user.id).get());
    res.json(withoutPasswordHash(profile));
  })
);

profileRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const data = profileSchema.parse(req.body);
    const profile = await updateDoc(collectionNames.users, user.id, { name: data.name, updatedAt: now() });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "UPDATE_PROFILE", entity: "User", entityId: user.id });
    res.json(withoutPasswordHash(profile));
  })
);

profileRouter.post(
  "/password",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const data = passwordSchema.parse(req.body);
    const current = serializeDoc<Record<string, unknown>>(await db().collection(collectionNames.users).doc(user.id).get());
    if (!current?.passwordHash || !(await bcrypt.compare(data.currentPassword, String(current.passwordHash)))) {
      throw new HttpError(401, "Senha atual invalida.");
    }
    const passwordHash = await bcrypt.hash(data.newPassword, 12);
    await updateDoc(collectionNames.users, user.id, { passwordHash, updatedAt: now() });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "CHANGE_PASSWORD", entity: "User", entityId: user.id });
    res.json({ ok: true });
  })
);
