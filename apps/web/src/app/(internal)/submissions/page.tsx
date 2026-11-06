/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getSubmissionsAction } from '@/actions/submissions';
import { SubmissionsListClientView } from '@/components/submissions/SubmissionsListClientView';
import { UserRole } from '@hireflow/shared';
import Link from 'next/link';

export const metadata = {
  title: 'Client Submissions & Standard Profiles | HireFlow ATS',
};

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams?: { status?: string; search?: string; clientId?: string; page?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const allowedRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER];
  if (!allowedRoles.includes(user.role as any)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-600 font-medium">You do not have permission to view Client Submissions.</p>
        <Link href="/dashboard" className="text-blue-600 hover:underline text-sm">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const { data, pagination, stats, error } = await getSubmissionsAction({
    status: searchParams?.status,
    search: searchParams?.search,
    clientId: searchParams?.clientId,
    page: searchParams?.page ? parseInt(searchParams.page, 10) : 1,
    limit: 20,
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-600 font-medium">{error}</p>
        <Link href="/dashboard" className="text-blue-600 hover:underline text-sm">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <SubmissionsListClientView
      initialSubmissions={data}
      initialStats={stats}
      initialPagination={pagination}
      currentUser={{ id: user.id, name: user.name ?? 'Recruiter', role: user.role }}
    />
  );
}
