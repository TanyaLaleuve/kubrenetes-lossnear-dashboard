"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/user";
import { createMcpToken, revokeMcpToken } from "./tokens";

export type McpTokenState = {
  error?: string;
  /** Jeton en clair, renvoyé une seule fois après création. */
  token?: string;
};

/** Crée un jeton MCP pour l'utilisateur courant (valeur en clair renvoyée une fois). */
export async function createMcpTokenAction(
  _prev: McpTokenState,
  formData: FormData,
): Promise<McpTokenState> {
  const user = await currentUser();
  const label = String(formData.get("label") ?? "").trim().slice(0, 64) || null;
  const { token } = await createMcpToken(user.id, label);
  revalidatePath("/", "layout");
  return { token };
}

export async function revokeMcpTokenAction(tokenId: string) {
  const user = await currentUser();
  await revokeMcpToken(user.id, tokenId);
  revalidatePath("/", "layout");
}
