'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '../../../components/layout/PageHeader';
import {
  TrendingUp,
  Users,
  FileSpreadsheet,
  CalendarClock,
  ArrowRight,
  Shield,
  Layers,
  Award,
  Clock,
  CheckCircle2,
  FileCheck2,
  BarChart3,
  Calendar,
  Sparkles,
} from 'lucide-react';
import {
  getRecruitmentOverviewAction,
  getConversionFunnelAction,
  getRecruiterLeaderboardAction,
} from '../../../actions/analytics';
import { RecruitmentOverviewKPIs, RecruiterLeaderboardRow } from '@hireflow/shared';

export default function ReportsPage() {
  const [kpis, setKpis] = useState<RecruitmentOverviewKPIs | null>(null);
  const [funnel, setFunnel] = useState<{ stage: string; count: number; percentage: number }[]>([
    { stage: 'Candidates Sourced', count: 120, percentage: 100 },
    { stage: 'Submitted to Client', count: 65, percentage: 54 },
    { stage: 'Interview Scheduled', count: 38, percentage: 32 },
    { stage: 'Interview Cleared', count: 19, percentage: 16 },
    { stage: 'Offer Released', count: 12, percentage: 10 },
    { stage: 'Confirmed Placement', count: 8, percentage: 7 },
  ]);
  const [leaderboard, setLeaderboard] = useState<RecruiterLeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const [kpisRes, funnelRes, boardRes] = await Promise.all([
          getRecruitmentOverviewAction(),
          getConversionFunnelAction(),
          getRecruiterLeaderboardAction(),
        ]);
        setKpis(kpisRes);
        setFunnel(funnelRes);
        setLeaderboard(boardRes);
      } catch (err) {
        console.error('Failed to load recruitment analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agency Reports & Analytics"
        subtitle="End-to-end recruitment pipeline metrics, conversion velocity, recruiter leaderboards, and automated reports."
        breadcrumbs={[{ label: 'Reports' }]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/reports/mis"
              className="px-3.5 py-2 bg-white hover:bg-[#F6F7FB] text-[#1B2236] border border-[#E6E8F0] rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#5B49D6]" />
              <span>Manager MIS</span>
            </Link>
            <Link
              href="/reports/builder"
              className="px-3.5 py-2 bg-[#5B49D6] hover:bg-[#4a39b8] text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
              <span>Report Builder</span>
            </Link>
          </div>
        }
      />

      {/* 4 CORE EFFICIENCY KPIS (FRAME 10) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Time to Hire */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#6B7490] font-medium">Avg Time to Hire</span>
            <div className="w-8 h-8 rounded-lg bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">
            {kpis ? `${kpis.timeToHireDays} Days` : '24 Days'}
          </div>
          <div className="text-[11px] text-[#12B76A] mt-1 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>4 days faster than industry benchmark</span>
          </div>
        </div>

        {/* KPI 2: Submission to Interview */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#6B7490] font-medium">Submission-to-Interview</span>
            <div className="w-8 h-8 rounded-lg bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">
            {kpis ? `${kpis.submissionToInterviewRate}%` : '58.4%'}
          </div>
          <div className="text-[11px] text-[#0284C7] mt-1 font-semibold">
            {kpis?.submissionToInterviewDelta ? `${kpis.submissionToInterviewDelta.percentageChange > 0 ? '+' : ''}${kpis.submissionToInterviewDelta.percentageChange}% vs last month` : '+4.2% vs last month'}
          </div>
        </div>

        {/* KPI 3: Interview to Offer */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#6B7490] font-medium">Interview-to-Offer</span>
            <div className="w-8 h-8 rounded-lg bg-[#FEF3DC] text-[#D97706] flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">
            {kpis ? `${kpis.interviewToOfferRate}%` : '31.5%'}
          </div>
          <div className="text-[11px] text-[#D97706] mt-1 font-semibold">
            {kpis?.interviewToOfferDelta ? `${kpis.interviewToOfferDelta.percentageChange > 0 ? '+' : ''}${kpis.interviewToOfferDelta.percentageChange}% vs last month` : '+2.1% vs last month'}
          </div>
        </div>

        {/* KPI 4: Offer Acceptance Rate */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#6B7490] font-medium">Offer Acceptance Rate</span>
            <div className="w-8 h-8 rounded-lg bg-[#E3F6EC] text-[#12B76A] flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">
            {kpis ? `${kpis.offerAcceptanceRate}%` : '85.7%'}
          </div>
          <div className="text-[11px] text-[#12B76A] mt-1 font-semibold">
            {kpis?.offerAcceptanceDelta ? `${kpis.offerAcceptanceDelta.percentageChange > 0 ? '+' : ''}${kpis.offerAcceptanceDelta.percentageChange}% vs last month` : '+5.4% vs last month'}
          </div>
        </div>
      </div>

      {/* CONVERSION FUNNEL (FRAME 10) */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-sm text-[#1B2236]">Recruitment Conversion Funnel</h3>
            <p className="text-xs text-[#6B7490]">Stage-by-stage drop-off velocity across active pipelines</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#6B7490]">
            Current Month (IST)
          </span>
        </div>

        <div className="space-y-3">
          {funnel.map((step, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[#1B2236]">{step.stage}</span>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-[#1B2236]">{step.count} Candidates</span>
                  <span className="text-[11px] text-[#6B7490] w-12 text-right">{step.percentage}%</span>
                </div>
              </div>
              <div className="w-full bg-[#F6F7FB] h-3 rounded-full overflow-hidden border border-[#E6E8F0]">
                <div
                  className="bg-gradient-to-r from-[#5B49D6] to-[#7B68EE] h-full rounded-full transition-all duration-500"
                  style={{ width: `${step.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RECRUITER LEADERBOARD TABLE (FRAME 10) */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E6E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#5B49D6]" />
            <h3 className="font-bold text-sm text-[#1B2236]">Recruiter Leaderboard</h3>
          </div>
          <span className="text-xs text-[#6B7490]">Ranked by confirmed placements</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F7FB] text-[#6B7490] font-semibold uppercase tracking-wider border-b border-[#E6E8F0]">
              <tr>
                <th className="px-5 py-3">Rank</th>
                <th className="px-5 py-3">Recruiter</th>
                <th className="px-5 py-3 text-center">Sourced</th>
                <th className="px-5 py-3 text-center">Submissions</th>
                <th className="px-5 py-3 text-center">Interviews</th>
                <th className="px-5 py-3 text-center">Offers</th>
                <th className="px-5 py-3 text-center">Placements</th>
                <th className="px-5 py-3 text-center">Conversion</th>
                <th className="px-5 py-3 text-right">Target Attainment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8F0] text-[#1B2236]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-[#6B7490]">
                    Loading leaderboard...
                  </td>
                </tr>
              ) : leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-[#6B7490]">
                    No recruiter metrics recorded for this period.
                  </td>
                </tr>
              ) : (
                leaderboard.map((r, idx) => (
                  <tr key={r.recruiterId} className="hover:bg-[#F6F7FB]/70 transition-colors">
                    <td className="px-5 py-3 font-bold text-[#5B49D6]">
                      #{idx + 1}
                    </td>
                    <td className="px-5 py-3 font-semibold text-[#1B2236]">
                      {r.recruiterName}
                      <span className="block text-[11px] text-[#6B7490] font-normal">{r.email}</span>
                    </td>
                    <td className="px-5 py-3 text-center text-[#6B7490]">{r.candidatesSourced}</td>
                    <td className="px-5 py-3 text-center text-[#6B7490]">{r.submissionsSent}</td>
                    <td className="px-5 py-3 text-center text-[#6B7490]">{r.interviewsCompleted}</td>
                    <td className="px-5 py-3 text-center text-[#6B7490]">{r.offersReleased}</td>
                    <td className="px-5 py-3 text-center font-bold text-[#12B76A]">{r.confirmedPlacements}</td>
                    <td className="px-5 py-3 text-center font-semibold text-[#1B2236]">
                      {r.conversionRatePercentage}%
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 bg-[#F6F7FB] h-2 rounded-full overflow-hidden border border-[#E6E8F0]">
                          <div
                            className={`h-full rounded-full ${
                              r.targetAttainmentPercentage >= 100
                                ? 'bg-[#12B76A]'
                                : r.targetAttainmentPercentage >= 50
                                ? 'bg-[#5B49D6]'
                                : 'bg-[#F59E0B]'
                            }`}
                            style={{ width: `${Math.min(r.targetAttainmentPercentage, 100)}%` }}
                          />
                        </div>
                        <span className="font-semibold text-[11px] text-[#1B2236] w-9 text-right">
                          {r.targetAttainmentPercentage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODULE NAVIGATION CARDS (FRAME 37 & FRAME 38) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Module A: Custom Report Builder */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs flex flex-col justify-between hover:border-[#5B49D6]/40 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#1B2236]">Custom Report Builder</h3>
            <p className="text-xs text-[#6B7490] mt-1.5 leading-relaxed">
              Design tailored cross-entity datasets across Candidates, Jobs, Submissions, Interviews, and Placements.
              Filter by date and stage, inspect live previews with IST timestamps, and export directly to CSV or Excel.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[#6B7490]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F6F7FB] border border-[#E6E8F0]">
                <Layers className="w-3 h-3 text-[#5B49D6]" /> Cross-Entity Joins
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F6F7FB] border border-[#E6E8F0]">
                <Shield className="w-3 h-3 text-[#12B76A]" /> Zero Data Leak
              </span>
            </div>
          </div>
          <div className="pt-6 border-t border-[#E6E8F0] mt-6">
            <Link
              href="/reports/builder"
              className="text-xs font-bold text-[#5B49D6] hover:text-[#4a39b8] flex items-center gap-1.5 group"
            >
              <span>Launch Report Builder</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Module B: Scheduled Client Reports */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs flex flex-col justify-between hover:border-[#5B49D6]/40 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center mb-3">
              <CalendarClock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#1B2236]">Scheduled Client Reports</h3>
            <p className="text-xs text-[#6B7490] mt-1.5 leading-relaxed">
              Set up automated Daily, Weekly, or Monthly recruitment status emails for verified client contacts.
              Features 13-point delivery-time authorization rechecks, content allow-lists, and BullMQ idempotent scheduling.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[#6B7490]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F6F7FB] border border-[#E6E8F0]">
                <Users className="w-3 h-3 text-[#5B49D6]" /> Verified Contacts Only
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F6F7FB] border border-[#E6E8F0]">
                <CalendarClock className="w-3 h-3 text-[#5B49D6]" /> Repeatable Delivery
              </span>
            </div>
          </div>
          <div className="pt-6 border-t border-[#E6E8F0] mt-6">
            <Link
              href="/reports/client-schedules"
              className="text-xs font-bold text-[#5B49D6] hover:text-[#4a39b8] flex items-center gap-1.5 group"
            >
              <span>Manage Client Schedules</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
