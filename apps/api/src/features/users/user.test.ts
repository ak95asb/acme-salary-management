import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";

const app = createApp();

const ADMIN_EMAIL = "sysadmin-test@acme.com";
const ADMIN_PASS = "AdminPass123!";

async function getAdminToken(): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASS });
  return res.body.data.accessToken;
}

beforeAll(async () => {
  await prisma.auditLog.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { startsWith: "user-test" } } });
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });
  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(ADMIN_PASS, 10),
      role: "SYSTEM_ADMIN",
      isActive: true,
    },
  });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { startsWith: "user-test" } } });
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });
  await prisma.$disconnect();
});

describe("GET /api/users", () => {
  it("returns user list for SYSTEM_ADMIN", async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/users", () => {
  it("creates a new user as SYSTEM_ADMIN", async () => {
    const token = await getAdminToken();
    const email = `user-test-${Date.now()}@acme.com`;

    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email, password: "UserPass123!", role: "HR_VIEWER" });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(email);
    expect(res.body.data.role).toBe("HR_VIEWER");
  });

  it("rejects duplicate email", async () => {
    const token = await getAdminToken();

    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "user-test-dup@acme.com", password: "Pass123!A", role: "HR_VIEWER" });

    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "user-test-dup@acme.com", password: "Pass123!A", role: "HR_VIEWER" });

    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/users/:id/active", () => {
  it("deactivates a user", async () => {
    const token = await getAdminToken();

    const createRes = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: `user-test-deact-${Date.now()}@acme.com`,
        password: "Pass123!A",
        role: "HR_VIEWER",
      });

    const userId = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/users/${userId}/active`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });
});
