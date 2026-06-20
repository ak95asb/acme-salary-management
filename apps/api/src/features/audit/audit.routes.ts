import { Router, type Router as RouterType } from "express";
import { auditFilterSchema, paginationQuerySchema } from "@acme/types";
import { authenticate, requireRole } from "../../lib/middleware/auth";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";

const router: RouterType = Router();

router.use(authenticate, requireRole("SYSTEM_ADMIN", "HR_ADMIN"));

router.get("/", async (req, res, next) => {
  const filterParse = auditFilterSchema.safeParse(req.query);
  const pageParse = paginationQuerySchema.safeParse(req.query);

  if (!filterParse.success || !pageParse.success) {
    return next(new AppError("VALIDATION_ERROR", "Invalid query parameters", 400));
  }

  const { actorId, actorEmail, entityType, action, from, to } = filterParse.data;
  const { page, limit } = pageParse.data;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (actorId) where.actorId = actorId;
  if (actorEmail) where.actorEmail = { contains: actorEmail };
  if (entityType) where.entityType = entityType;
  if (action) where.action = action;
  if (from || to) {
    where.timestamp = {};
    if (from) (where.timestamp as Record<string, unknown>).gte = new Date(from);
    if (to) (where.timestamp as Record<string, unknown>).lte = new Date(to);
  }

  try {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: "desc" },
      }),
      prisma.auditLog.count({ where }),
    ]);

    const data = logs.map((l) => ({
      ...l,
      timestamp: l.timestamp.toISOString(),
    }));

    res.json({
      success: true,
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
