import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  PORT: z.coerce.number().int().default(3001),
  WEB_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_PREFIX: z.string().default("audit-archive/"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.flatten().fieldErrors;
  const missing = Object.keys(errors).join(", ");
  console.error(`\n❌ Invalid environment variables: ${missing}`);
  console.error(JSON.stringify(errors, null, 2));
  console.error("\nCopy .env.example to .env and fill in the required values.\n");
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof schema>;
