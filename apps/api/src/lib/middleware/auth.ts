import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors";
import { verifyAccessToken } from "../jwt";
import type { Role } from "@acme/types";

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AppError("UNAUTHORIZED", "Authentication required", 401));
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new AppError("UNAUTHORIZED", "Invalid or expired token", 401));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole as Role)) {
      return next(new AppError("FORBIDDEN", "Insufficient permissions", 403));
    }
    next();
  };
}
