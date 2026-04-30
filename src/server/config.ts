import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  uploadDir: process.env.UPLOAD_DIR ?? (process.env.VERCEL ? "/tmp/uploads" : "./uploads"),
  aiProvider: process.env.AI_PROVIDER ?? "mock",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiVisionModel: process.env.OPENAI_VISION_MODEL ?? "gpt-4.1-mini",
  paymentProvider: process.env.PAYMENT_PROVIDER ?? "mock",
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:5173"
};
