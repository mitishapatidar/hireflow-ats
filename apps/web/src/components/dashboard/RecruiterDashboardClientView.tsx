'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useTransition } from 'react';
import { PageHeader } from '../layout/PageHeader';
import {
  Users,
  Briefcase,
  Calendar,
  Award,
  ArrowUpRight,
  Plus,
  RefreshCw,
  Clock,
  Building2,
  CalendarCheck2,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { getRecruiterDashboardAction } from '@/actions/dashboard';

interface RecruiterDashboardClientViewProps {
  initialData: any;
}

export function RecruiterDashboardClientView({ initialData }: RecruiterDashboardClientViewProps) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      const res = await getRecruiterDashboardAction();
      if (res.success && res.data) {
        setData(res.data);
      }
    });
  };

  const kpis = data?.kpiCards || {};
  const activeJobs = kpis.activeJobs || { value: 0, delta: '0 vs last month' };
  const candidates = kpis.candidates || { value: 0, delta: '0 vs last month' };
  const interviewsThisWeek = kpis.interviewsThisWeek || { value: 0, delta: '0 vs last week' };
  const placementsThisMonth = kpis.placementsThisMonth || { value: 0, delta: '0 vs last month' };

  const getDeltaText = (delta: any, fallback = '0 vs last month'): string => {
    if (!delta) return fallback;
    if (typeof delta === 'string') return delta;
    if (typeof delta === 'object' && typeof delta.displayText === 'string') return delta.displayText;
    return fallback;
  };

  const pipelineStages = data?.pipelineDistribution?.stages || [];
  const totalApplications = data?.pipelineDistribution?.totalApplications || 0;
  const todayAgenda = data?.todayAgenda || [];
  const recentActivity = data?.recentActivity || [];
  const asOfTimestamp = data?.asOfTimestamp || 'Live Database Sync';

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={`Recruiter Overview`}
        subtitle={`Aureva Capital Private Limited • Live metrics across active mandates and pipeline.`}
        breadcrumbs={[{ label: 'Dashboard' }]}
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#F4F5FA] border border-[#E6E8F0] text-xs font-medium text-[#4A5568]">
              <Clock className="w-3.5 h-3.5 text-[#5B49D6]" />
              {asOfTimestamp}
            </span>
            <button
              onClick={handleRefresh}
              disabled={isPending}
              className="px-3 py-2 border border-[#E6E8F0] bg-white text-[#1B2236] rounded-lg text-xs font-semibold hover:bg-[#F9FAFB] transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/candidates"
              className="px-3.5 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Candidate</span>
            </Link>
          </div>
        }
      />

      {/* 4 Real Database KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Active Jobs */}
        <div className="bg-white rounded-xl p-5 border border-[#E6E8F0] shadow-xs flex flex-col justify-between hover:border-[#CBD5E1] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7490] uppercase tracking-wider">Active Jobs</span>
            <div className="p-2.5 rounded-lg bg-[#EEF2FF] text-[#4F46E5]">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-[#1B2236] tracking-tight">{activeJobs.value}</div>
            <div className="text-xs text-[#12B76A] mt-1.5 font-medium flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{getDeltaText(activeJobs.delta)}</span>
            </div>
          </div>
        </div>

        {/* 2. Total Candidates */}
        <div className="bg-white rounded-xl p-5 border border-[#E6E8F0] shadow-xs flex flex-col justify-between hover:border-[#CBD5E1] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7490] uppercase tracking-wider">Candidates Pool</span>
            <div className="p-2.5 rounded-lg bg-[#EEEBFB] text-[#5B49D6]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-[#1B2236] tracking-tight">{candidates.value}</div>
            <div className="text-xs text-[#12B76A] mt-1.5 font-medium flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{getDeltaText(candidates.delta)}</span>
            </div>
          </div>
        </div>

        {/* 3. Interviews This Week */}
        <div className="bg-white rounded-xl p-5 border border-[#E6E8F0] shadow-xs flex flex-col justify-between hover:border-[#CBD5E1] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7490] uppercase tracking-wider">Interviews This Week</span>
            <div className="p-2.5 rounded-lg bg-[#FEF3C7] text-[#D97706]">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-[#1B2236] tracking-tight">{interviewsThisWeek.value}</div>
            <div className="text-xs text-[#4A5568] mt-1.5 font-medium flex items-center gap-1">
              <CalendarCheck2 className="w-3.5 h-3.5 text-[#D97706]" />
              <span>{getDeltaText(interviewsThisWeek.delta, '0 vs last week')}</span>
            </div>
          </div>
        </div>

        {/* 4. Placements This Month */}
        <div className="bg-white rounded-xl p-5 border border-[#E6E8F0] shadow-xs flex flex-col justify-between hover:border-[#CBD5E1] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7490] uppercase tracking-wider">Placements This Month</span>
            <div className="p-2.5 rounded-lg bg-[#ECFDF5] text-[#059669]">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-[#1B2236] tracking-tight">{placementsThisMonth.value}</div>
            <div className="text-xs text-[#059669] mt-1.5 font-medium flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{getDeltaText(placementsThisMonth.delta)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Pipeline Chart + Today's Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Hiring Pipeline Distribution */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0]">
              <div>
                <h2 className="text-base font-bold text-[#1B2236]">Hiring Pipeline Distribution</h2>
                <p className="text-xs text-[#6B7490] mt-0.5">
                  Total {totalApplications} active applications tracked across stages
                </p>
              </div>
              <Link
                href="/jobs"
                className="text-xs font-semibold text-[#5B49D6] hover:underline flex items-center gap-1"
              >
                <span>View Job Pipelines</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Stage Progress Bars */}
            <div className="mt-6 space-y-4">
              {pipelineStages.map((st: any) => (
                <div key={st.stage} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#1B2236]">{st.displayName}</span>
                    <span className="text-[#6B7490] font-medium">
                      {st.count} candidate{st.count === 1 ? '' : 's'} ({st.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-[#F1F3F9] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(st.percentage, st.count > 0 ? 3 : 0)}%`,
                        backgroundColor: st.colorHex || '#5B49D6',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Candidate Activity */}
          <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0]">
              <div>
                <h2 className="text-base font-bold text-[#1B2236]">Recent Candidate Activity</h2>
                <p className="text-xs text-[#6B7490] mt-0.5">Live audit events across candidate workflows</p>
              </div>
              <span className="text-xs font-semibold text-[#5B49D6] bg-[#EEEBFB] px-2.5 py-1 rounded-full">
                Audit Feed
              </span>
            </div>

            <div className="mt-4 divide-y divide-[#F1F3F9]">
              {recentActivity.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#6B7490]">
                  No recent candidate activity recorded yet.
                </div>
              ) : (
                recentActivity.map((act: any) => (
                  <div key={act.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#EEEBFB] text-[#5B49D6] font-bold text-xs flex items-center justify-center">
                        {act.recordTitle?.charAt(0) || 'C'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#1B2236]">{act.recordTitle}</div>
                        <div className="text-xs text-[#6B7490] mt-0.5">{act.action}</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-[#94A3B8] whitespace-nowrap">
                      {act.timeAgo}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Today's Agenda (IST) */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0]">
              <div>
                <h2 className="text-base font-bold text-[#1B2236]">Today&apos;s Agenda</h2>
                <p className="text-xs text-[#6B7490] mt-0.5">Scheduled in Indian Standard Time (IST)</p>
              </div>
              <Link
                href="/interviews"
                className="text-xs font-semibold text-[#5B49D6] hover:underline flex items-center gap-1"
              >
                <span>Calendar</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {todayAgenda.length === 0 ? (
                <div className="py-12 text-center">
                  <Calendar className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                  <p className="text-xs font-semibold text-[#1B2236]">No events scheduled today</p>
                  <p className="text-xs text-[#6B7490] mt-1">Your schedule is open for sourcing & outreach.</p>
                </div>
              ) : (
                todayAgenda.map((item: any) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-lg border border-[#E6E8F0] bg-[#FAFAFC] hover:border-[#CBD5E1] transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#5B49D6] bg-[#EEEBFB] px-2 py-0.5 rounded">
                        {item.timeIST}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-white border border-[#E2E8F0] text-[#475569]">
                        {item.eventType.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#1B2236]">{item.title}</div>
                      <div className="text-xs text-[#6B7490] mt-0.5 flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-[#94A3B8]" />
                        <span>{item.counterpartName}</span>
                      </div>
                      <div className="text-xs text-[#94A3B8] mt-0.5 flex items-center gap-1.5">
                        <Building2 className="w-3 h-3" />
                        <span>{item.relatedJobOrMandate}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Navigation Cards */}
          <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7490]">Recruiter Shortcuts</h3>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/activity"
                className="p-3 rounded-lg border border-[#E6E8F0] hover:bg-[#F9FAFB] hover:border-[#5B49D6]/40 transition-all flex flex-col gap-1 text-center items-center justify-center"
              >
                <Clock className="w-4 h-4 text-[#5B49D6]" />
                <span className="text-xs font-semibold text-[#1B2236]">Daily Activity</span>
              </Link>
              <Link
                href="/sales"
                className="p-3 rounded-lg border border-[#E6E8F0] hover:bg-[#F9FAFB] hover:border-[#5B49D6]/40 transition-all flex flex-col gap-1 text-center items-center justify-center"
              >
                <Briefcase className="w-4 h-4 text-[#3B82F6]" />
                <span className="text-xs font-semibold text-[#1B2236]">Sales CRM</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
