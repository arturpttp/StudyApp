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
