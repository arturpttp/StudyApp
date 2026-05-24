"use client";

import { AlternativeRow } from "@/components/questions/AlternativeRow";
import { positionToLetter } from "@/lib/question-utils";

interface Alternative {
  id: string;
  text: string;
  position: number;
}

interface ExamQuestionPanelProps {
  statement: string;
  alternatives: Alternative[];
  selectedAlternativeId: string | null;
  onSelect: (alternativeId: string) => void;
}

export function ExamQuestionPanel({
  statement,
  alternatives,
  selectedAlternativeId,
  onSelect,
}: ExamQuestionPanelProps) {
  return (
    <div className="space-y-4">
      <p className="text-foreground whitespace-pre-wrap">{statement}</p>
      <div className="space-y-2">
        {alternatives.map((alt) => (
          <AlternativeRow
            key={alt.id}
            alternative={alt}
            letter={positionToLetter(alt.position)}
            isSelected={selectedAlternativeId === alt.id}
            isEliminated={false}
            phase="exam-active"
            result={null}
            onSelect={onSelect}
            onToggleEliminate={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
