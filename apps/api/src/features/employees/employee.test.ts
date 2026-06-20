import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";

const app = createApp();

const ADMIN_EMAIL = "emp-admin@acme.com";
const VIEWER_EMAIL = "emp-viewer@acme.com";
const PASS = "TestPass123!";

let adminToken: string;
let viewerToken: string;

async function login(email: string, password: string): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });
  return res.body.data.accessToken;
}

function makeEmployee(overrides: Record<string, unknown> = {}) {
  const uid = Date.now() + Math.floor(Math.random() * 1000);
  return {
    firstName: "Jane",
    lastName: "Doe",
    email: `jane-${uid}@acme.com`,
    department: "Engineering",
    jobTitle: "Software Engineer",
    country: "US",
    startDate: "2024-01-15",
    ...overrides,
  };
}

beforeAll(async () => {
  await prisma.auditLog.deleteMany({});
  await prisma.salaryRecord.deleteMany({});
  await prisma.employee.deleteMany({ where: { email: { contains: "@acme.com" } } });
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, VIEWER_EMAIL] } } });

  await Promise.all([
    prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash: await bcrypt.hash(PASS, 10),
        role: "HR_ADMIN",
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: VIEWER_EMAIL,
        passwordHash: await bcrypt.hash(PASS, 10),
        role: "HR_VIEWER",
        isActive: true,
      },
    }),
  ]);

  [adminToken, viewerToken] = await Promise.all([
    login(ADMIN_EMAIL, PASS),
    login(VIEWER_EMAIL, PASS),
  ]);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({});
  await prisma.salaryRecord.deleteMany({});
  await prisma.employee.deleteMany({ where: { email: { contains: "@acme.com" } } });
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, VIEWER_EMAIL] } } });
  await prisma.$disconnect();
});

describe("POST /api/employees", () => {
  it("creates employee as HR_ADMIN", async () => {
    const body = makeEmployee();
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(body.email);
    expect(res.body.data.status).toBe("ACTIVE");
    expect(res.body.data.employeeCode).toMatch(/^EMP-/);
  });

  it("rejects duplicate email", async () => {
    const body = makeEmployee({ email: "dup-emp@acme.com" });
    await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(body);

    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(body);

    expect(res.status).toBe(409);
  });

  it("forbids HR_VIEWER from creating employees", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send(makeEmployee());

    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid input", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ firstName: "", email: "not-an-email" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/employees", () => {
  it("returns paginated employee list", async () => {
    const res = await request(app)
      .get("/api/employees?page=1&limit=10")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
    expect(typeof res.body.meta.total).toBe("number");
  });

  it("allows HR_VIEWER to list employees", async () => {
    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
  });

  it("filters by status", async () => {
    const res = await request(app)
      .get("/api/employees?status=ACTIVE")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((e: { status: string }) => e.status === "ACTIVE")).toBe(true);
  });
});

describe("PATCH /api/employees/:id", () => {
  it("updates employee department", async () => {
    const createRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(makeEmployee());

    const id = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/employees/${id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ department: "Product" });

    expect(res.status).toBe(200);
    expect(res.body.data.department).toBe("Product");
  });
});

describe("DELETE /api/employees/:id (soft-delete)", () => {
  it("deactivates employee instead of deleting", async () => {
    const createRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(makeEmployee());

    const id = createRes.body.data.id;

    const deleteRes = await request(app)
      .delete(`/api/employees/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(204);

    const getRes = await request(app)
      .get(`/api/employees/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(getRes.body.data.status).toBe("INACTIVE");
  });
});
