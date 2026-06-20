import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { hashPassword } from "../auth/auth.service";
import { recordAudit } from "../../lib/audit";
import type { CreateUser } from "@acme/types";

export async function listUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));
}

export async function createUser(
  input: CreateUser,
  actor: { id: string; email: string }
) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) {
    throw new AppError("CONFLICT", "Email already in use", 409);
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: { email: input.email, passwordHash, role: input.role ?? "HR_VIEWER" },
    select: { id: true, email: true, role: true, isActive: true, createdAt: true },
  });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "CREATE",
    entityType: "User",
    entityId: user.id,
    newValue: JSON.stringify({ email: user.email, role: user.role }),
  });

  return { ...user, createdAt: user.createdAt.toISOString() };
}

export async function setUserActive(
  userId: string,
  isActive: boolean,
  actor: { id: string; email: string }
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);

  if (actor.id === userId) {
    throw new AppError("FORBIDDEN", "Cannot change your own active status", 403);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: { id: true, email: true, role: true, isActive: true, createdAt: true },
  });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: isActive ? "UPDATE" : "DEACTIVATE",
    entityType: "User",
    entityId: userId,
    fieldName: "isActive",
    oldValue: String(user.isActive),
    newValue: String(isActive),
  });

  return { ...updated, createdAt: updated.createdAt.toISOString() };
}
