import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
  aiProvider: process.env.AI_PROVIDER ?? "mock"
};
