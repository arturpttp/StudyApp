import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { csvRowSchema, type CsvRow } from "./csv-row.schema.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

export function parseCsv(filePath: string): CsvRow[] {
  const content = readFileSync(filePath, "utf-8");
  const records: Record<string, string>[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((record, index) => {
    const result = csvRowSchema.safeParse(record);
    if (!result.success) {
      const msg = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new Error(`${filePath}:${index + 2} — ${msg}`);
    }
    return result.data;
  });
}

const POSITION_MAP: Record<string, number> = {
  a: 0,
  b: 1,
  c: 2,
  d: 3,
  e: 4,
};

export async function upsertQuestion(
  prisma: PrismaClient,
  row: CsvRow,
  subjectMap: Map<string, string>,
  institutionMap: Map<string, string>,
): Promise<void> {
  const subjectId = subjectMap.get(row.subject);
  if (!subjectId) {
    throw new Error(`Unknown subject: "${row.subject}"`);
  }
  const institutionId = institutionMap.get(row.institution);
  if (!institutionId) {
    throw new Error(`Unknown institution: "${row.institution}"`);
  }

  const alternatives = (["a", "b", "c", "d", "e"] as const).map((letter) => ({
    text: row[letter],
    isCorrect: row.correct === letter,
    position: POSITION_MAP[letter],
  }));

  const existing = await prisma.question.findUnique({
    where: { externalId: row.externalId },
  });

  if (existing) {
    await prisma.question.update({
      where: { externalId: row.externalId },
      data: {
        statement: row.statement,
        explanation: row.explanation,
        difficulty: row.difficulty,
        year: row.year,
        subjectId,
        institutionId,
      },
    });

    for (const alt of alternatives) {
      await prisma.alternative.upsert({
        where: {
          questionId_position: {
            questionId: existing.id,
            position: alt.position,
          },
        },
        create: {
          questionId: existing.id,
          text: alt.text,
          isCorrect: alt.isCorrect,
          position: alt.position,
        },
        update: {
          text: alt.text,
          isCorrect: alt.isCorrect,
        },
      });
    }
  } else {
    await prisma.question.create({
      data: {
        externalId: row.externalId,
        statement: row.statement,
        explanation: row.explanation,
        difficulty: row.difficulty,
        year: row.year,
        subjectId,
        institutionId,
        alternatives: {
          create: alternatives,
        },
      },
    });
  }
}
