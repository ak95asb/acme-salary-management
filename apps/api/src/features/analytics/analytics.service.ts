import Decimal from "decimal.js";
import { prisma } from "../../lib/prisma";
import type { DistributionFilter } from "@acme/types";

function buildEmployeeWhere(filters: DistributionFilter) {
  const where: Record<string, unknown> = {};
  if (!filters.includeInactive) where.status = "ACTIVE";
  if (filters.departments?.length) where.department = { in: filters.departments };
  if (filters.countries?.length) where.country = { in: filters.countries };
  if (filters.jobTitles?.length) where.jobTitle = { in: filters.jobTitles };
  return where;
}

export async function getOverview() {
  const [totalHeadcount, activeHeadcount, byDept, byCountry] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.employee.groupBy({ by: ["department"], _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
    prisma.employee.groupBy({ by: ["country"], _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
  ]);

  return {
    totalHeadcount,
    activeHeadcount,
    byDepartment: byDept.map((r) => ({ department: r.department, count: r._count.id })),
    byCountry: byCountry.map((r) => ({ country: r.country, count: r._count.id })),
  };
}

export async function getSalaryDistribution(filters: DistributionFilter) {
  const employeeWhere = buildEmployeeWhere(filters);

  const employees = await prisma.employee.findMany({
    where: employeeWhere,
    select: { id: true, department: true, country: true, jobTitle: true },
  });

  if (employees.length === 0) {
    return { count: 0, median: null, mean: null, min: null, max: null, currencyCode: filters.currencyCode ?? null };
  }

  const empIds = employees.map((e) => e.id);
  const currencyFilter = filters.currencyCode ? { currencyCode: filters.currencyCode } : {};

  const latestSalaryPerEmployee = await getLatestSalariesForEmployees(empIds, currencyFilter);

  if (latestSalaryPerEmployee.length === 0) {
    return { count: 0, median: null, mean: null, min: null, max: null, currencyCode: filters.currencyCode ?? null };
  }

  const amounts = latestSalaryPerEmployee.map((r) => new Decimal(r.amount.toString())).sort((a, b) => a.comparedTo(b));
  const count = amounts.length;
  const sum = amounts.reduce((acc, a) => acc.plus(a), new Decimal(0));
  const mean = sum.div(count);
  const median = count % 2 === 0
    ? amounts[count / 2 - 1].plus(amounts[count / 2]).div(2)
    : amounts[Math.floor(count / 2)];

  const currencyCode = latestSalaryPerEmployee[0].currencyCode;

  return {
    count,
    median: median.toString(),
    mean: mean.toFixed(2),
    min: amounts[0].toString(),
    max: amounts[count - 1].toString(),
    currencyCode,
  };
}

async function getLatestSalariesForEmployees(
  empIds: string[],
  currencyFilter: { currencyCode?: string }
) {
  const allRecords = await prisma.salaryRecord.findMany({
    where: { employeeId: { in: empIds }, ...currencyFilter },
    orderBy: { effectiveDate: "desc" },
    select: { employeeId: true, amount: true, currencyCode: true, effectiveDate: true },
  });

  const latestByEmp = new Map<string, (typeof allRecords)[0]>();
  for (const r of allRecords) {
    if (!latestByEmp.has(r.employeeId)) latestByEmp.set(r.employeeId, r);
  }
  return Array.from(latestByEmp.values());
}

export async function getDepartmentBreakdown(filters: DistributionFilter) {
  const employeeWhere = buildEmployeeWhere(filters);
  const currencyFilter = filters.currencyCode ? { currencyCode: filters.currencyCode } : {};

  const employees = await prisma.employee.findMany({
    where: employeeWhere,
    select: { id: true, department: true },
  });

  const byDept: Record<string, string[]> = {};
  for (const e of employees) {
    if (!byDept[e.department]) byDept[e.department] = [];
    byDept[e.department].push(e.id);
  }

  const results = await Promise.all(
    Object.entries(byDept).map(async ([dept, ids]) => {
      const records = await getLatestSalariesForEmployees(ids, currencyFilter);
      const amounts = records.map((r) => new Decimal(r.amount.toString())).sort((a, b) => a.comparedTo(b));
      const count = amounts.length;
      if (count === 0) return { department: dept, count: employees.filter((e) => e.department === dept).length, median: null, mean: null };
      const sum = amounts.reduce((acc, a) => acc.plus(a), new Decimal(0));
      const median = count % 2 === 0
        ? amounts[count / 2 - 1].plus(amounts[count / 2]).div(2)
        : amounts[Math.floor(count / 2)];
      return {
        department: dept,
        count,
        median: median.toString(),
        mean: sum.div(count).toFixed(2),
      };
    })
  );

  return results.sort((a, b) => a.department.localeCompare(b.department));
}

export async function exportSalaryCsv(filters: DistributionFilter): Promise<string> {
  const employeeWhere = buildEmployeeWhere(filters);
  const currencyFilter = filters.currencyCode ? { currencyCode: filters.currencyCode } : {};

  const employees = await prisma.employee.findMany({
    where: employeeWhere,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const empIds = employees.map((e) => e.id);
  const records = await getLatestSalariesForEmployees(empIds, currencyFilter);
  const salaryMap = new Map(records.map((r) => [r.employeeId, r]));

  const header = "employeeCode,firstName,lastName,department,jobTitle,country,status,amount,currencyCode,payFrequency,effectiveDate";
  const rows = employees.map((e) => {
    const s = salaryMap.get(e.id);
    const eff = s ? new Date(s.effectiveDate).toISOString().slice(0, 10) : "";
    return [
      e.employeeCode,
      `"${e.firstName}"`,
      `"${e.lastName}"`,
      `"${e.department}"`,
      `"${e.jobTitle}"`,
      e.country,
      e.status,
      s?.amount.toString() ?? "",
      s?.currencyCode ?? "",
      "",
      eff,
    ].join(",");
  });

  return [header, ...rows].join("\n");
}
