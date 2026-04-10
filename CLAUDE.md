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
