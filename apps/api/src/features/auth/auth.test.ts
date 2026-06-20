import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";

const app = createApp();

const TEST_EMAIL = "auth-test@acme.com";
const TEST_PASSWORD = "Password123!";

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
      role: "HR_ADMIN",
      isActive: true,
    },
  });
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({
    where: { user: { email: TEST_EMAIL } },
  });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

describe("POST /api/auth/login", () => {
  it("returns access token on valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(TEST_EMAIL);
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rejects invalid password with generic error", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: "WrongPassword!" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects unknown email with same generic error", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@acme.com", password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.error.message).toBe("Invalid credentials");
  });

  it("returns 400 on malformed input", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "x" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/auth/refresh", () => {
  it("returns new access token with valid refresh cookie", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const cookie = loginRes.headers["set-cookie"][0];

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it("rejects missing refresh cookie", async () => {
    const res = await request(app).post("/api/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("rejects tampered refresh token", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", "refresh_token=invalidtokenvalue");

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears cookie and revokes refresh token", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const cookie = loginRes.headers["set-cookie"][0];

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookie);

    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookie);

    expect(refreshRes.status).toBe(401);
  });
});
