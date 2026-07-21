/**
 * Exécuté une fois au démarrage du serveur Next.js :
 * migrations Drizzle puis seed du compte admin initial.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const { db, schema } = await import("@/lib/db");
  const database = db();

  await migrate(database, { migrationsFolder: "./drizzle" });

  // Bootstrap : si aucun utilisateur, créer l'admin depuis les variables
  // d'environnement (mêmes valeurs que l'ancien système mono-compte).
  const existing = await database.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (existing.length === 0) {
    const { env } = await import("@/lib/env");
    await database.insert(schema.users).values({
      username: env().ADMIN_USER,
      passwordHash: env().ADMIN_PASSWORD_HASH,
      origin: "k8s",
    });
    console.log(`[seed] compte admin initial créé : ${env().ADMIN_USER}`);
  }
}
