import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  uploadDir: process.env.UPLOAD_DIR ?? (process.env.VERCEL ? "/tmp/uploads" : "./uploads"),
  aiProvider: process.env.AI_PROVIDER ?? "mock"
};
