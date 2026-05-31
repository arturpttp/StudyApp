import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { SUBJECTS, INSTITUTIONS, TOPICS } from "./seed/taxonomies.js";
import { parseCsv, upsertQuestion } from "./seed/ingest.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export interface SeedOptions {
  sourcesDir?: string;
}

export interface SeedResult {
  subjects: number;
  institutions: number;
  topics: number;
  questions: number;
}

export async function seed(options: SeedOptions = {}): Promise<SeedResult> {
  const sourcesDir =
    options.sourcesDir ?? resolve(__dirname, "seed/sources");

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? "",
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const subjectMap = new Map<string, string>();
    for (const name of SUBJECTS) {
      const record = await prisma.subject.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      subjectMap.set(name, record.id);
    }

    const institutionMap = new Map<string, string>();
    for (const name of INSTITUTIONS) {
      const record = await prisma.institution.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      institutionMap.set(name, record.id);
    }

    const topicMap = new Map<string, string>();
    for (const name of TOPICS) {
      const record = await prisma.topic.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      topicMap.set(name, record.id);
    }

    const files = readdirSync(sourcesDir)
      .filter((f) => f.endsWith(".csv"))
      .sort();

    let questionCount = 0;
    for (const file of files) {
      const rows = parseCsv(join(sourcesDir, file));
      for (const row of rows) {
        await upsertQuestion(prisma, row, subjectMap, institutionMap, topicMap);
        questionCount++;
      }
    }

    const result: SeedResult = {
      subjects: subjectMap.size,
      institutions: institutionMap.size,
      topics: topicMap.size,
      questions: questionCount,
    };

    console.log("Seed complete:", result);
    return result;
  } finally {
    await prisma.$disconnect();
  }
}

const isMainModule =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
