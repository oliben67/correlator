---
description: List registered users, optionally filtered by role or active status
argument-hint: [--role <role>] [--active-only]
---

List registered users. Full spec: `.criterion/CODE-OF-CONDUCT.md` §2/§4.
Input: $ARGUMENTS

1. Read `.criterion/IAM/users/users.json`. If it doesn't exist, say
   so rather than inventing users.
2. Apply `--role <role>` and/or `--active-only` filters if given.
3. Report the matching entries (name, roles, active status). If none
   match, say so rather than inventing matches.
