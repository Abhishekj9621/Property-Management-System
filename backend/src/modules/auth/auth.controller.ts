import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { authService } from "./auth.service";

export const authController = {
  register: catchAsync(async (req: Request, res: Response) => {
    const result = await authService.register(req.body, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    res.status(201).json(new ApiResponse("Registration successful", result));
  }),

  login: catchAsync(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    res.status(200).json(new ApiResponse("Login successful", result));
  }),

  refresh: catchAsync(async (req: Request, res: Response) => {
    const result = await authService.refresh(req.body.refreshToken, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    res.status(200).json(new ApiResponse("Token refreshed", result));
  }),

  logout: catchAsync(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.split(" ")[1];
    await authService.logout(req.body.refreshToken, accessToken);
    res.status(200).json(new ApiResponse("Logged out successfully"));
  }),

  forgotPassword: catchAsync(async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body.email);
    res.status(200).json(new ApiResponse("If that account exists, a reset link has been sent"));
  }),

  resetPassword: catchAsync(async (req: Request, res: Response) => {
    await authService.resetPassword(req.body.token, req.body.newPassword);
    res.status(200).json(new ApiResponse("Password has been reset successfully"));
  }),

  me: catchAsync(async (req: Request, res: Response) => {
    res.status(200).json(new ApiResponse("Current user", req.user));
  }),

  listSessions: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const currentToken = req.query?.currentRefreshToken as string | undefined;
    const sessions = await authService.listSessions(req.user.id, currentToken);
    res.status(200).json(new ApiResponse("Active sessions", sessions));
  }),

  revokeSession: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await authService.revokeSession(req.user.id, req.params.id);
    res.status(200).json(new ApiResponse("Session revoked", result));
  }),

  revokeAllSessions: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await authService.revokeAllSessions(req.user.id, req.body?.exceptRefreshToken);
    res.status(200).json(new ApiResponse("All other sessions revoked"));
  }),
};
