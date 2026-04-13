import { QuestionBrowser } from "@/components/questions/QuestionBrowser";

export default function QuestionsPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">
        Banco de Questões
      </h1>
      <QuestionBrowser />
    </section>
  );
}
