// TODO: Phase 1 — full seed implemented in Prompt 1
// Placeholder stub so `prisma db seed` doesn't crash during Phase 0.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seed stub — run `npm run seed:synthetic` after Phase 1 is complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
