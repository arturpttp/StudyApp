# Seed Sources

Drop CSV files in this directory to add questions to the database.

## CSV format

```
externalId,institution,subject,year,difficulty,statement,a,b,c,d,e,correct,explanation
```

- Comma-separated, UTF-8, quote strings with `"` if they contain commas
- `year`: 4-digit year or empty string (for authored content)
- `difficulty`: EASY, MEDIUM, or HARD
- `correct`: a, b, c, d, or e
- All text in pt-BR
- `externalId` must be unique across all files

## Adding a new source

1. Create a `.csv` file in this directory following the format above
2. Run `pnpm --filter @healthquest/db seed`
3. The runner processes files in alphabetical order and upserts by `externalId`
