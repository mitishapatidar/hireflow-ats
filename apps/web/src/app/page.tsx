import { CheckCircle2, Server, Database, Layers } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-page-bg">
      <div className="w-full max-w-xl rounded-card bg-card p-8 border border-border shadow-sm">
        {/* Brand Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="h-10 w-10 rounded-input bg-primary flex items-center justify-center text-white font-bold text-xl">
            H
          </div>
          <div>
            <h1 className="text-xl font-bold text-text">HireFlow ATS</h1>
            <p className="text-xs text-muted">Foundation Monorepo Ready</p>
          </div>
          <span className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-pill text-xs font-medium bg-primary-soft text-primary">
            Phase 0
          </span>
        </div>

        {/* Status Confirmation Card */}
        <div className="rounded-input border border-border p-4 bg-page-bg/50 mb-6 space-y-3">
          <div className="flex items-center space-x-2 text-sm text-text font-medium">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span>Frontend Application Online (Next.js 14 App Router)</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-muted">
            <Server className="w-4 h-4 text-primary" />
            <span>API Gateway: Fastify on port 4000</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-muted">
            <Database className="w-4 h-4 text-info" />
            <span>Database: PostgreSQL + Prisma ORM</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-muted">
            <Layers className="w-4 h-4 text-warning" />
            <span>Shared Packages: @hireflow/shared, @hireflow/ui, @hireflow/db</span>
          </div>
        </div>

        {/* Design System Verification Box */}
        <div className="border-t border-border pt-4 text-xs text-muted flex items-center justify-between">
          <span>Design Tokens: Primary #5B49D6 • Navy #1E2A4A</span>
          <span className="text-text font-medium">Ready for Prompt 2</span>
        </div>
      </div>
    </main>
  );
}
