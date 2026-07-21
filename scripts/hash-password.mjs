#!/usr/bin/env node
// Génère un hash bcrypt pour ADMIN_PASSWORD_HASH.
// Usage : node scripts/hash-password.mjs "monMotDePasse"
import { hash } from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error('Usage : node scripts/hash-password.mjs "monMotDePasse"');
  process.exit(1);
}

console.log(await hash(password, 12));
