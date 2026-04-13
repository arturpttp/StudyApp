import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let cached: string | null = null;

export async function GET(): Promise<Response> {
  if (!cached) {
    const filePath = resolve(process.cwd(), "openapi.json");
    cached = readFileSync(filePath, "utf-8");
  }

  return new Response(cached, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
