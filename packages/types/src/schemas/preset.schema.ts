import { z } from "zod";
import { distributionFilterSchema } from "./analytics.schema";

export const filterPresetSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  filterJson: z.string(),
  createdAt: z.string(),
});

export const createPresetSchema = z.object({
  name: z.string().min(1).max(100),
  filters: distributionFilterSchema,
});

export const updatePresetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  filters: distributionFilterSchema.optional(),
});

export type FilterPreset = z.infer<typeof filterPresetSchema>;
export type CreatePreset = z.infer<typeof createPresetSchema>;
export type UpdatePreset = z.infer<typeof updatePresetSchema>;
