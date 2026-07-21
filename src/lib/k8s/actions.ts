"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import {
  deletePod,
  restartDeployment,
  scaleDeployment,
} from "./resources";

async function assertLoggedIn() {
  const session = await getSession();
  if (!session.loggedIn) {
    throw new Error("Non authentifié");
  }
}

export async function deletePodAction(namespace: string, name: string) {
  await assertLoggedIn();
  await deletePod(namespace, name);
  revalidatePath("/pods");
}

export async function scaleDeploymentAction(
  namespace: string,
  name: string,
  replicas: number,
) {
  await assertLoggedIn();
  if (!Number.isInteger(replicas) || replicas < 0 || replicas > 50) {
    throw new Error("Nombre de replicas invalide (0 à 50)");
  }
  await scaleDeployment(namespace, name, replicas);
  revalidatePath("/workloads");
}

export async function restartDeploymentAction(namespace: string, name: string) {
  await assertLoggedIn();
  await restartDeployment(namespace, name);
  revalidatePath("/workloads");
}
