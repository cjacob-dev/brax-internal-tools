import { PrismaClient } from "@prisma/client";
import { seedKycCases } from "./seed-kyc";
import { seedUsers } from "./seed-users";

// Dev tooling run against a freshly reset database (npm run demo:reset), not a user mutation.
async function main() {
  const client = new PrismaClient();
  try {
    await seedUsers(client);
    console.log("Seeded users");
    const kyc = await seedKycCases(client);
    console.log(kyc.skipped ? "KYC cases already present (run npm run demo:reset for a clean demo)" : `Seeded ${kyc.cases} KYC cases and ${kyc.events} audit events`);
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
