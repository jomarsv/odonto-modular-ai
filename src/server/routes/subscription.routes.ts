import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { requireModule } from "../middleware/modules.js";
import { activateMockSubscription, createSubscriptionCheckout, getClinicSubscription, processPaymentWebhook } from "../services/payment.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

export const subscriptionRouter = Router();

const webhookSchema = z.object({
  eventId: z.string().min(6),
  eventType: z.string().min(3),
  clinicId: z.string().min(6),
  provider: z.string().optional(),
  amount: z.number().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional()
});

subscriptionRouter.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    if (config.paymentWebhookSecret) {
      const receivedSecret = req.header("x-payment-webhook-secret");
      if (receivedSecret !== config.paymentWebhookSecret) throw new HttpError(401, "Webhook nao autorizado.");
    }
    const input = webhookSchema.parse(req.body);
    res.json(await processPaymentWebhook(input));
  })
);

subscriptionRouter.use(authenticate);
subscriptionRouter.use(requireModule(["billing"]));

subscriptionRouter.get(
  "/current",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    res.json({ subscription: await getClinicSubscription(user.clinicId) });
  })
);

subscriptionRouter.post(
  "/checkout",
  authorize(["ADMIN", "CLINIC_MANAGER"]),
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    res.status(201).json(await createSubscriptionCheckout({ clinicId: user.clinicId, userId: user.id }));
  })
);

subscriptionRouter.post(
  "/mock/activate",
  authorize(["ADMIN", "CLINIC_MANAGER"]),
  asyncHandler(async (req, res) => {
    z.object({ confirm: z.literal(true) }).parse(req.body);
    const user = requireUser(req);
    res.json({ subscription: await activateMockSubscription({ clinicId: user.clinicId }) });
  })
);
