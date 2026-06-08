interface TopicAccuracyListProps {
  items: Array<{
    topicId: string;
    topicName: string;
    answered: number;
    correct: number;
    accuracy: number;
  }>;
}

export function TopicAccuracyList({ items }: TopicAccuracyListProps) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
      {items.map((t) => (
        <li
          key={t.topicId}
          className="flex items-center justify-between px-4 py-2 text-sm"
        >
          <span className="text-foreground">{t.topicName}</span>
          <span className="text-muted">
            {t.correct} de {t.answered} · {t.accuracy}%
          </span>
        </li>
      ))}
    </ul>
  );
}
