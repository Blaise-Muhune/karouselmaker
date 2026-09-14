import { z } from "zod";

export const templateBundleInputSchema = z.object({
  name: z.string().trim().min(1, "Give the bundle a name.").max(60),
  template_ids: z.array(z.string().uuid()).min(1).max(3),
  as_system_bundle: z.boolean().optional(),
});
