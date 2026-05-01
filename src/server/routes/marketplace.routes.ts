import { Router } from "express";
import { z } from "zod";
import { addDoc, collectionNames, db, getById, now, serializeDocs } from "../firestore.js";
import { authenticate } from "../middleware/auth.js";
import { requireModule } from "../middleware/modules.js";
import { logAction } from "../services/audit.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

const listingSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  listingType: z.enum(["PRODUCT", "SERVICE", "EQUIPMENT", "COURSE"]),
  category: z.string().min(2).max(80),
  specialty: z.string().max(80).optional().nullable(),
  priceMode: z.enum(["QUOTE", "FIXED", "FROM"]).default("QUOTE"),
  price: z.coerce.number().min(0).optional().nullable(),
  contactName: z.string().min(2).max(100),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().max(40).optional().nullable(),
  location: z.string().max(120).optional().nullable()
});

const quoteRequestSchema = z.object({
  message: z.string().min(5).max(1200),
  contactName: z.string().min(2).max(100),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(40).optional().nullable()
});

export const marketplaceRouter = Router();
marketplaceRouter.use(authenticate);
marketplaceRouter.use(requireModule(["marketplace"]));

marketplaceRouter.get(
  "/listings",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const rows = serializeDocs<Record<string, unknown>>(
      await db().collection(collectionNames.marketplaceListings).get()
    )
      .filter((item) => item.status === "APPROVED" || item.clinicId === user.clinicId)
      .filter((item) => !req.query.type || item.listingType === req.query.type)
      .filter((item) => !req.query.category || String(item.category ?? "").toLowerCase().includes(String(req.query.category).toLowerCase()))
      .filter((item) => {
        const search = String(req.query.search ?? "").trim().toLowerCase();
        if (!search) return true;
        return [item.title, item.description, item.category, item.specialty].some((value) => String(value ?? "").toLowerCase().includes(search));
      })
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
      .slice(0, 200);
    res.json(rows);
  })
);

marketplaceRouter.post(
  "/listings",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const data = listingSchema.parse(req.body);
    const listing = await addDoc(collectionNames.marketplaceListings, {
      ...data,
      clinicId: user.clinicId,
      createdById: user.id,
      status: "PENDING",
      moderationNotes: null,
      createdAt: now(),
      updatedAt: now()
    });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "CREATE", entity: "MarketplaceListing", entityId: listing.id });
    res.status(201).json(listing);
  })
);

marketplaceRouter.get(
  "/quote-requests",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const [requested, received] = await Promise.all([
      db().collection(collectionNames.marketplaceQuoteRequests).where("requesterClinicId", "==", user.clinicId).get(),
      db().collection(collectionNames.marketplaceQuoteRequests).where("sellerClinicId", "==", user.clinicId).get()
    ]);
    const byId = new Map(
      [...serializeDocs<Record<string, unknown>>(requested), ...serializeDocs<Record<string, unknown>>(received)].map((item) => [item.id, item])
    );
    res.json(Array.from(byId.values()).sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))));
  })
);

marketplaceRouter.post(
  "/listings/:id/quote-requests",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const listing = await getById<Record<string, unknown>>(collectionNames.marketplaceListings, String(req.params.id));
    if (!listing || listing.status !== "APPROVED") throw new HttpError(404, "Anuncio nao encontrado ou ainda nao aprovado.");
    if (listing.clinicId === user.clinicId) throw new HttpError(400, "A propria clinica nao pode solicitar orcamento do seu anuncio.");
    const data = quoteRequestSchema.parse(req.body);
    const quote = await addDoc(collectionNames.marketplaceQuoteRequests, {
      ...data,
      listingId: listing.id,
      listingTitle: listing.title,
      requesterClinicId: user.clinicId,
      requesterUserId: user.id,
      sellerClinicId: listing.clinicId,
      status: "REQUESTED",
      createdAt: now(),
      updatedAt: now()
    });
    await logAction({ clinicId: user.clinicId, userId: user.id, action: "CREATE", entity: "MarketplaceQuoteRequest", entityId: quote.id });
    res.status(201).json(quote);
  })
);
