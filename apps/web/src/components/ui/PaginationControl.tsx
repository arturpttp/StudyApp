import { Button } from "./Button";

interface PaginationControlProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PaginationControl({
  page,
  totalPages,
  onPageChange,
}: PaginationControlProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-3 py-4" aria-label="Paginação">
      <Button
        variant="outline"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Página anterior"
      >
        ←
      </Button>
      <span className="text-sm text-muted">
        {page} / {totalPages}
      </span>
      <Button
        variant="outline"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Próxima página"
      >
        →
      </Button>
    </nav>
  );
}
