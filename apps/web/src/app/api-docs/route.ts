import { ApiReference } from "@scalar/nextjs-api-reference";

export const GET = ApiReference({
  url: "/api/v1/openapi.json",
  darkMode: true,
  metaData: {
    title: "HealthQuest API",
    description: "Documentação interativa da API HealthQuest",
  },
});
