# Claude Rules

## Language
- Always respond in English, even if the user writes in Portuguese.
- The HealthQuest UI (all labels, buttons, text, messages shown to users) must be in Portuguese.

## Styling
- Always use Tailwind CSS.
- Every UI component or page must support 3 themes: `light`, `dark`, and `code` (a dark theme with code-editor aesthetics, e.g. monospace fonts, syntax-highlight-inspired palette).

## Git Discipline
- Maintain an organized git history with professional commit standards.
- Follow Conventional Commits format: `type(scope): description` (e.g. `feat(auth): add JWT middleware`, `fix(questions): correct pagination offset`).
- Each commit should represent a single logical unit of work.
- Write commit messages in English.
- Never commit broken or half-finished code to main.

## Development Strategy
- Always use TDD (Test Driven Development). This is non-negotiable and paramount.
- Write failing tests first, then implement the minimum code to make them pass, then refactor.
- Never skip TDD — no implementation code without a preceding test.

## Pattern Documentation
- When a new pattern emerges in the codebase, document it in a **local CLAUDE.md** specific to that directory (e.g. `src/components/CLAUDE.md`, `packages/db/CLAUDE.md`).
- Before saving any pattern, summarize it and ask the user for confirmation on whether to save and where.
- Keep each local CLAUDE.md focused on rules and conventions relevant to that directory's domain.
