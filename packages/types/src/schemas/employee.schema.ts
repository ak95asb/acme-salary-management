import { z } from "zod";

export const employeeStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const createEmployeeSchema = z.object({
  employeeCode: z.string().min(1).max(50).optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  department: z.string().min(1).max(100),
  jobTitle: z.string().min(1).max(100),
  country: z.string().min(2).max(100),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export const updateEmployeeSchema = createEmployeeSchema
  .omit({ email: true, employeeCode: true })
  .partial();

export const employeeFilterSchema = z.object({
  name: z.string().optional(),
  department: z.string().optional(),
  country: z.string().optional(),
  jobTitle: z.string().optional(),
  status: employeeStatusSchema.optional(),
});

export const employeeResponseSchema = z.object({
  id: z.string(),
  employeeCode: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  department: z.string(),
  jobTitle: z.string(),
  country: z.string(),
  status: employeeStatusSchema,
  startDate: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CreateEmployee = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployee = z.infer<typeof updateEmployeeSchema>;
export type EmployeeFilter = z.infer<typeof employeeFilterSchema>;
export type EmployeeResponse = z.infer<typeof employeeResponseSchema>;
