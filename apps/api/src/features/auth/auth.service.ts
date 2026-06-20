import bcrypt from "bcrypt";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
} from "../../lib/jwt";

const GENERIC_AUTH_ERROR = new AppError(
  "UNAUTHORIZED",
  "Invalid credentials",
  401
);

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw GENERIC_AUTH_ERROR;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw GENERIC_AUTH_ERROR;

  const accessToken = signAccessToken(user.id, user.email, user.role);
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(refreshToken),
      userId: user.id,
      expiresAt: refreshTokenExpiresAt(),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, role: user.role },
  };
}

export async function refresh(tokenFromCookie: string) {
  const hash = hashRefreshToken(tokenFromCookie);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date() || !stored.user.isActive) {
    throw new AppError("UNAUTHORIZED", "Invalid or expired refresh token", 401);
  }

  const accessToken = signAccessToken(
    stored.user.id,
    stored.user.email,
    stored.user.role
  );

  return { accessToken };
}

export async function logout(tokenFromCookie: string) {
  const hash = hashRefreshToken(tokenFromCookie);
  await prisma.refreshToken.deleteMany({ where: { tokenHash: hash } });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
