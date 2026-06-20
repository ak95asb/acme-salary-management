import { prisma } from "./prisma";
import type { AuditAction } from "@acme/types";

interface AuditParams {
  actorId: string;
  actorEmail: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
}

export async function recordAudit(params: AuditParams): Promise<void> {
  await prisma.auditLog.create({ data: params });
}
