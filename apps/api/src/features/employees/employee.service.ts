import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { recordAudit } from "../../lib/audit";
import type { CreateEmployee, UpdateEmployee, EmployeeFilter, PaginationQuery } from "@acme/types";

function toResponse(e: {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  jobTitle: string;
  country: string;
  status: string;
  startDate: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...e,
    startDate: e.startDate.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

function generateEmployeeCode(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `EMP-${ts}-${rand}`;
}

export async function listEmployees(
  filters: EmployeeFilter,
  pagination: PaginationQuery
) {
  const { page, limit, sortBy = "lastName", sortDir = "asc" } = pagination;
  const skip = (page - 1) * limit;

  const where = buildWhere(filters);

  const allowedSortFields = ["lastName", "firstName", "department", "country", "status", "createdAt"];
  const orderByField = allowedSortFields.includes(sortBy) ? sortBy : "lastName";

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [orderByField]: sortDir },
    }),
    prisma.employee.count({ where }),
  ]);

  return {
    data: employees.map(toResponse),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

function buildWhere(filters: EmployeeFilter) {
  const where: Record<string, unknown> = {};

  if (filters.name) {
    where.OR = [
      { firstName: { contains: filters.name } },
      { lastName: { contains: filters.name } },
    ];
  }
  if (filters.department) where.department = { contains: filters.department };
  if (filters.country) where.country = { contains: filters.country };
  if (filters.jobTitle) where.jobTitle = { contains: filters.jobTitle };
  if (filters.status) where.status = filters.status;

  return where;
}

export async function getEmployee(id: string) {
  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) throw new AppError("NOT_FOUND", "Employee not found", 404);
  return toResponse(emp);
}

export async function createEmployee(
  input: CreateEmployee,
  actor: { id: string; email: string }
) {
  const employeeCode = input.employeeCode ?? generateEmployeeCode();

  const existing = await prisma.employee.findFirst({
    where: {
      OR: [{ email: input.email }, { employeeCode }],
    },
  });
  if (existing) {
    throw new AppError(
      "CONFLICT",
      existing.email === input.email
        ? "Email already in use"
        : "Employee code already in use",
      409
    );
  }

  const startDate = new Date(input.startDate);
  if (isNaN(startDate.getTime())) {
    throw new AppError("VALIDATION_ERROR", "Invalid startDate", 400);
  }

  const emp = await prisma.employee.create({
    data: { ...input, employeeCode, startDate, status: "ACTIVE" },
  });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "CREATE",
    entityType: "Employee",
    entityId: emp.id,
    newValue: JSON.stringify({ employeeCode, email: emp.email }),
  });

  return toResponse(emp);
}

export async function updateEmployee(
  id: string,
  input: UpdateEmployee,
  actor: { id: string; email: string }
) {
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Employee not found", 404);

  const data: Record<string, unknown> = {};
  const changedFields: Array<{ field: string; old: string; new: string }> = [];

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const currentVal = (existing as Record<string, unknown>)[key];
    const newVal = key === "startDate" ? new Date(value as string) : value;
    data[key] = newVal;
    changedFields.push({
      field: key,
      old: String(currentVal),
      new: String(value),
    });
  }

  if (Object.keys(data).length === 0) return toResponse(existing);

  const updated = await prisma.employee.update({ where: { id }, data });

  for (const change of changedFields) {
    await recordAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "UPDATE",
      entityType: "Employee",
      entityId: id,
      fieldName: change.field,
      oldValue: change.old,
      newValue: change.new,
    });
  }

  return toResponse(updated);
}

export async function deactivateEmployee(
  id: string,
  actor: { id: string; email: string }
) {
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Employee not found", 404);
  if (existing.status === "INACTIVE") return toResponse(existing);

  const updated = await prisma.employee.update({
    where: { id },
    data: { status: "INACTIVE" },
  });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "DEACTIVATE",
    entityType: "Employee",
    entityId: id,
    fieldName: "status",
    oldValue: "ACTIVE",
    newValue: "INACTIVE",
  });

  return toResponse(updated);
}
