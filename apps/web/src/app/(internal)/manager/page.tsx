/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@hireflow/shared';
import { getManagerOverviewAction, getManagerTeamPerformanceAction } from '@/actions/manager';
import {
  Briefcase,
  Send,
  Users,
  Award,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export default async function ManagerOverviewPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) {
    redirect('/dashboard');
  }

  const [overviewRes, teamRes] = await Promise.all([
    getManagerOverviewAction(),
    getManagerTeamPerformanceAction(),
  ]);

  const kpis = (overviewRes.success && overviewRes.data?.kpis) ? overviewRes.data.kpis : {
    jobsAwaitingApproval: 0,
    submissionsAwaitingApproval: 0,
    activeRecruiters: 0,
    placementsThisMonth: 0,
    monthLabel: 'Current Month',
  };

  const pendingApprovals = overviewRes.success ? overviewRes.data?.pendingApprovals || [] : [];
  const recruiters = teamRes.success ? teamRes.data?.recruiters || [] : [];

  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E6E8F0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-wider text-[#5B49D6] uppercase bg-[#EEEBFB] px-2.5 py-0.5 rounded-full">
              Management Portal
            </span>
            <span className="text-xs text-[#6B7490]">{todayFormatted} (IST)</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1B2236] mt-1">
            Manager Overview — Welcome, {user.name}
          </h1>
          <p className="text-xs text-[#6B7490] mt-0.5">
            Operational sign-offs, recruiter productivity, and governance for Aureva Capital Private Limited.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/approvals"
            className="px-4 py-2 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
          >
            <span>Open Approval Center</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 4 Top KPI Cards (Figma Frame 13) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Submissions Awaiting Approval */}
        <Link
          href="/approvals?tab=submissions"
          className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs hover:border-[#5B49D6] transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7490]">Submissions to Approve</span>
            <div className="w-8 h-8 rounded-lg bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#1B2236]">{kpis.submissionsAwaitingApproval}</span>
            <span className="text-xs font-medium text-[#5B49D6]">Pending Review</span>
          </div>
          <div className="mt-2 text-[11px] text-[#6B7490] flex items-center justify-between">
            <span>Client presentations</span>
            <span className="text-[#5B49D6] group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-semibold">
              Review &rarr;
            </span>
          </div>
        </Link>

        {/* KPI 2: Jobs Awaiting Approval */}
        <Link
          href="/approvals?tab=jobs"
          className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs hover:border-[#F59E0B] transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7490]">Jobs to Approve</span>
            <div className="w-8 h-8 rounded-lg bg-[#FEF3DC] text-[#F59E0B] flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#1B2236]">{kpis.jobsAwaitingApproval}</span>
            <span className="text-xs font-medium text-[#F59E0B]">Sign-off Needed</span>
          </div>
          <div className="mt-2 text-[11px] text-[#6B7490] flex items-center justify-between">
            <span>New job mandates</span>
            <span className="text-[#F59E0B] group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-semibold">
              Review &rarr;
            </span>
          </div>
        </Link>

        {/* KPI 3: Active Recruiters */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7490]">Active Recruiters</span>
            <div className="w-8 h-8 rounded-lg bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#1B2236]">{kpis.activeRecruiters}</span>
            <span className="text-xs font-medium text-[#0284C7]">Reporting Line</span>
          </div>
          <div className="mt-2 text-[11px] text-[#6B7490]">
            <span>Active recruitment capacity</span>
          </div>
        </div>

        {/* KPI 4: Placements This Month */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7490]">Placements Closed</span>
            <div className="w-8 h-8 rounded-lg bg-[#E6F4EA] text-[#12B76A] flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#1B2236]">{kpis.placementsThisMonth}</span>
            <span className="text-xs font-medium text-[#12B76A]">{kpis.monthLabel}</span>
          </div>
          <div className="mt-2 text-[11px] text-[#6B7490]">
            <span>Achieved month-to-date</span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Pending Approvals Queue */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#E6E8F0] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#1B2236]">Priority Pending Sign-offs</h2>
            <p className="text-xs text-[#6B7490] mt-0.5">
              Candidate client submissions and job requisitions requiring immediate manager review.
            </p>
          </div>
          <Link
            href="/approvals"
            className="text-xs font-semibold text-[#5B49D6] hover:underline flex items-center gap-1"
          >
            <span>View All in Approval Center</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle2 className="w-10 h-10 text-[#12B76A] mx-auto mb-2 opacity-80" />
            <h3 className="text-sm font-bold text-[#1B2236]">Queue is Clear!</h3>
            <p className="text-xs text-[#6B7490] mt-1 max-w-sm mx-auto">
              No pending job requisitions or candidate submissions waiting for sign-off right now.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FC] text-[#6B7490] font-semibold border-b border-[#E6E8F0]">
                <tr>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Item & Candidate</th>
                  <th className="py-3 px-4">Client Company</th>
                  <th className="py-3 px-4">Submitted By</th>
                  <th className="py-3 px-4">Submitted At</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8F0]">
                {pendingApprovals.map((item: any) => (
                  <tr key={item.id} className="hover:bg-[#F8F9FC]/60 transition-colors">
                    <td className="py-3.5 px-4">
                      {item.type === 'SUBMISSION' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEEBFB] text-[#5B49D6]">
                          <Send className="w-2.5 h-2.5" />
                          <span>Submission</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3DC] text-[#F59E0B]">
                          <Briefcase className="w-2.5 h-2.5" />
                          <span>New Job</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#1B2236]">{item.title}</div>
                      <div className="text-[11px] text-[#6B7490] font-mono">{item.code}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#1B2236]">
                      {item.clientName}
                    </td>
                    <td className="py-3.5 px-4 text-[#6B7490]">
                      {item.submittedBy}
                    </td>
                    <td className="py-3.5 px-4 text-[#6B7490]">
                      {new Date(item.submittedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/approvals?tab=${item.type === 'SUBMISSION' ? 'submissions' : 'jobs'}&reviewId=${item.id}`}
                        className="px-3 py-1.5 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded text-xs font-semibold inline-flex items-center gap-1 shadow-2xs"
                      >
                        <span>Review</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Section: Team Performance Breakdown */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#E6E8F0] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#1B2236]">Recruiter Team Performance</h2>
            <p className="text-xs text-[#6B7490] mt-0.5">
              Live productivity metrics for recruiters within your management reporting line.
            </p>
          </div>
          <span className="text-xs font-medium text-[#6B7490]">
            {recruiters.length} Active Recruiters
          </span>
        </div>

        {recruiters.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6B7490]">
            No direct recruiter reports assigned under this profile.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FC] text-[#6B7490] font-semibold border-b border-[#E6E8F0]">
                <tr>
                  <th className="py-3 px-4">Recruiter</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4 text-center">Active Jobs</th>
                  <th className="py-3 px-4 text-center">Pipeline Candidates</th>
                  <th className="py-3 px-4 text-center">Interviews (Mo)</th>
                  <th className="py-3 px-4 text-center">Submissions (Mo)</th>
                  <th className="py-3 px-4 text-center">Placements (Mo)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8F0]">
                {recruiters.map((rec: any) => (
                  <tr key={rec.id} className="hover:bg-[#F8F9FC]/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-[#1B2236]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#5B49D6]/10 text-[#5B49D6] font-bold text-xs flex items-center justify-center">
                          {rec.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div>{rec.name}</div>
                          <div className="text-[10px] text-[#6B7490] font-normal">{rec.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#6B7490]">
                      {rec.teamName}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-[#1B2236]">
                      {rec.activeJobsCount}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-[#1B2236]">
                      {rec.pipelineCandidatesCount}
                    </td>
                    <td className="py-3.5 px-4 text-center text-[#6B7490]">
                      {rec.interviewsThisMonth}
                    </td>
                    <td className="py-3.5 px-4 text-center text-[#6B7490]">
                      {rec.submissionsThisMonth}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-[#12B76A]">
                      {rec.placementsThisMonth}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
