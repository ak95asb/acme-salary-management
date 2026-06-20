import { prisma } from "./prisma";

const DEFAULTS: Record<string, string> = {
  salary_alert_threshold_pct: "50",
  audit_retention_days: "365",
  s3_archive_bucket: "",
  s3_archive_prefix: "audit-archive/",
};

const cache = new Map<string, { value: string; expiresAt: number }>();
const TTL_MS = 60_000;

export async function getSetting(key: string): Promise<string> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const row = await prisma.systemSetting.findUnique({ where: { key } });
  const value = row?.value ?? DEFAULTS[key] ?? "";
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await prisma.systemSetting.findMany();
  const result: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) result[row.key] = row.value;
  return result;
}
