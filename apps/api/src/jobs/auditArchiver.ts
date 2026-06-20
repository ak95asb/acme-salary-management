import cron from "node-cron";
import pino from "pino";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "../lib/prisma";
import { getSetting } from "../lib/settings";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

async function archiveOldAuditLogs() {
  const retentionDays = parseInt(await getSetting("audit_retention_days"), 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const logs = await prisma.auditLog.findMany({
    where: { timestamp: { lt: cutoff } },
    orderBy: { timestamp: "asc" },
  });

  if (logs.length === 0) {
    logger.info("Audit archiver: no logs to archive");
    return;
  }

  const bucket = await getSetting("s3_archive_bucket");
  const prefix = (await getSetting("s3_archive_prefix")) || "audit-archive/";

  if (!bucket) {
    logger.warn("Audit archiver: S3 bucket not configured, skipping upload");
    return;
  }

  const dateStr = cutoff.toISOString().slice(0, 10);
  const key = `${prefix}${dateStr}-${Date.now()}.ndjson`;
  const body = logs.map((l) => JSON.stringify(l)).join("\n");

  const s3 = new S3Client({
    region: process.env.AWS_REGION ?? "us-east-1",
  });

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "application/x-ndjson",
      })
    );

    await prisma.auditLog.deleteMany({
      where: { id: { in: logs.map((l) => l.id) } },
    });

    logger.info(
      { archivedCount: logs.length, s3Key: key },
      "Audit archiver: archived and purged old audit logs"
    );
  } catch (err) {
    logger.error({ err }, "Audit archiver: S3 upload failed — logs NOT deleted");
    throw err;
  }
}

export function startAuditArchiver() {
  cron.schedule("0 2 * * *", () => {
    archiveOldAuditLogs().catch((err) => {
      logger.error({ err }, "Audit archiver: unhandled error");
    });
  });
  logger.info("Audit archiver scheduled (daily at 02:00)");
}
