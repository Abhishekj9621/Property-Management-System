jest.mock("../src/config/database", () => ({
  prisma: {
    user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() },
    refreshToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  },
}));

jest.mock("../src/config/redis", () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock("../src/utils/mailer", () => ({
  sendMail: jest.fn(),
  emailTemplates: { passwordReset: jest.fn(() => ({ subject: "x", html: "x" })) },
}));

import bcrypt from "bcryptjs";
import { prisma } from "../src/config/database";
import { redis } from "../src/config/redis";
import { authService } from "../src/modules/auth/auth.service";
import { ApiError } from "../src/utils/ApiError";

const mockedPrisma = prisma as any;
const mockedRedis = redis as any;

describe("authService.login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRedis.ttl.mockResolvedValue(-2); // not locked by default
    mockedRedis.incr.mockResolvedValue(1);
  });

  it("throws unauthorized for a non-existent user without leaking existence", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    await expect(authService.login("nobody@x.com", "pw", {})).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws unauthorized for a wrong password", async () => {
    const hash = await bcrypt.hash("correct-password", 4);
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@a.com",
      passwordHash: hash,
      isActive: true,
      role: "MANAGER",
      hotelId: "h1",
    });
    await expect(authService.login("a@a.com", "wrong-password", {})).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws unauthorized for a deactivated account even with the right password", async () => {
    const hash = await bcrypt.hash("correct-password", 4);
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@a.com",
      passwordHash: hash,
      isActive: false,
      role: "MANAGER",
      hotelId: "h1",
    });
    await expect(authService.login("a@a.com", "correct-password", {})).rejects.toMatchObject({ statusCode: 401 });
  });

  it("issues a session on valid credentials", async () => {
    const hash = await bcrypt.hash("correct-password", 4);
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@a.com",
      passwordHash: hash,
      isActive: true,
      role: "MANAGER",
      hotelId: "h1",
    });
    mockedPrisma.refreshToken.create.mockResolvedValue({});
    mockedPrisma.user.findUniqueOrThrow.mockResolvedValue({
      id: "u1",
      email: "a@a.com",
      firstName: "A",
      lastName: "B",
      role: "MANAGER",
      hotelId: "h1",
      avatarUrl: null,
    });

    const result = await authService.login("a@a.com", "correct-password", { ipAddress: "127.0.0.1" });
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.email).toBe("a@a.com");
    expect(mockedPrisma.auditLog.create).toHaveBeenCalled();
  });

  it("rejects login while the account is locked out, without checking the password", async () => {
    mockedRedis.ttl.mockResolvedValue(400); // locked, 400s remaining
    await expect(authService.login("a@a.com", "whatever", {})).rejects.toMatchObject({ statusCode: 401 });
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("locks the account out after enough failed attempts", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedRedis.incr.mockResolvedValue(5); // hits MAX_ATTEMPTS
    await expect(authService.login("a@a.com", "wrong", {})).rejects.toThrow(/locked/i);
    expect(mockedRedis.set).toHaveBeenCalledWith(expect.stringContaining("login:locked:"), "1", "EX", expect.any(Number));
  });
});

describe("authService.refresh", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects an unparseable refresh token", async () => {
    await expect(authService.refresh("not-a-real-jwt")).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("authService.resetPassword", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects an invalid/expired token", async () => {
    mockedPrisma.user.findFirst = jest.fn().mockResolvedValue(null);
    await expect(authService.resetPassword("bad-token", "NewPassword123")).rejects.toMatchObject({ statusCode: 400 });
  });
});
