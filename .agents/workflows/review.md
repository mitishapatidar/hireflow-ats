# /review Workflow

When the user runs `/review` or asks for a code review:

1. **Inspect Git Changes**:
   - Run `git status` and `git diff` to review all modified, created, and staged files.

2. **Run Quality Checks**:
   - Run type checking: `npx tsc --noEmit`.
   - Run linter: `npm run lint`.
   - Run unit tests if present: `npm test`.

3. **Audit Against ATS Rules**:
   - **Authorization Check**: Are all new server actions/endpoints checking user session and role permissions?
   - **Data Exposure Check**: Are sensitive internal fields (candidate notes, margins, client fees) filtered out of client/candidate responses?
   - **Soft Delete Check**: Are any delete operations using hard deletion instead of `isArchived: true`?
   - **Input Validation**: Are forms and API requests strictly validated with Zod schemas?

4. **Output Report**:
   - Produce a structured summary categorized by severity:
     - 🔴 **Critical / Blocker** (Security flaws, broken auth, schema regressions)
     - 🟡 **Warning** (Missing validation, unbounded queries, untracked edge cases)
     - 🟢 **Passed** (Type checks, tests, formatting)
