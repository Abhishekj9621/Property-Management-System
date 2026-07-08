-- ==========================================================
-- Public Website Listing
-- Adds: website_listings — the one new table needed to make this
-- backend the single source of truth for both the internal management
-- app and the public curatdconcepts.com marketing site. See
-- schema.prisma's WebsiteListing model doc comment for the rationale
-- (why this is a separate table from "hotels" rather than new columns).
-- ==========================================================

CREATE TABLE "website_listings" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "rating" DECIMAL(2,1),
  "reviewCount" INTEGER NOT NULL DEFAULT 0,
  "platformLinks" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "website_listings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "website_listings_hotelId_key" ON "website_listings"("hotelId");
CREATE INDEX "website_listings_isPublished_idx" ON "website_listings"("isPublished");

ALTER TABLE "website_listings" ADD CONSTRAINT "website_listings_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
