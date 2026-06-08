"use client";

import { useRouter } from "next/navigation";
import { useDeleteApiV1FlashcardsId } from "@/lib/api/generated/hooks/useDeleteApiV1FlashcardsId";

interface DeleteFlashcardButtonProps {
  id: string;
}

export function DeleteFlashcardButton({ id }: DeleteFlashcardButtonProps) {
  const router = useRouter();
  const mutation = useDeleteApiV1FlashcardsId();

  function handleClick() {
    if (!window.confirm("Excluir este flashcard?")) return;
    mutation.mutate(
      { id },
      {
        onSuccess: () => router.refresh(),
      },
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={mutation.isPending}
      className="text-danger hover:underline cursor-pointer disabled:opacity-60"
    >
      {mutation.isPending ? "Excluindo..." : "Excluir"}
    </button>
  );
}
