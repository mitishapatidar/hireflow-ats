'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { PageHeader } from '../layout/PageHeader';
import { ClientProgressReportDTO } from '@hireflow/shared';
import { Clock } from 'lucide-react';

interface Props {
  initialReport: ClientProgressReportDTO;
}

export function ClientReportsClientView({ initialReport }: Props) {
  const sum = initialReport.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Hiring Progress & Velocity"
        subtitle="Transparent candidate pipeline progression, review turnaround velocity, and placement milestones."
        breadcrumbs={[{ label: 'Client Portal', href: '/portal' }, { label: 'Progress Reports' }]}
        actions={
          <div className="text-xs text-[#6B7490] bg-white px-3 py-1.5 rounded-lg border border-[#E6E8F0] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#5B49D6]" />
            <span>{initialReport.asOf}</span>
          </div>
        }
      />

      {/* Summary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-[#6B7490]">Open Positions</div>
          <div className="text-xl font-bold text-[#1B2236] mt-1">{sum.openPositions}</div>
          <div className="text-[10px] text-[#5B49D6] mt-0.5 font-medium">Active requisitions</div>
        </div>

        <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-[#6B7490]">Profiles Submitted</div>
          <div className="text-xl font-bold text-[#1B2236] mt-1">{sum.profilesSubmitted}</div>
          <div className="text-[10px] text-[#12B76A] mt-0.5 font-medium">Approved by team</div>
        </div>

        <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-[#6B7490]">Pending Review</div>
          <div className="text-xl font-bold text-[#F59E0B] mt-1">{sum.pendingReview}</div>
          <div className="text-[10px] text-[#F59E0B] mt-0.5 font-medium">Awaiting decision</div>
        </div>

        <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-[#6B7490]">Shortlisted</div>
          <div className="text-xl font-bold text-[#12B76A] mt-1">{sum.shortlisted}</div>
          <div className="text-[10px] text-[#12B76A] mt-0.5 font-medium">Approved by client</div>
        </div>

        <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-[#6B7490]">Interviews</div>
          <div className="text-xl font-bold text-[#5B49D6] mt-1">
            {sum.interviewsScheduled + sum.interviewsCompleted}
          </div>
          <div className="text-[10px] text-[#5B49D6] mt-0.5 font-medium">Scheduled & done</div>
        </div>

        <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-[#6B7490]">Positions Filled</div>
          <div className="text-xl font-bold text-[#12B76A] mt-1">{sum.positionsFilled}</div>
          <div className="text-[10px] text-[#12B76A] mt-0.5 font-medium">Successful hires</div>
        </div>
      </div>

      {/* Job-wise Progress Table */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#E6E8F0]">
          <h3 className="font-bold text-base text-[#1B2236]">Job-by-Job Mandate Pipeline</h3>
          <p className="text-xs text-[#6B7490] mt-0.5">
            Recruitment funnel progression across each authorized position.
          </p>
        </div>

        {initialReport.jobProgress.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6B7490]">No active jobs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F7FB] text-[#6B7490] font-semibold uppercase tracking-wider border-b border-[#E6E8F0]">
                <tr>
                  <th className="px-5 py-3">Position</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-center">Submitted</th>
                  <th className="px-5 py-3 text-center">Pending Review</th>
                  <th className="px-5 py-3 text-center">Shortlisted</th>
                  <th className="px-5 py-3 text-center">Interviewed</th>
                  <th className="px-5 py-3 text-center">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8F0] text-[#1B2236]">
                {initialReport.jobProgress.map((jp) => (
                  <tr key={jp.jobId} className="hover:bg-[#F6F7FB]/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-[#1B2236]">{jp.jobTitle}</div>
                      <div className="text-[11px] font-mono text-[#6B7490]">{jp.jobCode}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          jp.status === 'ACTIVE'
                            ? 'bg-[#E3F6EC] text-[#12B76A]'
                            : 'bg-[#F6F7FB] text-[#6B7490]'
                        }`}
                      >
                        {jp.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center font-semibold text-[#1B2236]">
                      {jp.profilesSubmitted}
                    </td>
                    <td className="px-5 py-3.5 text-center font-bold text-[#F59E0B]">
                      {jp.pendingReview}
                    </td>
                    <td className="px-5 py-3.5 text-center font-bold text-[#12B76A]">
                      {jp.shortlisted}
                    </td>
                    <td className="px-5 py-3.5 text-center font-semibold text-[#5B49D6]">
                      {jp.interviewed}
                    </td>
                    <td className="px-5 py-3.5 text-center font-bold text-[#12B76A]">
                      {jp.filled}
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
