"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { enrichProductContext } from "@/lib/server/ai/enrichProductFromInput";

/** Build an editable product brief before a project is created or updated. */
export async function buildProductBrief(website: string) {
  await getUser();

  const product = await enrichProductContext("", undefined, website);
  if (!product.product_url) {
    return { error: "Add a valid public website, or describe your offer instead." };
  }
  if (!product.product_brief || product.product_brief === product.product_url) {
    return {
      error: "We couldn't read enough from that website. Describe your offer instead.",
    };
  }

  return {
    productUrl: product.product_url,
    productBrief: product.product_brief,
  };
}
