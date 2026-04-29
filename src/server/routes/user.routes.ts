import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authorize, authenticate } from "../middleware/auth.js";
import { userRoles } from "../domain.js";
import { addDoc, collectionNames, db, now, serializeDocs, updateDoc } from "../firestore.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";
import { logAction } from "../services/audit.service.js";

export const userRouter = Router();
userRouter.use(authenticate);

function withoutPasswordHash<T extends Record<string, unknown>>(user: T) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(userRoles)
});

const updateRoleSchema = z.object({
  role: z.enum(userRoles)
});

userRouter.get(
  "/",
  authorize(["ADMIN", "CLINIC_MANAGER"]),
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const users = serializeDocs<Record<string, unknown>>(
      await db().collection(collectionNames.users).where("clinicId", "==", user.clinicId).get()
    )
      .map(({ passwordHash: _passwordHash, ...item }) => item)
      .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
    res.json(users);
  })
);

userRouter.post(
  "/",
  authorize(["ADMIN", "CLINIC_MANAGER"]),
  asyncHandler(async (req, res) => {
    const authUser = requireUser(req);
    const data = createUserSchema.parse(req.body);
    const exists = !(await db().collection(collectionNames.users).where("email", "==", data.email).limit(1).get()).empty;
    if (exists) throw new HttpError(409, "E-mail ja cadastrado.");
    const passwordHash = await bcrypt.hash(data.password, 12);
    const created = await addDoc(collectionNames.users, {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      clinicId: authUser.clinicId,
      createdAt: now(),
      updatedAt: now()
    });
    await logAction({ clinicId: authUser.clinicId, userId: authUser.id, action: "CREATE", entity: "User", entityId: created.id });
    res.status(201).json(withoutPasswordHash(created));
  })
);

userRouter.patch(
  "/:id/role",
  authorize(["ADMIN", "CLINIC_MANAGER"]),
  asyncHandler(async (req, res) => {
    const authUser = requireUser(req);
    const id = String(req.params.id);
    if (id === authUser.id) throw new HttpError(400, "Nao altere a propria role por aqui.");
    const data = updateRoleSchema.parse(req.body);
    const snapshot = await db().collection(collectionNames.users).doc(id).get();
    if (!snapshot.exists || snapshot.data()?.clinicId !== authUser.clinicId) throw new HttpError(404, "Usuario nao encontrado.");
    const updated = await updateDoc(collectionNames.users, id, { role: data.role, updatedAt: now() });
    await logAction({ clinicId: authUser.clinicId, userId: authUser.id, action: "UPDATE_ROLE", entity: "User", entityId: id });
    res.json(withoutPasswordHash(updated));
  })
);
