import { Router } from "express";
import { collectionNames, db, getById, serializeDocs } from "../firestore.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { asyncHandler, requireUser } from "../utils/http.js";

export const auditRouter = Router();
auditRouter.use(authenticate);
auditRouter.use(authorize(["ADMIN", "CLINIC_MANAGER"]));

auditRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const rows = serializeDocs<Record<string, unknown>>(
      await db().collection(collectionNames.actionLogs).where("clinicId", "==", user.clinicId).get()
    )
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
      .slice(0, 100);
    const logs = await Promise.all(
      rows.map(async (log) => ({
        ...log,
        user: log.userId ? await getById(collectionNames.users, String(log.userId)) : null
      }))
    );
    res.json(logs);
  })
);
