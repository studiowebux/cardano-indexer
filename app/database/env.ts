import "load";
import z from "zod";

const env_schema = z.object({
  MONGO_DB_URL: z.string(),
  REDIS_URL: z.string().optional(),
});

export const env: z.infer<typeof env_schema> = env_schema.parse(
  Deno.env.toObject(),
);
