import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { seed } from "../prisma/seed.js";

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? "",
  });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("Wiping question-related data...");
    await prisma.examQuestion.deleteMany({});
    await prisma.exam.deleteMany({});
    await prisma.answerHistory.deleteMany({});
    await prisma.alternative.deleteMany({});
    await prisma.question.deleteMany({});
    await prisma.topic.deleteMany({});
    console.log("Wipe complete. Reseeding...");
  } finally {
    await prisma.$disconnect();
  }

  await seed();
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
