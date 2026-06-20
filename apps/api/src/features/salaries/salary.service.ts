import Decimal from "decimal.js";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { recordAudit } from "../../lib/audit";
import { getSetting } from "../../lib/settings";
import type { CreateSalary } from "@acme/types";

function toResponse(r: {
  id: string;
  employeeId: string;
  amount: Decimal;
  currencyCode: string;
  payFrequency: string;
  effectiveDate: Date;
  createdAt: Date;
  createdBy: string;
}) {
  return {
    id: r.id,
    employeeId: r.employeeId,
    amount: r.amount.toString(),
    currencyCode: r.currencyCode,
    payFrequency: r.payFrequency,
    effectiveDate: r.effectiveDate.toISOString(),
    createdAt: r.createdAt.toISOString(),
    createdBy: r.createdBy,
  };
}

export async function getSalaryHistory(employeeId: string) {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) throw new AppError("NOT_FOUND", "Employee not found", 404);

  const records = await prisma.salaryRecord.findMany({
    where: { employeeId },
    orderBy: { effectiveDate: "desc" },
  });

  return records.map(toResponse);
}

export async function addSalaryRecord(
  employeeId: string,
  input: CreateSalary,
  actor: { id: string; email: string }
) {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) throw new AppError("NOT_FOUND", "Employee not found", 404);
  if (emp.status === "INACTIVE") {
    throw new AppError("CONFLICT", "Cannot add salary record for inactive employee", 409);
  }

  const newAmount = new Decimal(input.amount);
  const effectiveDate = new Date(input.effectiveDate);

  const current = await prisma.salaryRecord.findFirst({
    where: { employeeId, currencyCode: input.currencyCode },
    orderBy: { effectiveDate: "desc" },
  });

  if (current) {
    const pctChange = newAmount
      .minus(current.amount)
      .div(current.amount)
      .abs()
      .mul(100);

    const thresholdPct = parseFloat(
      await getSetting("salary_alert_threshold_pct")
    );

    if (pctChange.greaterThan(thresholdPct)) {
      throw new AppError(
        "SALARY_ALERT",
        `Salary change of ${pctChange.toFixed(1)}% exceeds the alert threshold of ${thresholdPct}%`,
        422,
        {
          currentAmount: current.amount.toString(),
          newAmount: newAmount.toString(),
          changePct: pctChange.toFixed(1),
          thresholdPct,
        }
      );
    }
  }

  const record = await prisma.salaryRecord.create({
    data: {
      employeeId,
      amount: newAmount,
      currencyCode: input.currencyCode,
      payFrequency: input.payFrequency,
      effectiveDate,
      createdBy: actor.id,
    },
  });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "CREATE",
    entityType: "SalaryRecord",
    entityId: record.id,
    fieldName: "amount",
    oldValue: current?.amount.toString(),
    newValue: newAmount.toString(),
  });

  return toResponse(record);
}

export async function getCurrentSalary(employeeId: string) {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) throw new AppError("NOT_FOUND", "Employee not found", 404);

  const record = await prisma.salaryRecord.findFirst({
    where: { employeeId },
    orderBy: { effectiveDate: "desc" },
  });

  return record ? toResponse(record) : null;
}
