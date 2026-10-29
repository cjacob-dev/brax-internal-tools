import { PrismaClient } from "@prisma/client";
import { seedUsers } from "./seed-users";

// Dev tooling run against a freshly reset database (npm run demo:reset), not a user mutation.
// App sessions add their own seed modules here (e.g. seedKycCases).
async function main() {
  const client = new PrismaClient();
  try {
    await seedUsers(client);
    console.log("Seeded users");
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
