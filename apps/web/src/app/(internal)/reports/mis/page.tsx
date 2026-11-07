'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '../../../../components/layout/PageHeader';
import {
  TrendingUp,
  Award,
  Clock,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Users,
  Target,
  Sparkles,
  BarChart3,
  Building,
  RefreshCw,
} from 'lucide-react';
import { getManagerMisAction } from '../../../../actions/analytics';
import { ManagerMisData } from '@hireflow/shared';

export default function ManagerMisPage() {
  const [data, setData] = useState<ManagerMisData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getManagerMisAction();
      setData(res);
    } catch (err) {
      console.error('Failed to load MIS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recruiter Daily Activity & Manager MIS"
        subtitle="Operational activity tracking, daily actuals vs agency targets, and MTD cohort attainment."
        breadcrumbs={[
          { label: 'Reports', href: '/reports' },
          { label: 'Manager MIS' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="px-3 py-2 bg-white hover:bg-[#F6F7FB] text-[#1B2236] border border-[#E6E8F0] rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#5B49D6] ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh MIS</span>
            </button>
            <Link
              href="/reports"
              className="px-3.5 py-2 bg-[#5B49D6] hover:bg-[#4a39b8] text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-white" />
              <span>Back to Reports</span>
            </Link>
          </div>
        }
      />

      {/* IST METRICS TIMESTAMP BANNER */}
      <div className="p-3 bg-[#EEEBFB] border border-[#D7D0F8] rounded-xl flex items-center justify-between text-xs text-[#5B49D6]">
        <div className="flex items-center gap-2 font-medium">
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            Cohort reporting period: <strong>{data?.periodLabel || 'Current Month'}</strong> • Computed as of{' '}
            <strong>{data?.asOfTimestamp || 'Just now'}</strong>
          </span>
        </div>
        <span className="text-[11px] font-semibold bg-white px-2 py-0.5 rounded shadow-xs">
          IST Boundaries Enforced
        </span>
      </div>

      {/* 6 TEAM ROLLUP CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-3.5 shadow-xs">
          <div className="text-[11px] text-[#6B7490] font-medium">Total Sourced</div>
          <div className="text-xl font-bold text-[#1B2236] mt-1">{data?.teamSourcedTotal ?? 0}</div>
          <div className="text-[10px] text-[#5B49D6] mt-0.5 font-medium">Active pool</div>
        </div>

        <div className="bg-white rounded-xl border border-[#E6E8F0] p-3.5 shadow-xs">
          <div className="text-[11px] text-[#6B7490] font-medium">Submissions</div>
          <div className="text-xl font-bold text-[#1B2236] mt-1">{data?.teamSubmissionsTotal ?? 0}</div>
          <div className="text-[10px] text-[#0284C7] mt-0.5 font-medium">Sent to clients</div>
        </div>

        <div className="bg-white rounded-xl border border-[#E6E8F0] p-3.5 shadow-xs">
          <div className="text-[11px] text-[#6B7490] font-medium">Interviews</div>
          <div className="text-xl font-bold text-[#1B2236] mt-1">{data?.teamInterviewsTotal ?? 0}</div>
          <div className="text-[10px] text-[#D97706] mt-0.5 font-medium">Rounds conducted</div>
        </div>

        <div className="bg-white rounded-xl border border-[#E6E8F0] p-3.5 shadow-xs">
          <div className="text-[11px] text-[#6B7490] font-medium">Offers Released</div>
          <div className="text-xl font-bold text-[#1B2236] mt-1">{data?.teamOffersTotal ?? 0}</div>
          <div className="text-[10px] text-[#7B68EE] mt-0.5 font-medium">Candidate offers</div>
        </div>

        <div className="bg-white rounded-xl border border-[#E6E8F0] p-3.5 shadow-xs">
          <div className="text-[11px] text-[#6B7490] font-medium">Placements</div>
          <div className="text-xl font-bold text-[#12B76A] mt-1">{data?.teamPlacementsTotal ?? 0}</div>
          <div className="text-[10px] text-[#12B76A] mt-0.5 font-medium">Joined candidates</div>
        </div>

        <div className="bg-white rounded-xl border border-[#E6E8F0] p-3.5 shadow-xs">
          <div className="text-[11px] text-[#6B7490] font-medium">Total Agency Fee</div>
          <div className="text-xl font-bold text-[#1B2236] mt-1">
            ₹{((data?.teamFeeTotal ?? 0) / 100000).toFixed(1)}L
          </div>
          <div className="text-[10px] text-[#12B76A] mt-0.5 font-medium">Commercial book</div>
        </div>
      </div>

      {/* RECRUITER PERFORMANCE BREAKDOWN TABLE */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E6E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#5B49D6]" />
            <h3 className="font-bold text-sm text-[#1B2236]">Recruiter Actuals vs Target Attainment</h3>
          </div>
          <span className="text-xs text-[#6B7490]">Target: 2 Confirmed Placements / Recruiter / Month</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F7FB] text-[#6B7490] font-semibold uppercase tracking-wider border-b border-[#E6E8F0]">
              <tr>
                <th className="px-5 py-3">Recruiter</th>
                <th className="px-5 py-3 text-center">Sourced</th>
                <th className="px-5 py-3 text-center">Submissions</th>
                <th className="px-5 py-3 text-center">Interviews</th>
                <th className="px-5 py-3 text-center">Offers Released</th>
                <th className="px-5 py-3 text-center">Offers Accepted</th>
                <th className="px-5 py-3 text-center">Placements</th>
                <th className="px-5 py-3 text-center">Conversion %</th>
                <th className="px-5 py-3 text-right">Target Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8F0] text-[#1B2236]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-[#6B7490]">
                    Loading MIS reports...
                  </td>
                </tr>
              ) : !data?.recruiters || data.recruiters.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-[#6B7490]">
                    No recruiter performance records found.
                  </td>
                </tr>
              ) : (
                data.recruiters.map((r) => (
                  <tr key={r.recruiterId} className="hover:bg-[#F6F7FB]/70 transition-colors">
                    <td className="px-5 py-3 font-semibold text-[#1B2236]">
                      {r.recruiterName}
                      <span className="block text-[11px] text-[#6B7490] font-normal">{r.email}</span>
                    </td>
                    <td className="px-5 py-3 text-center text-[#6B7490]">{r.candidatesSourced}</td>
                    <td className="px-5 py-3 text-center text-[#6B7490]">{r.submissionsSent}</td>
                    <td className="px-5 py-3 text-center text-[#6B7490]">{r.interviewsCompleted}</td>
                    <td className="px-5 py-3 text-center text-[#6B7490]">{r.offersReleased}</td>
                    <td className="px-5 py-3 text-center text-[#6B7490]">{r.offersAccepted}</td>
                    <td className="px-5 py-3 text-center font-bold text-[#12B76A]">{r.confirmedPlacements}</td>
                    <td className="px-5 py-3 text-center font-semibold text-[#1B2236]">
                      {r.conversionRatePercentage}%
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-[#F6F7FB] h-2 rounded-full overflow-hidden border border-[#E6E8F0]">
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
    </div>
  );
}
