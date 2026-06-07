"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePostApiV1AdminQuestions } from "@/lib/api/generated/hooks/usePostApiV1AdminQuestions";
import { useGetApiV1Topics } from "@/lib/api/generated/hooks/useGetApiV1Topics";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TopicCombobox } from "@/components/admin/TopicCombobox";

interface Option {
  id: string;
  name: string;
}

interface NewQuestionFormProps {
  subjects: Option[];
  institutions: Option[];
}

type Difficulty = "EASY" | "MEDIUM" | "HARD";

const EMPTY_ALT = { text: "", isCorrect: false };

export function NewQuestionForm({ subjects, institutions }: NewQuestionFormProps) {
  const router = useRouter();
  const { data: topics } = useGetApiV1Topics();
  const mutation = usePostApiV1AdminQuestions();

  const [statement, setStatement] = useState("");
  const [explanation, setExplanation] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [year, setYear] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [institutionId, setInstitutionId] = useState<string>(
    institutions[0]?.id ?? "",
  );
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [newTopicNames, setNewTopicNames] = useState<string[]>([]);
  const [alternatives, setAlternatives] = useState([
    { ...EMPTY_ALT },
    { ...EMPTY_ALT },
    { ...EMPTY_ALT },
    { ...EMPTY_ALT },
  ]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);

  function updateAlt(idx: number, text: string) {
    setAlternatives((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, text } : a)),
    );
  }

  function addAlt() {
    if (alternatives.length < 6) {
      setAlternatives((prev) => [...prev, { ...EMPTY_ALT }]);
    }
  }

  function removeAlt(idx: number) {
    if (alternatives.length <= 2) return;
    setAlternatives((prev) => prev.filter((_, i) => i !== idx));
    if (correctIndex === idx) setCorrectIndex(0);
    else if (correctIndex > idx) setCorrectIndex((c) => c - 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    mutation.mutate(
      {
        data: {
          statement,
          explanation: explanation || undefined,
          difficulty,
          year: year ? Number(year) : undefined,
          subjectId: subjectId || undefined,
          institutionId,
          topicIds,
          newTopicNames,
          alternatives: alternatives.map((a, i) => ({
            text: a.text,
            isCorrect: i === correctIndex,
            position: i,
          })),
        },
      },
      {
        onSuccess: (data) => {
          router.push(`/questions/${data.id}`);
        },
        onError: async (err) => {
          const anyErr = err as { response?: Response };
          if (anyErr.response) {
            try {
              const body = await anyErr.response.clone().json();
              setServerError(body.error ?? "Erro ao criar pergunta.");
              return;
            } catch {}
          }
          setServerError("Erro ao criar pergunta.");
        },
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-6 space-y-4"
    >
      <label className="block space-y-1">
        <span className="text-sm text-muted">Enunciado</span>
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          rows={4}
          required
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-muted">Explicação (opcional)</span>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={3}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm text-muted">Dificuldade</span>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground cursor-pointer"
          >
            <option value="EASY">Fácil</option>
            <option value="MEDIUM">Médio</option>
            <option value="HARD">Difícil</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Ano (opcional)</span>
          <Input
            type="number"
            min={1900}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Especialidade (opcional)</span>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground cursor-pointer"
          >
            <option value="">—</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Instituição</span>
          <select
            value={institutionId}
            onChange={(e) => setInstitutionId(e.target.value)}
            required
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground cursor-pointer"
          >
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-1">
        <span className="text-sm text-muted">Matérias</span>
        <TopicCombobox
          topics={topics ?? []}
          selectedIds={topicIds}
          newNames={newTopicNames}
          onAddExisting={(id) => setTopicIds((p) => [...p, id])}
          onRemoveExisting={(id) =>
            setTopicIds((p) => p.filter((x) => x !== id))
          }
          onAddNew={(name) => setNewTopicNames((p) => [...p, name])}
          onRemoveNew={(name) =>
            setNewTopicNames((p) => p.filter((x) => x !== name))
          }
        />
      </div>

      <div className="space-y-2">
        <span className="text-sm text-muted">Alternativas (marque a correta)</span>
        {alternatives.map((alt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct"
              checked={correctIndex === idx}
              onChange={() => setCorrectIndex(idx)}
              className="cursor-pointer"
            />
            <Input
              type="text"
              value={alt.text}
              onChange={(e) => updateAlt(idx, e.target.value)}
              required
              className="flex-1"
            />
            {alternatives.length > 2 && (
              <button
                type="button"
                onClick={() => removeAlt(idx)}
                className="text-xs text-muted hover:text-danger cursor-pointer"
              >
                Remover
              </button>
            )}
          </div>
        ))}
        {alternatives.length < 6 && (
          <button
            type="button"
            onClick={addAlt}
            className="text-xs text-accent hover:underline cursor-pointer"
          >
            + Adicionar alternativa
          </button>
        )}
      </div>

      {serverError && <p className="text-sm text-danger">{serverError}</p>}

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Criando..." : "Criar pergunta"}
      </Button>
    </form>
  );
}
