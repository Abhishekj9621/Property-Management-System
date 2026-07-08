import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../../config/database";
import { redis } from "../../config/redis";
import { ApiError } from "../../utils/ApiError";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt";
import { env } from "../../config/env";
import { sendMail, emailTemplates } from "../../utils/mailer";
import { loginLockout } from "../../lib/loginLockout";
import { recordAudit, AuditActions } from "../../lib/auditLog";

const SALT_ROUNDS = 12;

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

interface LoginMeta {
  userAgent?: string;
  ipAddress?: string;
}

function refreshExpiryDate(): Date {
  // Parses simple "7d" / "15m" style strings from env
  const match = env.JWT_REFRESH_EXPIRES_IN.match(/(\d+)([dhm])/);
  const now = new Date();
  if (!match) return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [, amount, unit] = match;
  const n = Number(amount);
  if (unit === "d") now.setDate(now.getDate() + n);
  if (unit === "h") now.setHours(now.getHours() + n);
  if (unit === "m") now.setMinutes(now.getMinutes() + n);
  return now;
}

export const authService = {
  async register(input: RegisterInput, meta: LoginMeta = {}) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw ApiError.conflict("An account with this email already exists");

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        role: "GUEST",
      },
    });

    await recordAudit({
      userId: user.id,
      action: AuditActions.REGISTER,
      entity: "User",
      entityId: user.id,
      ipAddress: meta.ipAddress,
    });

    return this.issueSession(user.id, user.role, user.hotelId, meta);
  },

  async login(email: string, password: string, meta: LoginMeta) {
    const { locked, retryAfterSeconds } = await loginLockout.isLocked(email);
    if (locked) {
      throw ApiError.unauthorized(
        `Too many failed attempts. Try again in ${Math.ceil((retryAfterSeconds ?? 0) / 60)} minute(s).`
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const isValid = user?.isActive ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !user.isActive || !isValid) {
      const { lockedOut } = await loginLockout.registerFailure(email);
      await recordAudit({
        userId: user?.id ?? null,
        action: lockedOut ? AuditActions.LOGIN_LOCKED : AuditActions.LOGIN_FAILED,
        entity: "User",
        entityId: user?.id ?? null,
        metadata: { email },
        ipAddress: meta.ipAddress,
      });
      if (lockedOut) {
        throw ApiError.unauthorized("Too many failed attempts. Account temporarily locked for 15 minutes.");
      }
      throw ApiError.unauthorized("Invalid credentials");
    }

    await loginLockout.clear(email);
    await recordAudit({
      userId: user.id,
      action: AuditActions.LOGIN_SUCCESS,
      entity: "User",
      entityId: user.id,
      ipAddress: meta.ipAddress,
      metadata: { userAgent: meta.userAgent },
    });

    return this.issueSession(user.id, user.role, user.hotelId, meta);
  },

  async issueSession(userId: string, role: string, hotelId: string | null, meta: LoginMeta) {
    const accessToken = signAccessToken({ sub: userId, role, hotelId });
    const refreshToken = signRefreshToken(userId);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt: refreshExpiryDate(),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        hotelId: true,
        avatarUrl: true,
      },
    });

    return { accessToken, refreshToken, user };
  },

  async refresh(oldRefreshToken: string, meta: LoginMeta = {}) {
    let payload: { sub: string };
    try {
      payload = verifyRefreshToken(oldRefreshToken);
    } catch {
      throw ApiError.unauthorized("Invalid refresh token");
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: oldRefreshToken } });

    // A revoked token being replayed is a strong signal of token theft
    // (e.g. an attacker replaying a token after the rightful owner already
    // rotated it). Treat it as a security incident: nuke every session.
    if (stored?.revoked) {
      await recordAudit({
        userId: stored.userId,
        action: AuditActions.TOKEN_REUSE_DETECTED,
        entity: "RefreshToken",
        entityId: stored.id,
        ipAddress: meta.ipAddress,
      });
      await prisma.refreshToken.updateMany({ where: { userId: stored.userId }, data: { revoked: true } });
      throw ApiError.unauthorized("Refresh token expired or revoked");
    }

    if (!stored || stored.expiresAt < new Date()) {
      throw ApiError.unauthorized("Refresh token expired or revoked");
    }

    // Rotate: revoke old, issue new (mitigates replay attacks)
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    await recordAudit({
      userId: user.id,
      action: AuditActions.TOKEN_REFRESH,
      entity: "RefreshToken",
      entityId: stored.id,
      ipAddress: meta.ipAddress,
    });

    return this.issueSession(user.id, user.role, user.hotelId, {
      userAgent: stored.userAgent ?? undefined,
      ipAddress: stored.ipAddress ?? undefined,
    });
  },

  async logout(refreshToken: string, accessToken?: string) {
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revoked: true },
    });

    // Blacklist the access token for its remaining TTL so it can't be reused
    if (accessToken) {
      await redis.set(`bl:${accessToken}`, "1", "EX", 15 * 60);
    }

    if (stored) {
      await recordAudit({ userId: stored.userId, action: AuditActions.LOGOUT, entity: "RefreshToken", entityId: stored.id });
    }
  },

  /** Lists a user's active (non-revoked, non-expired) sessions/devices. */
  async listSessions(userId: string, currentToken?: string) {
    const sessions = await prisma.refreshToken.findMany({
      where: { userId, revoked: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true, token: true },
    });
    return sessions.map(({ token, ...s }) => ({ ...s, isCurrent: token === currentToken }));
  },

  /** Revokes a single session by id, scoped to the requesting user. */
  async revokeSession(userId: string, sessionId: string) {
    const session = await prisma.refreshToken.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw ApiError.notFound("Session not found");
    await prisma.refreshToken.update({ where: { id: sessionId }, data: { revoked: true } });
    await recordAudit({ userId, action: AuditActions.SESSION_REVOKED, entity: "RefreshToken", entityId: sessionId });
    return { id: sessionId };
  },

  /** Revokes every session for this user except (optionally) the current one. */
  async revokeAllSessions(userId: string, exceptToken?: string) {
    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false, ...(exceptToken ? { token: { not: exceptToken } } : {}) },
      data: { revoked: true },
    });
    await recordAudit({ userId, action: AuditActions.LOGOUT_ALL, entity: "User", entityId: userId });
  },

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    await recordAudit({
      userId: user?.id ?? null,
      action: AuditActions.FORGOT_PASSWORD_REQUESTED,
      entity: "User",
      entityId: user?.id ?? null,
      metadata: { email },
    });
    // Do not leak whether the account exists
    if (!user) return;

    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    const resetUrl = `${env.MANAGEMENT_APP_URL}/reset-password?token=${token}`;
    const tpl = emailTemplates.passwordReset({ resetUrl });
    await sendMail({ to: user.email, ...tpl });

    return token;
  },

  async resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await prisma.user.findFirst({
      where: { passwordResetToken: hashedToken, passwordResetExpires: { gt: new Date() } },
    });
    if (!user) throw ApiError.badRequest("Password reset token is invalid or has expired");

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
    });

    // Revoke all existing sessions on password change
    await prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { revoked: true } });
    await loginLockout.clear(user.email);
    await recordAudit({ userId: user.id, action: AuditActions.PASSWORD_RESET, entity: "User", entityId: user.id });
  },
};
