export const SUBJECTS = [
  "Enfermagem",
  "Nutrição",
  "Psicologia",
  "Saúde Coletiva",
  "Medicina",
] as const;

export const INSTITUTIONS = [
  "HealthQuest",
  "VUNESP",
  "FGV",
  "FCC",
  "ENARE",
  "Revalida",
] as const;

export type SubjectName = (typeof SUBJECTS)[number];
export type InstitutionName = (typeof INSTITUTIONS)[number];

export const TOPICS = [
  "Anatomia",
  "Bioquímica",
  "Cardiologia",
  "Endocrinologia",
  "Ética",
  "Farmacologia",
  "Fisiologia",
  "Ginecologia",
  "Infectologia",
  "Microbiologia",
  "Neurologia",
  "Nutrição Clínica",
  "Obstetrícia",
  "Pediatria",
  "Pneumologia",
  "Psicopatologia",
  "Saúde Mental",
  "Saúde Pública",
  "Semiologia",
  "Sistema Único de Saúde",
] as const;

export type TopicName = (typeof TOPICS)[number];
