'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import Link from 'next/link';
import { PageHeader } from '../layout/PageHeader';
import { ClientPortalOverviewDTO } from '@hireflow/shared';
import {
  Briefcase,
  Users,
  Calendar,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface Props {
  initialData: ClientPortalOverviewDTO | null;
  error?: string | null;
}

export function ClientPortalOverviewClientView({ initialData, error }: Props) {
  if (error) {
    return (
      <div className="p-8 bg-white rounded-xl border border-[#E6E8F0] text-center shadow-xs">
        <AlertCircle className="w-10 h-10 text-[#E5484D] mx-auto mb-3" />
        <h3 className="text-base font-bold text-[#1B2236]">Unable to load Client Portal</h3>
        <p className="text-xs text-[#6B7490] mt-1 max-w-md mx-auto">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const data = initialData || {
    asOf: 'Just now',
    clientLegalName: 'Your Organization',
    clientContactName: 'Client Contact',
    metrics: { openPositions: 0, profilesSubmitted: 0, interviewsScheduled: 0 },
    recentSubmissions: [],
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={`Welcome back, ${data.clientContactName}`}
        subtitle={`Client Portal for ${data.clientLegalName} — Review standardized candidate submissions, manage interviews, and track active positions.`}
        breadcrumbs={[{ label: 'Client Portal', href: '/portal' }, { label: 'Overview' }]}
        actions={
          <div className="flex items-center gap-2 text-xs text-[#6B7490] bg-white px-3 py-1.5 rounded-lg border border-[#E6E8F0]">
            <Clock className="w-3.5 h-3.5 text-[#5B49D6]" />
            <span>{data.asOf}</span>
          </div>
        }
      />

      {/* Live Statistic Cards (Figma Frame 12) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: Open Positions */}
        <Link
          href="/positions"
          className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs hover:border-[#5B49D6] transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7490]">Open Positions</span>
            <div className="w-8 h-8 rounded-lg bg-[#EEEBFB] flex items-center justify-center text-[#5B49D6] group-hover:bg-[#5B49D6] group-hover:text-white transition-colors">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">
            {data.metrics.openPositions} Active
          </div>
          <div className="text-xs text-[#5B49D6] mt-1 font-medium flex items-center gap-1">
            <span>View active requisitions</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Card 2: Profiles Submitted */}
        <Link
          href="/submitted-profiles"
          className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs hover:border-[#5B49D6] transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7490]">Profiles Submitted</span>
            <div className="w-8 h-8 rounded-lg bg-[#E3F6EC] flex items-center justify-center text-[#12B76A] group-hover:bg-[#12B76A] group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">
            {data.metrics.profilesSubmitted} Profiles
          </div>
          <div className="text-xs text-[#12B76A] mt-1 font-medium flex items-center gap-1">
            <span>Approved by talent team</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Card 3: Scheduled Interviews */}
        <Link
          href="/portal/interviews"
          className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs hover:border-[#5B49D6] transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7490]">Interviews Scheduled</span>
            <div className="w-8 h-8 rounded-lg bg-[#FEF3DC] flex items-center justify-center text-[#F59E0B] group-hover:bg-[#F59E0B] group-hover:text-white transition-colors">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">
            {data.metrics.interviewsScheduled} Upcoming
          </div>
          <div className="text-xs text-[#F59E0B] mt-1 font-medium flex items-center gap-1">
            <span>Technical & client rounds</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Recent Submitted Profiles (Figma Frame 12) */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#E6E8F0] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-[#1B2236]">Recent Submitted Profiles</h3>
            <p className="text-xs text-[#6B7490] mt-0.5">
              Standardized, anonymized candidate profiles submitted for your review.
            </p>
          </div>
          <Link
            href="/submitted-profiles"
            className="text-xs font-semibold text-[#5B49D6] hover:text-[#5B49D6]/80 flex items-center gap-1"
          >
            <span>View All Profiles</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {data.recentSubmissions.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6B7490]">
            <FileText className="w-8 h-8 text-[#6B7490]/40 mx-auto mb-2" />
            <p className="font-medium text-[#1B2236]">No submitted profiles yet</p>
            <p className="mt-1">
              When your dedicated HireFlow talent team submits approved candidates, they will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E6E8F0]">
            {data.recentSubmissions.map((sub) => {
              const isShortlisted = sub.clientDecision === 'SHORTLISTED';
              const isRejected = sub.clientDecision === 'REJECTED';
              const isNeedDetails = sub.clientDecision === 'NEED_DETAILS';

              return (
                <div
                  key={sub.id}
                  className="p-5 hover:bg-[#F6F7FB]/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#1B2236]">{sub.candidateName}</span>
                      <span className="text-xs font-mono font-medium text-[#6B7490] bg-[#F6F7FB] px-1.5 py-0.5 rounded border border-[#E6E8F0]">
                        {sub.candidateCode}
                      </span>
                      <span className="text-xs font-semibold text-[#5B49D6]">
                        • {sub.jobTitle} ({sub.jobCode})
                      </span>
                    </div>
                    <div className="text-xs text-[#6B7490]">{sub.experienceSummary}</div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {sub.skills.slice(0, 4).map((skill, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#F6F7FB] border border-[#E6E8F0] text-[#1B2236]"
                        >
                          {skill}
                        </span>
                      ))}
                      {sub.skills.length > 4 && (
                        <span className="text-[10px] text-[#6B7490]">+{sub.skills.length - 4} more</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Status Badge */}
                    {isShortlisted && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E3F6EC] text-[#12B76A]">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Shortlisted</span>
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEE2E2] text-[#E5484D]">
                        <AlertCircle className="w-3 h-3" />
                        <span>Rejected</span>
                      </span>
                    )}
                    {isNeedDetails && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEF3DC] text-[#F59E0B]">
                        <Clock className="w-3 h-3" />
                        <span>Details Requested</span>
                      </span>
                    )}
                    {!sub.clientDecision && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EEEBFB] text-[#5B49D6]">
                        <Clock className="w-3 h-3" />
                        <span>Awaiting Review</span>
                      </span>
                    )}

                    {/* Review Button */}
                    <Link
                      href={`/portal/submissions/${sub.id}`}
                      className="px-3.5 py-2 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Review Profile</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Access Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center mb-3">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-[#1B2236] mb-1">Standardized Candidate Profiles</h3>
          <p className="text-xs text-[#6B7490] leading-relaxed mb-4">
            Candidate CVs vetted by HireFlow with confidential salary terms redacted. Download watermarked CVs and request interview rounds directly.
          </p>
          <Link
            href="/submitted-profiles"
            className="text-xs font-semibold text-[#5B49D6] hover:text-[#5B49D6]/80 flex items-center gap-1"
          >
            <span>Review candidate pool</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#E3F6EC] text-[#12B76A] flex items-center justify-center mb-3">
            <Building2 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-[#1B2236] mb-1">Active Job Mandates</h3>
          <p className="text-xs text-[#6B7490] leading-relaxed mb-4">
            Track hiring velocity, open requisition counts, and candidate pipeline distribution across all your authorized engineering mandates.
          </p>
          <Link
            href="/positions"
            className="text-xs font-semibold text-[#12B76A] hover:text-[#12B76A]/80 flex items-center gap-1"
          >
            <span>View open mandates</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
