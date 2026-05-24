"use client";

import { Button } from "@/components/ui/Button";

interface FinishExamDialogProps {
  open: boolean;
  unansweredCount: number;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FinishExamDialog({
  open,
  unansweredCount,
  isSubmitting,
  onConfirm,
  onCancel,
}: FinishExamDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-w-md w-full space-y-4 rounded-lg border border-border bg-surface p-6">
        <h3 className="text-lg font-semibold text-foreground">
          Finalizar simulado?
        </h3>
        {unansweredCount > 0 ? (
          <p className="text-sm text-muted">
            Você tem <strong>{unansweredCount}</strong>{" "}
            {unansweredCount === 1 ? "questão sem resposta" : "questões sem resposta"}
            . Elas contarão como erradas. Deseja finalizar mesmo assim?
          </p>
        ) : (
          <p className="text-sm text-muted">
            Todas as questões foram respondidas. Deseja finalizar?
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Finalizando..." : "Finalizar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
