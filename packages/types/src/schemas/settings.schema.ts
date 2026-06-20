import { z } from "zod";

export const systemSettingKeySchema = z.enum([
  "salary_alert_threshold_pct",
  "audit_retention_days",
  "s3_archive_bucket",
  "s3_archive_prefix",
]);

export const systemSettingSchema = z.object({
  key: systemSettingKeySchema,
  value: z.string(),
  updatedAt: z.string(),
});

export const updateSettingSchema = z.object({
  value: z.string().min(1),
});

export const settingsMapSchema = z.object({
  salary_alert_threshold_pct: z.coerce.number().int().min(1).max(200).default(50),
  audit_retention_days: z.coerce.number().int().min(30).max(3650).default(365),
  s3_archive_bucket: z.string().default(""),
  s3_archive_prefix: z.string().default("audit-archive/"),
});

export type SystemSettingKey = z.infer<typeof systemSettingKeySchema>;
export type SystemSetting = z.infer<typeof systemSettingSchema>;
export type SettingsMap = z.infer<typeof settingsMapSchema>;
