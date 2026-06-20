import { z } from "zod";

export const roleSchema = z.enum(["SYSTEM_ADMIN", "HR_ADMIN", "HR_VIEWER"]);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const tokenPayloadSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  role: roleSchema,
  iat: z.number(),
  exp: z.number(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: roleSchema.default("HR_VIEWER"),
});

export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: roleSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
});

export type Role = z.infer<typeof roleSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
