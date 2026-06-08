"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePostApiV1Flashcards } from "@/lib/api/generated/hooks/usePostApiV1Flashcards";
import { usePatchApiV1FlashcardsId } from "@/lib/api/generated/hooks/usePatchApiV1FlashcardsId";
import { useGetApiV1Topics } from "@/lib/api/generated/hooks/useGetApiV1Topics";
import { Button } from "@/components/ui/Button";
import { TopicMultiSelect } from "@/components/ui/TopicMultiSelect";

interface FlashcardEditorProps {
  mode: "create" | "edit";
  initial?: {
    id?: string;
    front: string;
    back: string;
    topicIds: string[];
    questionId?: string | null;
  };
}

export function FlashcardEditor({ mode, initial }: FlashcardEditorProps) {
  const router = useRouter();
  const { data: topics } = useGetApiV1Topics();
  const createMutation = usePostApiV1Flashcards();
  const updateMutation = usePatchApiV1FlashcardsId();

  const [front, setFront] = useState(initial?.front ?? "");
  const [back, setBack] = useState(initial?.back ?? "");
  const [topicIds, setTopicIds] = useState<string[]>(initial?.topicIds ?? []);
  const [serverError, setServerError] = useState<string | null>(null);

  const questionId = initial?.questionId ?? undefined;
  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (mode === "create") {
      createMutation.mutate(
        {
          data: {
            front,
            back,
            topicIds,
            questionId: questionId ?? undefined,
          },
        },
        {
          onSuccess: () => router.push("/flashcards"),
          onError: async (err) => {
            const anyErr = err as { response?: Response };
            if (anyErr.response) {
              try {
                const body = await anyErr.response.clone().json();
                setServerError(body.error ?? "Erro ao criar flashcard.");
                return;
              } catch {}
            }
            setServerError("Erro ao criar flashcard.");
          },
        },
      );
    } else {
      if (!initial?.id) return;
      updateMutation.mutate(
        { id: initial.id, data: { front, back, topicIds } },
        {
          onSuccess: () => router.push("/flashcards"),
          onError: () => setServerError("Erro ao atualizar flashcard."),
        },
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-6 space-y-4"
    >
      <label className="block space-y-1">
        <span className="text-sm text-muted">Frente</span>
        <textarea
          value={front}
          onChange={(e) => setFront(e.target.value)}
          rows={4}
          required
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-muted">Verso</span>
        <textarea
          value={back}
          onChange={(e) => setBack(e.target.value)}
          rows={4}
          required
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>

      <div className="space-y-1">
        <span className="text-sm text-muted">Matérias (opcional)</span>
        <TopicMultiSelect
          topics={topics ?? []}
          selectedIds={topicIds}
          matchMode="any"
          onToggle={(id) =>
            setTopicIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            )
          }
          onMatchModeChange={() => {}}
          label=""
        />
      </div>

      {serverError && <p className="text-sm text-danger">{serverError}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending
          ? "Salvando..."
          : mode === "create"
            ? "Criar flashcard"
            : "Salvar alterações"}
      </Button>
    </form>
  );
}
