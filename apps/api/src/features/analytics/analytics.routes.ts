import { Router, type Router as RouterType } from "express";
import { distributionFilterSchema } from "@acme/types";
import { authenticate, requireRole } from "../../lib/middleware/auth";
import {
  getOverview,
  getSalaryDistribution,
  getDepartmentBreakdown,
  exportSalaryCsv,
} from "./analytics.service";

const router: RouterType = Router();

router.use(authenticate, requireRole("SYSTEM_ADMIN", "HR_ADMIN", "HR_VIEWER"));

router.get("/overview", async (_req, res, next) => {
  try {
    const data = await getOverview();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/distribution", async (req, res, next) => {
  const parse = distributionFilterSchema.safeParse({
    ...req.query,
    departments: req.query.departments
      ? String(req.query.departments).split(",")
      : undefined,
    countries: req.query.countries
      ? String(req.query.countries).split(",")
      : undefined,
    jobTitles: req.query.jobTitles
      ? String(req.query.jobTitles).split(",")
      : undefined,
  });

  try {
    const filters = parse.success ? parse.data : distributionFilterSchema.parse({});
    const data = await getSalaryDistribution(filters);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/departments", async (req, res, next) => {
  const parse = distributionFilterSchema.safeParse({
    ...req.query,
    departments: req.query.departments
      ? String(req.query.departments).split(",")
      : undefined,
    countries: req.query.countries
      ? String(req.query.countries).split(",")
      : undefined,
  });

  try {
    const deptFilters = parse.success ? parse.data : distributionFilterSchema.parse({});
    const data = await getDepartmentBreakdown(deptFilters);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/export/csv", async (req, res, next) => {
  const parse = distributionFilterSchema.safeParse({
    ...req.query,
    departments: req.query.departments
      ? String(req.query.departments).split(",")
      : undefined,
    countries: req.query.countries
      ? String(req.query.countries).split(",")
      : undefined,
  });

  try {
    const csvFilters = parse.success ? parse.data : distributionFilterSchema.parse({});
    const csv = await exportSalaryCsv(csvFilters);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="salaries-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

export default router;
