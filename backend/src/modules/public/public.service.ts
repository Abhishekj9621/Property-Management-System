import { prisma } from "../../config/database";
import { sendMail } from "../../utils/mailer";
import { env } from "../../config/env";

// Any amenity string that looks like it's declaring air conditioning.
// Matches "AC", "A/C", "Air Conditioning", etc. but not words that merely
// contain the substring "ac" (e.g. "Balcony", "Pack").
const AC_PATTERN = /(^|\s)a\/?\s?c(\s|$)|air[\s-]?condition/i;

function hasAc(amenities: string[]): boolean {
  return amenities.some((a) => AC_PATTERN.test(a));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export interface PublicRoomType {
  id: string;
  name: string;
  category: string | null;
  ac: boolean;
  price: number;
  weekendPrice: number | null;
  bedType: string | null;
  sizeSqft: number | null;
  minOccupancy: number;
  maxOccupancy: number;
  amenities: string[];
  images: string[];
  roomCount: number;
}

export interface PublicListing {
  hotelId: string;
  slug: string;
  name: string;
  type: string;
  location: string;
  city: string;
  state: string;
  description: string;
  guests: number;
  bedrooms: number;
  bathrooms: number;
  price: number;
  images: string[];
  amenities: string[];
  rating: number | null;
  reviewCount: number;
  platformLinks: Record<string, string>;
  roomTypes: PublicRoomType[];
  updatedAt: string;
}

/**
 * Live feed for curatdconcepts.com — called directly from the browser
 * (see GET /public/listings), not a sync job. Only hotels with a
 * *published* WebsiteListing show up here; everything else in the ops
 * system stays invisible to the public site.
 */
async function listPublishedListings(): Promise<PublicListing[]> {
  const listings = await prisma.websiteListing.findMany({
    where: { isPublished: true },
    include: {
      hotel: {
        include: {
          hotelType: true,
          roomTypes: {
            where: { isActive: true },
            include: { category: true, rooms: true },
          },
        },
      },
    },
    orderBy: { hotel: { name: "asc" } },
  });

  // Fallback average rating for listings that haven't had a manual rating
  // set yet — computed from actual published Reviews in the system.
  const hotelIds = listings.map((l) => l.hotelId);
  const reviewAggregates = hotelIds.length
    ? await prisma.review.groupBy({
        by: ["hotelId"],
        where: { hotelId: { in: hotelIds }, isPublished: true },
        _avg: { rating: true },
      })
    : [];
  const avgByHotel = new Map(reviewAggregates.map((r) => [r.hotelId, r._avg.rating]));

  return listings.map((listing) => {
    const hotel = listing.hotel;
    const roomTypes: PublicRoomType[] = hotel.roomTypes.map((rt) => ({
      id: rt.id,
      name: rt.name,
      category: rt.category?.name ?? null,
      ac: hasAc(rt.amenities),
      price: Number(rt.basePrice),
      weekendPrice: rt.weekendPrice !== null ? Number(rt.weekendPrice) : null,
      bedType: rt.bedType,
      sizeSqft: rt.sizeSqft,
      minOccupancy: rt.minOccupancy,
      maxOccupancy: rt.maxOccupancy,
      amenities: rt.amenities,
      images: rt.images,
      roomCount: rt.rooms.length,
    }));

    const totalRooms = roomTypes.reduce((sum, rt) => sum + rt.roomCount, 0);
    const totalGuestCapacity = roomTypes.reduce((sum, rt) => sum + rt.maxOccupancy * rt.roomCount, 0);
    const startingPrice = roomTypes.length ? Math.min(...roomTypes.map((rt) => rt.price)) : 0;

    const mergedAmenities = uniqueStrings([
      ...hotel.amenities,
      ...roomTypes.flatMap((rt) => rt.amenities),
      ...(roomTypes.some((rt) => rt.ac) ? ["AC"] : []),
    ]);
    const mergedImages = uniqueStrings([...hotel.images, ...roomTypes.flatMap((rt) => rt.images)]);

    const rating = listing.rating !== null ? Number(listing.rating) : avgByHotel.get(hotel.id) ?? null;

    return {
      hotelId: hotel.id,
      slug: hotel.slug,
      name: hotel.name,
      type: hotel.hotelType?.name ?? "Other",
      location: `${hotel.city}, ${hotel.state}`,
      city: hotel.city,
      state: hotel.state,
      description: hotel.description ?? "",
      guests: totalGuestCapacity,
      bedrooms: totalRooms,
      bathrooms: totalRooms,
      price: startingPrice,
      images: mergedImages,
      amenities: mergedAmenities,
      rating,
      reviewCount: listing.reviewCount,
      platformLinks: (listing.platformLinks as Record<string, string>) ?? {},
      roomTypes,
      updatedAt: hotel.updatedAt.toISOString(),
    };
  });
}

async function submitContactForm(data: { name: string; email: string; phone?: string; subject?: string; message: string }) {
  await sendMail({
    to: env.CONTACT_INBOX_EMAIL,
    subject: `[Curatd Concepts] Contact form: ${data.subject || "General enquiry"}`,
    html: `
      <p><strong>Name:</strong> ${data.name}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      ${data.phone ? `<p><strong>Phone:</strong> ${data.phone}</p>` : ""}
      <p><strong>Message:</strong></p>
      <p>${data.message.replace(/\n/g, "<br/>")}</p>
    `,
  });
}

export const publicService = { listPublishedListings, submitContactForm };
