"use server";

import { revalidatePath } from "next/cache";
import { createTenant } from "../../../lib/tenant-store";

export async function createTenantAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "");
  const plan = String(formData.get("plan") ?? "");
  createTenant({ name, plan });
  revalidatePath("/tenants");
}
