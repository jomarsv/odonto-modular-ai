import type { UserRole } from "./domain.js";

export type AuthUser = {
  id: string;
  clinicId: string;
  role: UserRole;
  name: string;
  email: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
