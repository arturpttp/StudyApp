import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { seed } from "../prisma/seed.js";

function createTestClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? "",
  });
  return new PrismaClient({ adapter });
}

describe("seed", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createTestClient();
  });

  afterEach(async () => {
    await prisma.answerHistory.deleteMany({
      where: { question: { externalId: { startsWith: "__test_" } } },
    });
    await prisma.alternative.deleteMany({
      where: { question: { externalId: { startsWith: "__test_" } } },
    });
    await prisma.question.deleteMany({
      where: { externalId: { startsWith: "__test_" } },
    });
  });

  it("seeds taxonomies and questions from CSV", async () => {
    const tmpDir = join(tmpdir(), `seed-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    writeFileSync(
      join(tmpDir, "test.csv"),
      `externalId,institution,subject,year,difficulty,statement,a,b,c,d,e,correct,explanation
__test_q001,HealthQuest,Enfermagem,,MEDIUM,"Qual é a primeira etapa do processo de enfermagem?",Diagnóstico,Coleta de dados,Planejamento,Implementação,Avaliação,b,"A coleta de dados é a primeira etapa do processo de enfermagem segundo a SAE."
__test_q002,HealthQuest,Nutrição,,EASY,"O IMC é calculado dividindo peso pela altura ao quadrado. Qual a faixa de eutrofia?",< 18.5,18.5 a 24.9,25 a 29.9,30 a 34.9,> 40,b,"Segundo a OMS o IMC entre 18.5 e 24.9 kg/m² indica eutrofia em adultos."`,
    );

    const result = await seed({ sourcesDir: tmpDir });

    expect(result.subjects).toBe(5);
    expect(result.institutions).toBe(6);
    expect(result.questions).toBe(2);

    const questions = await prisma.question.findMany({
      where: { externalId: { startsWith: "__test_" } },
      include: { alternatives: { orderBy: { position: "asc" } } },
    });

    expect(questions).toHaveLength(2);
    for (const q of questions) {
      expect(q.alternatives).toHaveLength(5);
      const correctAlts = q.alternatives.filter((a) => a.isCorrect);
      expect(correctAlts).toHaveLength(1);
    }

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("is idempotent — re-running does not duplicate rows", async () => {
    const tmpDir = join(tmpdir(), `seed-test-idem-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    const csv = `externalId,institution,subject,year,difficulty,statement,a,b,c,d,e,correct,explanation
__test_idem001,HealthQuest,Enfermagem,,MEDIUM,"Questão teste de idempotência para verificar que não duplica.",Alt A,Alt B,Alt C,Alt D,Alt E,a,"Explicação da questão teste de idempotência para o seed runner."`;

    writeFileSync(join(tmpDir, "test.csv"), csv);

    await seed({ sourcesDir: tmpDir });
    await seed({ sourcesDir: tmpDir });

    const questions = await prisma.question.findMany({
      where: { externalId: "__test_idem001" },
    });
    expect(questions).toHaveLength(1);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("preserves Question.id and Alternative.id across re-runs", async () => {
    const tmpDir = join(tmpdir(), `seed-test-ids-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    const csv = `externalId,institution,subject,year,difficulty,statement,a,b,c,d,e,correct,explanation
__test_stable001,HealthQuest,Enfermagem,,MEDIUM,"Questão para testar estabilidade dos IDs após re-run do seed.",A1,B1,C1,D1,E1,c,"Explicação da questão de estabilidade de IDs no seed runner."`;

    writeFileSync(join(tmpDir, "test.csv"), csv);

    await seed({ sourcesDir: tmpDir });

    const firstRun = await prisma.question.findUnique({
      where: { externalId: "__test_stable001" },
      include: { alternatives: { orderBy: { position: "asc" } } },
    });

    await seed({ sourcesDir: tmpDir });

    const secondRun = await prisma.question.findUnique({
      where: { externalId: "__test_stable001" },
      include: { alternatives: { orderBy: { position: "asc" } } },
    });

    expect(secondRun!.id).toBe(firstRun!.id);
    expect(secondRun!.alternatives[0].id).toBe(firstRun!.alternatives[0].id);
    expect(secondRun!.alternatives[4].id).toBe(firstRun!.alternatives[4].id);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("preserves AnswerHistory across re-runs", async () => {
    const tmpDir = join(tmpdir(), `seed-test-history-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    const csv = `externalId,institution,subject,year,difficulty,statement,a,b,c,d,e,correct,explanation
__test_history001,HealthQuest,Enfermagem,,MEDIUM,"Questão para testar preservação do AnswerHistory no seed.",HA,HB,HC,HD,HE,a,"Explicação para teste de preservação de AnswerHistory após re-run."`;

    writeFileSync(join(tmpDir, "test.csv"), csv);
    await seed({ sourcesDir: tmpDir });

    const question = await prisma.question.findUnique({
      where: { externalId: "__test_history001" },
      include: { alternatives: { orderBy: { position: "asc" } } },
    });

    const testUser = await prisma.user.create({
      data: {
        name: "__test_user",
        email: "__test_seed_history@test.com",
        password: "hashed",
      },
    });

    const history = await prisma.answerHistory.create({
      data: {
        userId: testUser.id,
        questionId: question!.id,
        alternativeId: question!.alternatives[0].id,
        isCorrect: true,
        responseTime: 5000,
      },
    });

    await seed({ sourcesDir: tmpDir });

    const preserved = await prisma.answerHistory.findUnique({
      where: { id: history.id },
    });
    expect(preserved).not.toBeNull();
    expect(preserved!.alternativeId).toBe(question!.alternatives[0].id);

    await prisma.answerHistory.delete({ where: { id: history.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws on invalid CSV row with file and line info", async () => {
    const tmpDir = join(tmpdir(), `seed-test-bad-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    writeFileSync(
      join(tmpDir, "bad.csv"),
      `externalId,institution,subject,year,difficulty,statement,a,b,c,d,e,correct,explanation
__test_bad001,HealthQuest,Enfermagem,,MEDIUM,"Short",A,B,C,D,E,z,"Explanation that is long enough to pass validation."`,
    );

    await expect(seed({ sourcesDir: tmpDir })).rejects.toThrow(/bad\.csv:2/);

    const questions = await prisma.question.findMany({
      where: { externalId: "__test_bad001" },
    });
    expect(questions).toHaveLength(0);

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
