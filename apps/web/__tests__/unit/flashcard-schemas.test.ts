import { describe, it, expect } from "vitest";
import {
  flashcardsQuerySchema,
  createFlashcardBodySchema,
  updateFlashcardBodySchema,
  reviewFlashcardBodySchema,
} from "@/lib/api/schemas/flashcards";

describe("flashcardsQuerySchema", () => {
  it("defaults dueOnly to false and topicIds to []", () => {
    const parsed = flashcardsQuerySchema.parse({});
    expect(parsed.dueOnly).toBe(false);
    expect(parsed.topicIds).toEqual([]);
  });

  it("accepts dueOnly=true and array topicIds", () => {
    const parsed = flashcardsQuerySchema.parse({
      dueOnly: "true",
      topicIds: ["t1", "t2"],
    });
    expect(parsed.dueOnly).toBe(true);
    expect(parsed.topicIds).toEqual(["t1", "t2"]);
  });

  it("accepts a single topicId as string", () => {
    const parsed = flashcardsQuerySchema.parse({ topicIds: "t1" });
    expect(parsed.topicIds).toEqual(["t1"]);
  });
});

describe("createFlashcardBodySchema", () => {
  it("accepts minimum valid body", () => {
    const result = createFlashcardBodySchema.safeParse({
      front: "Q",
      back: "A",
    });
    expect(result.success).toBe(true);
  });

  it("defaults topicIds to []", () => {
    const result = createFlashcardBodySchema.parse({
      front: "Q",
      back: "A",
    });
    expect(result.topicIds).toEqual([]);
  });

  it("rejects empty front", () => {
    const result = createFlashcardBodySchema.safeParse({
      front: "",
      back: "A",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty back", () => {
    const result = createFlashcardBodySchema.safeParse({
      front: "Q",
      back: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateFlashcardBodySchema", () => {
  it("accepts partial update", () => {
    const result = updateFlashcardBodySchema.safeParse({ front: "novo" });
    expect(result.success).toBe(true);
  });

  it("accepts topicIds-only update", () => {
    const result = updateFlashcardBodySchema.safeParse({ topicIds: ["t1"] });
    expect(result.success).toBe(true);
  });

  it("accepts empty body", () => {
    const result = updateFlashcardBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("reviewFlashcardBodySchema", () => {
  it.each([0, 3, 4, 5])("accepts rating %i", (rating) => {
    const result = reviewFlashcardBodySchema.safeParse({ rating });
    expect(result.success).toBe(true);
  });

  it.each([1, 2, 6, -1, "5"])("rejects invalid rating %s", (rating) => {
    const result = reviewFlashcardBodySchema.safeParse({ rating });
    expect(result.success).toBe(false);
  });
});
