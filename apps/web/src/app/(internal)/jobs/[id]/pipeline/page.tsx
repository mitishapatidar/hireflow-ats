import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getPipelineAction } from '@/actions/pipeline';
import { PipelineBoard } from '@/components/pipeline/PipelineBoard';
import { UserRole } from '@hireflow/shared';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps) {
  return { title: `Job Pipeline — ${params.id} | HireFlow` };
}

export default async function PipelinePage({ params }: PageProps) {
  const user = await getCurrentUser();

  if (!user) redirect('/login');

  const allowedRoles: string[] = [
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.RECRUITER,
  ];

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-600 font-medium">You do not have permission to view this pipeline.</p>
        <Link href="/jobs" className="text-blue-600 hover:underline text-sm">← Back to Jobs</Link>
      </div>
    );
  }

  const { header, columns, error } = await getPipelineAction(params.id);

  if (error === 'Job not found') notFound();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-600 font-medium">{error}</p>
        <Link href="/jobs" className="text-blue-600 hover:underline text-sm">← Back to Jobs</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/jobs/${params.id}`}
            className="text-gray-500 hover:text-gray-700 flex-shrink-0"
            aria-label="Back to Job"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-gray-900 truncate">{header.jobTitle}</h1>
              <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {header.jobCode}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  header.jobStatus === 'ACTIVE'
                    ? 'bg-green-100 text-green-700'
                    : header.jobStatus === 'PAUSED'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {header.jobStatus}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate">
              {header.clientName} · {header.totalApplications} candidates · {header.openings} positions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/jobs/${params.id}`}
            className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
          >
            Job Details
          </Link>
        </div>
      </div>

      {/* Board */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center flex-1 py-24">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        }
      >
        <PipelineBoard
          initialColumns={columns}
          header={header}
          jobId={params.id}
          currentUser={{ id: user.id, name: user.name ?? '', role: user.role }}
        />
      </Suspense>
    </div>
  );
}
