import "load";
import z from "zod";

const env_schema = z.object({
  OGMIOS_HOST: z.string(),
  OGMIOS_PORT: z.string(),

  KAFKA_HOSTS: z.string(),
});

export const env: z.infer<typeof env_schema> = env_schema.parse(
  Deno.env.toObject(),
);
