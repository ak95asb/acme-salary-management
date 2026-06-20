import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../env";
import type { TokenPayload } from "@acme/types";

export const REFRESH_TOKEN_EXPIRY_DAYS = 7;
export const ACCESS_TOKEN_EXPIRY = "15m";

export function signAccessToken(sub: string, email: string, role: string): string {
  return jwt.sign({ sub, email, role }, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload === "string") throw new Error("Invalid token payload");
  return payload as unknown as TokenPayload;
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return d;
}
