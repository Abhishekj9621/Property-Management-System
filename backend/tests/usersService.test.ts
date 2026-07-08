jest.mock("../src/config/database", () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    hotel: { findUnique: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  },
}));

import { prisma } from "../src/config/database";
import { usersService } from "../src/modules/users/users.service";
import { ApiError } from "../src/utils/ApiError";

const mockedPrisma = prisma as any;

const superAdmin = { id: "sa1", role: "SUPER_ADMIN", hotelId: null };
const hotelAdminA = { id: "ha1", role: "HOTEL_ADMIN", hotelId: "hotelA" };
const managerA = { id: "mgrA", role: "MANAGER", hotelId: "hotelA" };

beforeEach(() => jest.clearAllMocks());

describe("usersService.create", () => {
  it("prevents a HOTEL_ADMIN from creating another HOTEL_ADMIN", async () => {
    await expect(
      usersService.create(hotelAdminA, {
        email: "x@x.com",
        password: "Password123",
        firstName: "X",
        lastName: "Y",
        role: "HOTEL_ADMIN" as any,
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("prevents a non-SUPER_ADMIN from creating a SUPER_ADMIN", async () => {
    await expect(
      usersService.create(managerA, {
        email: "x@x.com",
        password: "Password123",
        firstName: "X",
        lastName: "Y",
        role: "SUPER_ADMIN" as any,
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("pins a HOTEL_ADMIN-created staff member to the creator's own hotel, ignoring any hotelId in the body", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.user.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: "new1" }));

    const result = await usersService.create(hotelAdminA, {
      email: "recept@x.com",
      password: "Password123",
      firstName: "R",
      lastName: "C",
      role: "RECEPTIONIST" as any,
      hotelId: "some-other-hotel", // attacker-supplied — must be ignored
    });

    expect(result.hotelId).toBe("hotelA");
  });

  it("requires SUPER_ADMIN to explicitly supply a valid, active hotelId", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    await expect(
      usersService.create(superAdmin, {
        email: "x@x.com",
        password: "Password123",
        firstName: "X",
        lastName: "Y",
        role: "MANAGER" as any,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects creating an account with an email that's already taken", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "existing" });
    await expect(
      usersService.create(hotelAdminA, {
        email: "dup@x.com",
        password: "Password123",
        firstName: "X",
        lastName: "Y",
        role: "MANAGER" as any,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("usersService.assertInScope", () => {
  it("allows SUPER_ADMIN to act on anyone", () => {
    expect(() =>
      usersService.assertInScope(superAdmin as any, { id: "x", role: "HOTEL_ADMIN" as any, hotelId: "hotelZ" })
    ).not.toThrow();
  });

  it("allows a user to act on their own account", () => {
    expect(() =>
      usersService.assertInScope(managerA as any, { id: managerA.id, role: "MANAGER" as any, hotelId: "hotelA" })
    ).not.toThrow();
  });

  it("blocks cross-hotel access even for a matching/manageable role", () => {
    expect(() =>
      usersService.assertInScope(hotelAdminA as any, { id: "other", role: "MANAGER" as any, hotelId: "hotelB" })
    ).toThrow(ApiError);
  });

  it("blocks a MANAGER from acting on a HOTEL_ADMIN in the same hotel", () => {
    expect(() =>
      usersService.assertInScope(managerA as any, { id: "ha1", role: "HOTEL_ADMIN" as any, hotelId: "hotelA" })
    ).toThrow(ApiError);
  });

  it("allows a MANAGER to act on a RECEPTIONIST in the same hotel", () => {
    expect(() =>
      usersService.assertInScope(managerA as any, { id: "r1", role: "RECEPTIONIST" as any, hotelId: "hotelA" })
    ).not.toThrow();
  });
});

describe("usersService.deactivate", () => {
  it("prevents a user from deactivating their own account", async () => {
    await expect(usersService.deactivate(managerA as any, managerA.id)).rejects.toMatchObject({ statusCode: 400 });
  });
});
