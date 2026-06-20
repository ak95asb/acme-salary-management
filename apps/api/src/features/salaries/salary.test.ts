import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";

const app = createApp();

const ADMIN_EMAIL = "salary-admin@acme.com";
const PASS = "TestPass123!";
let adminToken: string;
let employeeId: string;

beforeAll(async () => {
  await prisma.auditLog.deleteMany({});
  await prisma.salaryRecord.deleteMany({});
  await prisma.employee.deleteMany({ where: { email: { contains: "salary-test" } } });
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });
  await prisma.systemSetting.deleteMany({ where: { key: "salary_alert_threshold_pct" } });

  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(PASS, 10),
      role: "HR_ADMIN",
      isActive: true,
    },
  });

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: ADMIN_EMAIL, password: PASS });
  adminToken = loginRes.body.data.accessToken;

  const empRes = await request(app)
    .post("/api/employees")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      firstName: "Salary",
      lastName: "Test",
      email: "salary-test@acme.com",
      department: "Finance",
      jobTitle: "Analyst",
      country: "US",
      startDate: "2023-01-01",
    });
  employeeId = empRes.body.data.id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({});
  await prisma.salaryRecord.deleteMany({});
  await prisma.employee.deleteMany({ where: { email: { contains: "salary-test" } } });
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });
  await prisma.$disconnect();
});

describe("POST /api/employees/:id/salaries", () => {
  it("adds first salary record", async () => {
    const res = await request(app)
      .post(`/api/employees/${employeeId}/salaries`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amount: "5000.00",
        currencyCode: "USD",
        payFrequency: "MONTHLY",
        effectiveDate: "2024-01-01",
      });

    expect(res.status).toBe(201);
    expect(parseFloat(res.body.data.amount)).toBe(5000);
    expect(res.body.data.currencyCode).toBe("USD");
  });

  it("adds second salary record within threshold", async () => {
    const res = await request(app)
      .post(`/api/employees/${employeeId}/salaries`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amount: "5500.00",
        currencyCode: "USD",
        payFrequency: "MONTHLY",
        effectiveDate: "2024-06-01",
      });

    expect(res.status).toBe(201);
    expect(parseFloat(res.body.data.amount)).toBe(5500);
  });

  it("blocks salary exceeding alert threshold (default 50%)", async () => {
    const res = await request(app)
      .post(`/api/employees/${employeeId}/salaries`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amount: "15000.00",
        currencyCode: "USD",
        payFrequency: "MONTHLY",
        effectiveDate: "2024-12-01",
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("SALARY_ALERT");
    expect(res.body.error.details.changePct).toBeDefined();
  });

  it("rejects invalid currency code", async () => {
    const res = await request(app)
      .post(`/api/employees/${employeeId}/salaries`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amount: "5000.00",
        currencyCode: "usd",
        payFrequency: "MONTHLY",
        effectiveDate: "2024-01-15",
      });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/employees/:id/salaries", () => {
  it("returns salary history ordered newest-first", async () => {
    const res = await request(app)
      .get(`/api/employees/${employeeId}/salaries`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(new Date(res.body.data[0].effectiveDate) >= new Date(res.body.data[1].effectiveDate)).toBe(true);
  });
});

describe("GET /api/employees/:id/salaries/current", () => {
  it("returns the most recent salary record", async () => {
    const res = await request(app)
      .get(`/api/employees/${employeeId}/salaries/current`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).not.toBeNull();
    expect(res.body.data.amount).toBeDefined();
  });
});
