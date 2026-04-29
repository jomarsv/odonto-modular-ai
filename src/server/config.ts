import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  uploadDir: process.env.UPLOAD_DIR ?? (process.env.VERCEL ? "/tmp/uploads" : "./uploads"),
  aiProvider: process.env.AI_PROVIDER ?? "mock",
  paymentProvider: process.env.PAYMENT_PROVIDER ?? "mock",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:5173"
};
