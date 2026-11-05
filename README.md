# HireFlow — ATS & Recruitment CRM

Production-grade, modular monorepo for the HireFlow Applicant Tracking System and Recruitment CRM.

## Monorepo Structure

```
apps/
  web/       # Next.js 14 App Router (port 3000)
  api/       # Fastify + TypeScript API Server (port 4000)
packages/
  db/        # Prisma ORM + PostgreSQL client
  shared/    # Shared Zod schemas, types, and role definitions
  ui/        # Shared design tokens and UI components
```

## 5-Command Local Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment file
cp .env.example .env

# 3. Start PostgreSQL and Redis containers
docker compose up -d

# 4. Generate Prisma client
pnpm --filter @hireflow/db prisma:generate

# 5. Start development servers (Web on :3000, API on :4000)
pnpm dev
```

## Health Verification
- **Web App:** [http://localhost:3000](http://localhost:3000)
- **API Health Check:** [http://localhost:4000/health](http://localhost:4000/health)

## Project Scripts
- `pnpm dev`: Start both Web and API in watch mode
- `pnpm build`: Build all workspace packages and apps
- `pnpm test`: Run unit tests across workspace with Vitest
- `pnpm lint`: Run linting checks across workspace
