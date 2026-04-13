import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock nuqs — return simple state hooks
vi.mock("nuqs", () => {
  const states: Record<string, string | null> = {};

  function useQueryState(key: string, _opts?: unknown) {
    const { useState } = require("react");
    const [val, setVal] = useState<string | null>(states[key] ?? null);
    return [
      val,
      (v: string | null | ((prev: string | null) => string | null)) => {
        const next = typeof v === "function" ? v(val) : v;
        states[key] = next;
        setVal(next);
      },
    ] as const;
  }

  return {
    useQueryState,
    parseAsString: { withDefault: () => ({}) },
    parseAsInteger: { withDefault: () => ({}) },
    parseAsStringEnum: () => ({ withDefault: () => ({}) }),
  };
});

// Mock the generated hooks
vi.mock("@/lib/api/generated/hooks/useGetApiV1Questions", () => ({
  useGetApiV1Questions: vi.fn().mockReturnValue({
    data: {
      data: [
        {
          id: "q1",
          statement: "What is the powerhouse of the cell?",
          difficulty: "EASY",
          year: 2024,
          subject: { id: "s1", name: "Biologia" },
          institution: { id: "i1", name: "USP" },
          alternatives: [
            { id: "a1", text: "Mitocôndria", position: 0 },
            { id: "a2", text: "Ribossomo", position: 1 },
          ],
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/lib/api/generated/hooks/useGetApiV1Subjects", () => ({
  useGetApiV1Subjects: vi.fn().mockReturnValue({
    data: [{ id: "s1", name: "Biologia" }],
  }),
}));

vi.mock("@/lib/api/generated/hooks/useGetApiV1Institutions", () => ({
  useGetApiV1Institutions: vi.fn().mockReturnValue({
    data: [{ id: "i1", name: "USP" }],
  }),
}));

import { QuestionBrowser } from "@/components/questions/QuestionBrowser";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("QuestionBrowser", () => {
  it("renders question cards from API data", async () => {
    render(<QuestionBrowser />, { wrapper });

    await waitFor(() => {
      expect(
        screen.getByText("What is the powerhouse of the cell?"),
      ).toBeInTheDocument();
    });
  });

  it("shows difficulty badge", async () => {
    render(<QuestionBrowser />, { wrapper });

    await waitFor(() => {
      expect(screen.getAllByText("Fácil").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows subject and institution metadata", async () => {
    render(<QuestionBrowser />, { wrapper });

    await waitFor(() => {
      expect(screen.getAllByText("Biologia").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("USP").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders filter sidebar with labels", () => {
    render(<QuestionBrowser />, { wrapper });

    expect(screen.getByText("Filtros")).toBeInTheDocument();
    expect(screen.getByText("Especialidade")).toBeInTheDocument();
    expect(screen.getByText("Dificuldade")).toBeInTheDocument();
  });

  it("shows total count", async () => {
    render(<QuestionBrowser />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/1 questão/i)).toBeInTheDocument();
    });
  });
});
