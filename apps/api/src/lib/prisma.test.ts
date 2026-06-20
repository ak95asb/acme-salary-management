import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "./prisma";

describe("Prisma client", () => {
  it("connects to the database and executes a raw query", async () => {
    const result = await prisma.$queryRaw<[{ value: number }]>`SELECT 1 as value`;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("uses the singleton pattern — same instance on re-import", async () => {
    const { prisma: prisma2 } = await import("./prisma");
    expect(prisma2).toBe(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
