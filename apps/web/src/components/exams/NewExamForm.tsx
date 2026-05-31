"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePostApiV1ExamsGenerate } from "@/lib/api/generated/hooks/usePostApiV1ExamsGenerate";
import { useGetApiV1Topics } from "@/lib/api/generated/hooks/useGetApiV1Topics";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TopicMultiSelect } from "@/components/ui/TopicMultiSelect";

interface Subject {
  id: string;
  name: string;
}

interface NewExamFormProps {
  subjects: Subject[];
}

export function NewExamForm({ subjects }: NewExamFormProps) {
  const router = useRouter();
  const mutation = usePostApiV1ExamsGenerate();
  const { data: topics } = useGetApiV1Topics();

  const [subjectId, setSubjectId] = useState<string>("");
  const [difficulty, setDifficulty] = useState<"" | "EASY" | "MEDIUM" | "HARD">("");
  const [count, setCount] = useState<number>(10);
  const [timed, setTimed] = useState(false);
  const [timeLimit, setTimeLimit] = useState<number>(60);
  const [serverError, setServerError] = useState<string | null>(null);
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [topicMatchMode, setTopicMatchMode] = useState<"any" | "all">("any");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    mutation.mutate(
      {
        data: {
          subjectId: subjectId || undefined,
          difficulty: difficulty || undefined,
          count,
          timeLimit: timed ? timeLimit : null,
          topicIds: topicIds.length > 0 ? topicIds : undefined,
          topicMatchMode: topicIds.length > 1 ? topicMatchMode : undefined,
        },
      },
      {
        onSuccess: (data) => {
          router.push(`/exams/${data.id}`);
        },
        onError: async (err) => {
          const anyErr = err as { response?: Response };
          if (anyErr.response) {
            try {
              const body = await anyErr.response.clone().json();
              setServerError(body.error ?? "Erro ao gerar simulado.");
              return;
            } catch {}
          }
          setServerError("Erro ao gerar simulado.");
        },
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold text-foreground">Novo simulado</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm text-muted">Especialidade</span>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground cursor-pointer"
          >
            <option value="">Todas</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-muted">Dificuldade</span>
          <select
            value={difficulty}
            onChange={(e) =>
              setDifficulty(e.target.value as typeof difficulty)
            }
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground cursor-pointer"
          >
            <option value="">Qualquer</option>
            <option value="EASY">Fácil</option>
            <option value="MEDIUM">Médio</option>
            <option value="HARD">Difícil</option>
          </select>
        </label>

        <div className="md:col-span-2">
          <TopicMultiSelect
            topics={topics ?? []}
            selectedIds={topicIds}
            matchMode={topicMatchMode}
            onToggle={(id) =>
              setTopicIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
              )
            }
            onMatchModeChange={setTopicMatchMode}
          />
        </div>

        <label className="block space-y-1">
          <span className="text-sm text-muted">Quantidade (5–100)</span>
          <Input
            type="number"
            min={5}
            max={100}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={timed}
              onChange={(e) => setTimed(e.target.checked)}
              className="cursor-pointer"
            />
            Com tempo limitado
          </label>
          {timed && (
            <label className="block space-y-1">
              <span className="text-sm text-muted">Minutos (5–600)</span>
              <Input
                type="number"
                min={5}
                max={600}
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
              />
            </label>
          )}
        </div>
      </div>

      {serverError && <p className="text-sm text-danger">{serverError}</p>}

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Gerando..." : "Gerar simulado"}
      </Button>
    </form>
  );
}
