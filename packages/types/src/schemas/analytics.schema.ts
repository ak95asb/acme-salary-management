import { z } from "zod";

export const distributionFilterSchema = z.object({
  departments: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
  jobTitles: z.array(z.string()).optional(),
  includeInactive: z.coerce.boolean().default(false),
  currencyCode: z.string().length(3).optional(),
});

export const salaryStatsSchema = z.object({
  count: z.number(),
  median: z.string().nullable(),
  mean: z.string().nullable(),
  min: z.string().nullable(),
  max: z.string().nullable(),
  currencyCode: z.string().nullable(),
});

export const overviewResponseSchema = z.object({
  totalHeadcount: z.number(),
  activeHeadcount: z.number(),
  byDepartment: z.array(z.object({ department: z.string(), count: z.number() })),
  byCountry: z.array(z.object({ country: z.string(), count: z.number() })),
});

export type DistributionFilter = z.infer<typeof distributionFilterSchema>;
export type SalaryStats = z.infer<typeof salaryStatsSchema>;
export type OverviewResponse = z.infer<typeof overviewResponseSchema>;
