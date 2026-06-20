import { z } from "zod";

export const payFrequencySchema = z.enum(["MONTHLY", "ANNUAL"]);

export const createSalarySchema = z.object({
  // String to preserve Decimal precision — service converts via new Decimal(amount)
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Amount must be a positive decimal with up to 4 decimal places"),
  currencyCode: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, "Must be a 3-letter ISO 4217 currency code (e.g. USD, EUR, INR)"),
  payFrequency: payFrequencySchema,
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
});

export const salaryRecordResponseSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  amount: z.string(),
  currencyCode: z.string(),
  payFrequency: payFrequencySchema,
  effectiveDate: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
});

export type CreateSalary = z.infer<typeof createSalarySchema>;
export type SalaryRecordResponse = z.infer<typeof salaryRecordResponseSchema>;
