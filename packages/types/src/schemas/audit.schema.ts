import { z } from "zod";

export const auditActionSchema = z.enum(["CREATE", "UPDATE", "DEACTIVATE", "ARCHIVE"]);

export const auditEntrySchema = z.object({
  id: z.string(),
  actorId: z.string(),
  actorEmail: z.string(),
  action: auditActionSchema,
  entityType: z.string(),
  entityId: z.string(),
  fieldName: z.string().nullable(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  timestamp: z.string(),
});

export const auditFilterSchema = z.object({
  actorId: z.string().optional(),
  actorEmail: z.string().optional(),
  entityType: z.string().optional(),
  action: auditActionSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type AuditAction = z.infer<typeof auditActionSchema>;
export type AuditEntry = z.infer<typeof auditEntrySchema>;
export type AuditFilter = z.infer<typeof auditFilterSchema>;
