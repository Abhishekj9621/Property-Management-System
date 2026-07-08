import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding NovaStay HMS demo data...");

  // Room types have no unique constraint in the schema (unlike Hotel.slug
  // or Room's (hotelId, roomNumber)), so re-running this script needs its
  // own "find or create" instead of upsert() to stay idempotent — without
  // this, running `npm run seed` twice silently creates duplicate room
  // types, then crashes on room-number collisions once it tries to create
  // the same rooms again for those duplicates.
  async function findOrCreateRoomType(data: {
    hotelId: string;
    name: string;
    code: string;
    categoryId?: string;
    basePrice: number;
    weekendPrice?: number;
    extraBedPrice?: number;
    taxPercent: number;
    maxOccupancy: number;
    bedType?: string;
    sizeSqft?: number;
    amenities: string[];
  }) {
    const existing = await prisma.roomType.findFirst({ where: { hotelId: data.hotelId, code: data.code } });
    return existing ?? prisma.roomType.create({ data });
  }

  // ---------------------------------------------------------------
  // 1. Catalog / customization lookups (hotel types, room categories)
  //    — these power the dropdowns on the Hotel and Room forms and
  //    are editable later from Settings. NovaStay HMS operates
  //    exclusively in Indian Rupees (INR) — there is no currency
  //    lookup table or per-hotel currency selection.
  // ---------------------------------------------------------------
  const hotelTypes = [
    { code: "BUSINESS", name: "Business Hotel", icon: "Briefcase", sortOrder: 1, description: "Geared toward corporate travelers — meeting rooms, business centers, city-center locations." },
    { code: "RESORT", name: "Resort", icon: "Palmtree", sortOrder: 2, description: "Leisure-focused property with recreational amenities (pools, spa, beach/mountain access)." },
    { code: "BOUTIQUE", name: "Boutique Hotel", icon: "Sparkle", sortOrder: 3, description: "Small, design-led property with a distinct character." },
    { code: "BUDGET", name: "Budget / Economy", icon: "Wallet", sortOrder: 4, description: "No-frills, value-focused accommodation." },
    { code: "LUXURY", name: "Luxury Hotel", icon: "Gem", sortOrder: 5, description: "High-end property with premium service and amenities." },
    { code: "APARTMENT", name: "Serviced Apartment", icon: "Building", sortOrder: 6, description: "Self-contained units with hotel-style services, for longer stays." },
    { code: "HOSTEL", name: "Hostel", icon: "Users", sortOrder: 7, description: "Budget, often shared-room accommodation." },
  ];
  for (const t of hotelTypes) {
    await prisma.hotelType.upsert({ where: { code: t.code }, update: {}, create: t });
  }

  const roomCategories = [
    { code: "STANDARD", name: "Standard", sortOrder: 1 },
    { code: "DELUXE", name: "Deluxe", sortOrder: 2 },
    { code: "SUITE", name: "Suite", sortOrder: 3 },
    { code: "EXECUTIVE", name: "Executive", sortOrder: 4 },
    { code: "FAMILY", name: "Family", sortOrder: 5 },
    { code: "PRESIDENTIAL", name: "Presidential", sortOrder: 6 },
  ];
  for (const c of roomCategories) {
    await prisma.roomCategory.upsert({ where: { code: c.code }, update: {}, create: c });
  }

  const businessType = await prisma.hotelType.findUniqueOrThrow({ where: { code: "BUSINESS" } });
  const resortType = await prisma.hotelType.findUniqueOrThrow({ where: { code: "RESORT" } });
  const standardCat = await prisma.roomCategory.findUniqueOrThrow({ where: { code: "STANDARD" } });
  const deluxeCat = await prisma.roomCategory.findUniqueOrThrow({ where: { code: "DELUXE" } });
  const suiteCat = await prisma.roomCategory.findUniqueOrThrow({ where: { code: "SUITE" } });

  // ---------------------------------------------------------------
  // 2. Super Admin — the platform owner. Created first (no createdById)
  //    since everyone else in the hierarchy traces back to them.
  //    NOTE: for a real production deploy, don't rely on this seeded
  //    account — run `npm run create:super-admin` instead and remove
  //    this block. See docs/DEPLOYMENT.md.
  // ---------------------------------------------------------------
  const superAdminHash = await bcrypt.hash("Super@123", 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "super@novastay.com" },
    update: {},
    create: {
      email: "super@novastay.com",
      passwordHash: superAdminHash,
      firstName: "Sam",
      lastName: "Superadmin",
      role: "SUPER_ADMIN",
      hotelId: null,
      isEmailVerified: true,
    },
  });

  // ---------------------------------------------------------------
  // 3. Hotels — created by the Super Admin, each with its own type
  //    to demonstrate the customization options.
  // ---------------------------------------------------------------
  const hotel = await prisma.hotel.upsert({
    where: { slug: "novastay-downtown" },
    update: {},
    create: {
      name: "NovaStay Downtown",
      slug: "novastay-downtown",
      description: "A modern 4-star business hotel in the heart of downtown.",
      address: "123 Market Street",
      city: "Metropolis",
      state: "NY",
      country: "USA",
      postalCode: "10001",
      phone: "+1-212-555-0100",
      email: "info@novastay.com",
      hotelTypeId: businessType.id,
      starRating: 4,
      defaultTaxPercent: 10,
      amenities: ["Free WiFi", "Pool", "Gym", "Spa", "Parking", "Restaurant"],
      createdById: superAdmin.id,
    },
  });

  const hotel2 = await prisma.hotel.upsert({
    where: { slug: "novastay-airport" },
    update: {},
    create: {
      name: "NovaStay Airport",
      slug: "novastay-airport",
      description: "Convenient stopover hotel minutes from the airport terminal.",
      address: "88 Terminal Way",
      city: "Metropolis",
      state: "NY",
      country: "USA",
      postalCode: "10099",
      phone: "+1-212-555-0199",
      email: "airport@novastay.com",
      hotelTypeId: businessType.id,
      starRating: 3,
      defaultTaxPercent: 8,
      amenities: ["Free WiFi", "Shuttle", "Gym", "24h Front Desk"],
      createdById: superAdmin.id,
    },
  });

  const hotel3 = await prisma.hotel.upsert({
    where: { slug: "novastay-beach-resort" },
    update: {},
    create: {
      name: "NovaStay Beach Resort",
      slug: "novastay-beach-resort",
      description: "A relaxed beachfront resort with pools, a spa, and ocean-view suites.",
      address: "1 Shoreline Drive",
      city: "Goa",
      state: "GA",
      country: "India",
      postalCode: "403001",
      phone: "+91-832-555-0100",
      email: "reservations@novastay-beach.com",
      hotelTypeId: resortType.id,
      starRating: 5,
      defaultTaxPercent: 12,
      amenities: ["Free WiFi", "Beach Access", "Pool", "Spa", "Bar"],
      createdById: superAdmin.id,
    },
  });

  // ---------------------------------------------------------------
  // 4. Staff hierarchy — each account's createdById traces who
  //    provisioned it, matching the /users hierarchy rules:
  //      Super Admin -> Hotel Admin -> Manager -> Receptionist/Housekeeping
  // ---------------------------------------------------------------
  const adminHash = await bcrypt.hash("Admin@123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@novastay.com" },
    update: {},
    create: {
      email: "admin@novastay.com",
      passwordHash: adminHash,
      firstName: "Alex",
      lastName: "Admin",
      role: "HOTEL_ADMIN",
      hotelId: hotel.id,
      isEmailVerified: true,
      createdById: superAdmin.id,
    },
  });

  const managerHash = await bcrypt.hash("Manager@123", 12);
  const manager = await prisma.user.upsert({
    where: { email: "manager@novastay.com" },
    update: {},
    create: {
      email: "manager@novastay.com",
      passwordHash: managerHash,
      firstName: "Morgan",
      lastName: "Manager",
      role: "MANAGER",
      hotelId: hotel.id,
      isEmailVerified: true,
      createdById: admin.id,
    },
  });

  const frontdeskHash = await bcrypt.hash("Front@123", 12);
  await prisma.user.upsert({
    where: { email: "frontdesk@novastay.com" },
    update: {},
    create: {
      email: "frontdesk@novastay.com",
      passwordHash: frontdeskHash,
      firstName: "Riley",
      lastName: "Front",
      role: "RECEPTIONIST",
      hotelId: hotel.id,
      isEmailVerified: true,
      createdById: manager.id,
    },
  });

  const housekeepingHash = await bcrypt.hash("Clean@123", 12);
  await prisma.user.upsert({
    where: { email: "clean@novastay.com" },
    update: {},
    create: {
      email: "clean@novastay.com",
      passwordHash: housekeepingHash,
      firstName: "Jordan",
      lastName: "Clean",
      role: "HOUSEKEEPING",
      hotelId: hotel.id,
      isEmailVerified: true,
      createdById: manager.id,
    },
  });

  const hotel2AdminHash = await bcrypt.hash("Admin@123", 12);
  await prisma.user.upsert({
    where: { email: "admin.airport@novastay.com" },
    update: {},
    create: {
      email: "admin.airport@novastay.com",
      passwordHash: hotel2AdminHash,
      firstName: "Taylor",
      lastName: "Admin",
      role: "HOTEL_ADMIN",
      hotelId: hotel2.id,
      isEmailVerified: true,
      createdById: superAdmin.id,
    },
  });

  const hotel3AdminHash = await bcrypt.hash("Admin@123", 12);
  await prisma.user.upsert({
    where: { email: "admin.beach@novastay.com" },
    update: {},
    create: {
      email: "admin.beach@novastay.com",
      passwordHash: hotel3AdminHash,
      firstName: "Priya",
      lastName: "Admin",
      role: "HOTEL_ADMIN",
      hotelId: hotel3.id,
      isEmailVerified: true,
      createdById: superAdmin.id,
    },
  });

  // ---------------------------------------------------------------
  // 5. Room types (with pricing/tax/category customization) + rooms
  // ---------------------------------------------------------------
  const hotel2RoomType = await findOrCreateRoomType({
    hotelId: hotel2.id,
    name: "Standard Twin",
    code: "STD-TWIN",
    categoryId: standardCat.id,
    basePrice: 89,
    taxPercent: 8,
    maxOccupancy: 2,
    bedType: "Twin",
    sizeSqft: 240,
    amenities: ["WiFi", "TV", "AC"],
  });

  for (let i = 0; i < 8; i++) {
    const roomNumber = String(201 + i);
    await prisma.room.upsert({
      where: { hotelId_roomNumber: { hotelId: hotel2.id, roomNumber } },
      update: {},
      create: {
        hotelId: hotel2.id,
        roomTypeId: hotel2RoomType.id,
        roomNumber,
        floor: 2,
        status: "AVAILABLE",
      },
    });
  }

  const roomTypesData = [
    { name: "Standard Queen", code: "STD-Q", categoryId: standardCat.id, basePrice: 99, taxPercent: 10, extraBedPrice: 20, maxOccupancy: 2, bedType: "Queen", sizeSqft: 280, amenities: ["WiFi", "TV", "AC"] },
    { name: "Deluxe King", code: "DLX-K", categoryId: deluxeCat.id, basePrice: 149, taxPercent: 10, extraBedPrice: 25, weekendPrice: 169, maxOccupancy: 2, bedType: "King", sizeSqft: 340, amenities: ["WiFi", "TV", "AC", "Minibar"] },
    { name: "Executive Suite", code: "EXE-STE", categoryId: suiteCat.id, basePrice: 259, taxPercent: 10, extraBedPrice: 35, weekendPrice: 289, maxOccupancy: 4, bedType: "King + Sofa", sizeSqft: 520, amenities: ["WiFi", "TV", "AC", "Minibar", "Lounge Access"] },
  ];

  const roomTypes = [];
  for (const rt of roomTypesData) {
    const created = await findOrCreateRoomType({ ...rt, hotelId: hotel.id });
    roomTypes.push(created);
  }

  let floor = 1;
  let roomCounter = 101;
  for (const rt of roomTypes) {
    for (let i = 0; i < 6; i++) {
      const roomNumber = String(roomCounter++);
      await prisma.room.upsert({
        where: { hotelId_roomNumber: { hotelId: hotel.id, roomNumber } },
        update: {},
        create: {
          hotelId: hotel.id,
          roomTypeId: rt.id,
          roomNumber,
          floor,
          view: i % 3 === 0 ? "City View" : undefined,
          status: "AVAILABLE",
        },
      });
      if (roomCounter % 10 === 0) floor++;
    }
  }

  const beachRoomType = await findOrCreateRoomType({
    hotelId: hotel3.id,
    name: "Ocean View Suite",
    code: "OCEAN-STE",
    categoryId: suiteCat.id,
    basePrice: 12000,
    taxPercent: 12,
    extraBedPrice: 1500,
    weekendPrice: 14000,
    maxOccupancy: 3,
    bedType: "King",
    sizeSqft: 450,
    amenities: ["WiFi", "TV", "AC", "Minibar", "Balcony"],
  });
  for (let i = 0; i < 6; i++) {
    const roomNumber = `B${101 + i}`;
    await prisma.room.upsert({
      where: { hotelId_roomNumber: { hotelId: hotel3.id, roomNumber } },
      update: {},
      create: {
        hotelId: hotel3.id,
        roomTypeId: beachRoomType.id,
        roomNumber,
        floor: 1,
        view: "Ocean View",
        status: "AVAILABLE",
      },
    });
  }

  // ---------------------------------------------------------------
  // 6. Sample guest + a completed, paid booking so the Dashboard and
  //    Revenue pages have non-zero numbers to show out of the box.
  //    Guest.email has no unique constraint, so this whole block is
  //    guarded by an existence check rather than upsert — otherwise a
  //    second `npm run seed` run would just pile up duplicate demo
  //    guests/bookings/reviews instead of failing outright, which is
  //    arguably worse (silent data drift instead of a clear error).
  // ---------------------------------------------------------------
  const existingGuest = await prisma.guest.findFirst({ where: { hotelId: hotel.id, email: "casey.guest@example.com" } });

  if (!existingGuest) {
    const guest = await prisma.guest.create({
      data: {
        hotelId: hotel.id,
        firstName: "Casey",
        lastName: "Guest",
        email: "casey.guest@example.com",
        phone: "+1-555-010-2000",
        loyaltyTier: "SILVER",
        vip: false,
      },
    });

    const demoRoom = await prisma.room.findFirst({ where: { hotelId: hotel.id } });
    const demoRoomType = await prisma.roomType.findFirst({ where: { hotelId: hotel.id } });

    if (demoRoom && demoRoomType) {
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() - 3);
      const checkOut = new Date();
      checkOut.setDate(checkOut.getDate() - 1);

      const demoBooking = await prisma.booking.create({
        data: {
          bookingRef: `NV-${Date.now().toString(36).toUpperCase()}-SEED`,
          hotelId: hotel.id,
          guestId: guest.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          actualCheckIn: checkIn,
          actualCheckOut: checkOut,
          status: "CHECKED_OUT",
          adults: 2,
          children: 0,
          totalAmount: 218,
          paidAmount: 218,
          taxAmount: 18,
          source: "DIRECT",
          rooms: {
            create: {
              roomId: demoRoom.id,
              roomTypeId: demoRoomType.id,
              pricePerNight: demoRoomType.basePrice,
              nights: 2,
            },
          },
        },
      });

      await prisma.payment.create({
        data: {
          bookingId: demoBooking.id,
          amount: 218,
          method: "CARD",
          status: "PAID",
          paidAt: checkOut,
        },
      });

      await prisma.review.create({
        data: {
          hotelId: hotel.id,
          bookingId: demoBooking.id,
          guestId: guest.id,
          rating: 5,
          cleanliness: 5,
          service: 4,
          valueForMoney: 5,
          comment: "Wonderful stay — the room was spotless and the staff were incredibly helpful. Will be back!",
        },
      });

      await prisma.notification.create({
        data: {
          userId: admin.id,
          hotelId: hotel.id,
          title: "New 5-star review",
          message: `${guest.firstName} ${guest.lastName} left a 5-star review for booking ${demoBooking.bookingRef}`,
          type: "REVIEW",
        },
      });
    }
  }

  console.log("✅ Seed complete.");
  console.log("   Hotel 1:", hotel.name, hotel.id);
  console.log("   Hotel 2:", hotel2.name, hotel2.id);
  console.log("   Hotel 3:", hotel3.name, hotel3.id);
  console.log("");
  console.log("   Super admin login:  super@novastay.com / Super@123  (all hotels)");
  console.log("   Hotel admin login:  admin@novastay.com / Admin@123  (NovaStay Downtown)");
  console.log("   Manager login:      manager@novastay.com / Manager@123");
  console.log("   Front desk login:   frontdesk@novastay.com / Front@123");
  console.log("   Housekeeping login: clean@novastay.com / Clean@123");
  console.log("   2nd hotel admin:    admin.airport@novastay.com / Admin@123 (NovaStay Airport)");
  console.log("   3rd hotel admin:    admin.beach@novastay.com / Admin@123 (NovaStay Beach Resort)");
  console.log("");
  console.log("⚠️  These are DEMO credentials. For production, run `npm run create:super-admin`");
  console.log("    to provision a real Super Admin, then delete/disable the demo accounts above.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
