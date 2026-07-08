import { z } from "zod";

export const createHotelSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
    description: z.string().optional(),
    address: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    country: z.string().min(1),
    postalCode: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email(),
    hotelTypeId: z.string().uuid().optional(),
    starRating: z.number().int().min(1).max(7).optional(),
    checkInTime: z.string().default("14:00"),
    checkOutTime: z.string().default("11:00"),
    defaultTaxPercent: z.number().min(0).max(100).optional(),
    amenities: z.array(z.string()).default([]),
    images: z.array(z.string()).default([]),
    // If a slug collides with a hotel that was previously deactivated,
    // the client can pass this to reactivate + overwrite it instead of
    // failing outright (surfaced by the frontend as "Restore instead?").
    reactivateIfInactive: z.boolean().optional(),
  }),
});

export const updateHotelSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: createHotelSchema.shape.body
    .omit({ slug: true, reactivateIfInactive: true })
    .partial(),
});

export const listHotelsQuerySchema = z.object({
  query: z.object({
    status: z.enum(["active", "inactive", "all"]).optional(),
    search: z.string().optional(),
  }),
});

// Marketing fields for the public curatdconcepts.com listing — kept
// separate from the hotel's own create/update schema above. See the
// WebsiteListing model doc comment in schema.prisma for why.
export const upsertWebsiteListingSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    isPublished: z.boolean().optional(),
    rating: z.number().min(0).max(5).nullable().optional(),
    reviewCount: z.number().int().min(0).optional(),
    platformLinks: z.record(z.string(), z.string()).optional(),
  }),
});
