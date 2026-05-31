"use client";

import {
  useQueryState,
  useQueryStates,
  parseAsString,
  parseAsInteger,
  parseAsArrayOf,
  parseAsStringEnum,
} from "nuqs";
import { useGetApiV1Questions } from "@/lib/api/generated/hooks/useGetApiV1Questions";
import { FilterSidebar } from "./FilterSidebar";
import { QuestionCard } from "./QuestionCard";
import { QuestionListSkeleton } from "./QuestionListSkeleton";
import { PaginationControl } from "@/components/ui/PaginationControl";
import type { GetApiV1QuestionsQueryParams } from "@/lib/api/generated/types/GetApiV1Questions";

export function QuestionBrowser() {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [subjectId, setSubjectId] = useQueryState("subjectId", parseAsString);
  const [institutionId, setInstitutionId] = useQueryState("institutionId", parseAsString);
  const [difficulty, setDifficulty] = useQueryState("difficulty", parseAsString);
  const [year, setYear] = useQueryState("year", parseAsString);
  const [topicIds, setTopicIds] = useQueryState(
    "topicIds",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [topicMatchMode, setTopicMatchMode] = useQueryState(
    "topicMatchMode",
    parseAsStringEnum<"any" | "all">(["any", "all"]).withDefault("any"),
  );

  const filters = { subjectId, institutionId, difficulty, year, topicIds, topicMatchMode };

  const params: GetApiV1QuestionsQueryParams = {
    page,
    limit: 20,
    ...(subjectId && { subjectId }),
    ...(institutionId && { institutionId }),
    ...(difficulty && { difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" }),
    ...(year && { year: Number(year) }),
    ...(topicIds.length > 0 && { topicIds, topicMatchMode }),
  };

  const { data, isLoading, error } = useGetApiV1Questions(params);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  function handleFilterChange<K extends keyof typeof filters>(
    key: K,
    value: (typeof filters)[K],
  ) {
    if (key === "subjectId") setSubjectId(value as string | null);
    else if (key === "institutionId") setInstitutionId(value as string | null);
    else if (key === "difficulty") setDifficulty(value as string | null);
    else if (key === "year") setYear(value as string | null);
    else if (key === "topicIds") setTopicIds(value as string[]);
    else if (key === "topicMatchMode") setTopicMatchMode(value as "any" | "all");
    setPage(1);
  }

  function handleClearFilters() {
    setSubjectId(null);
    setInstitutionId(null);
    setDifficulty(null);
    setYear(null);
    setTopicIds([]);
    setTopicMatchMode("any");
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="w-full shrink-0 lg:w-56">
        <FilterSidebar
          filters={filters}
          onFilterChange={handleFilterChange}
          onClear={handleClearFilters}
        />
      </div>

      <div className="flex-1 space-y-4">
        {data && (
          <p className="text-sm text-muted">
            {data.total} {data.total === 1 ? "questão" : "questões"} encontrada{data.total === 1 ? "" : "s"}
          </p>
        )}

        {isLoading && <QuestionListSkeleton />}

        {error && (
          <p className="text-sm text-danger">
            Erro ao carregar questões. Tente novamente.
          </p>
        )}

        {data && data.data.length === 0 && (
          <p className="py-12 text-center text-sm text-muted">
            Nenhuma questão encontrada com os filtros selecionados.
          </p>
        )}

        {data && data.data.length > 0 && (
          <div className="space-y-3">
            {data.data.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>
        )}

        <PaginationControl
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
