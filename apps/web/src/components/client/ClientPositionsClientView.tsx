'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { PageHeader } from '../layout/PageHeader';
import { ClientPositionDTO } from '@hireflow/shared';
import {
  Briefcase,
  MapPin,
  Users,
  Calendar,
  Search,
  Filter,
  X,
} from 'lucide-react';

interface Props {
  initialPositions: ClientPositionDTO[];
}

export function ClientPositionsClientView({ initialPositions }: Props) {
  const [positions] = useState<ClientPositionDTO[]>(initialPositions);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedJob, setSelectedJob] = useState<ClientPositionDTO | null>(null);

  const filtered = positions.filter((p) => {
    const matchesSearch =
      search.trim() === '' ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      (p.location && p.location.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Open Positions & Mandates"
        subtitle="Active engineering mandates and hiring requisitions serviced by HireFlow for your team."
        breadcrumbs={[{ label: 'Client Portal', href: '/portal' }, { label: 'Open Positions' }]}
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#6B7490] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, code, or location..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] placeholder-[#6B7490] outline-none focus:border-[#5B49D6]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-[#6B7490]" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] outline-none focus:border-[#5B49D6]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Mandates</option>
            <option value="PAUSED">Paused</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Positions List */}
      {filtered.length === 0 ? (
        <div className="p-12 bg-white rounded-xl border border-[#E6E8F0] text-center shadow-xs">
          <Briefcase className="w-10 h-10 text-[#6B7490]/40 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#1B2236]">No positions found</h3>
          <p className="text-xs text-[#6B7490] mt-1 max-w-sm mx-auto">
            {search ? 'Try clearing your search filters.' : 'There are currently no active job orders for this account.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((pos) => (
            <div
              key={pos.id}
              onClick={() => setSelectedJob(pos)}
              className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs hover:border-[#5B49D6] transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-sm text-[#1B2236] hover:text-[#5B49D6] transition-colors">
                    {pos.title}
                  </h3>
                  <span className="text-xs font-mono font-medium text-[#6B7490] bg-[#F6F7FB] px-1.5 py-0.5 rounded border border-[#E6E8F0]">
                    {pos.code}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      pos.status === 'ACTIVE'
                        ? 'bg-[#E3F6EC] text-[#12B76A]'
                        : 'bg-[#F6F7FB] text-[#6B7490]'
                    }`}
                  >
                    {pos.status}
                  </span>
                </div>

                <div className="text-xs text-[#6B7490] flex items-center gap-4 flex-wrap">
                  {pos.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{pos.location}</span>
                    </span>
                  )}
                  {pos.employmentType && <span>• {pos.employmentType.replace('_', ' ')}</span>}
                  <span>• {pos.openings} {pos.openings === 1 ? 'opening' : 'openings'}</span>
                  {pos.experienceMin !== null && (
                    <span>• {pos.experienceMin}+ yrs experience</span>
                  )}
                </div>

                {pos.descriptionSummary && (
                  <p className="text-xs text-[#6B7490] line-clamp-2 max-w-3xl pt-1">
                    {pos.descriptionSummary}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  {pos.requiredSkills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#F6F7FB] border border-[#E6E8F0] text-[#1B2236]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Metrics on the right */}
              <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 sm:border-l border-[#E6E8F0] pt-3 sm:pt-0 sm:pl-6 shrink-0 text-xs">
                <div className="flex items-center gap-1.5 text-[#1B2236]">
                  <Users className="w-4 h-4 text-[#5B49D6]" />
                  <span className="font-bold">{pos.candidatesSubmittedCount}</span>
                  <span className="text-[#6B7490]">submitted</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#1B2236]">
                  <Calendar className="w-4 h-4 text-[#F59E0B]" />
                  <span className="font-bold">{pos.interviewsActiveCount}</span>
                  <span className="text-[#6B7490]">interviews</span>
                </div>
                <button className="text-[11px] font-semibold text-[#5B49D6] hover:underline pt-1">
                  View Specifications →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Position Detail Slide-over Drawer */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-[#E6E8F0] pb-4">
              <div>
                <span className="text-xs font-mono font-medium text-[#6B7490]">{selectedJob.code}</span>
                <h2 className="text-lg font-bold text-[#1B2236] mt-0.5">{selectedJob.title}</h2>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1 rounded-lg text-[#6B7490] hover:bg-[#F6F7FB] hover:text-[#1B2236]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#F6F7FB] rounded-lg border border-[#E6E8F0]">
                <div className="text-[11px] text-[#6B7490] font-medium">Candidates Submitted</div>
                <div className="text-xl font-bold text-[#1B2236] mt-1">{selectedJob.candidatesSubmittedCount}</div>
              </div>
              <div className="p-3 bg-[#F6F7FB] rounded-lg border border-[#E6E8F0]">
                <div className="text-[11px] text-[#6B7490] font-medium">Active Interviews</div>
                <div className="text-xl font-bold text-[#5B49D6] mt-1">{selectedJob.interviewsActiveCount}</div>
              </div>
            </div>

            {/* Position Details */}
            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-[#1B2236] uppercase tracking-wider text-[11px] text-[#6B7490] mb-2">
                  Job Overview
                </h4>
                <div className="space-y-2 bg-[#F6F7FB] p-3.5 rounded-lg border border-[#E6E8F0]">
                  <div className="flex justify-between">
                    <span className="text-[#6B7490]">Location</span>
                    <span className="font-semibold text-[#1B2236]">{selectedJob.location || 'Remote'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7490]">Employment Type</span>
                    <span className="font-semibold text-[#1B2236]">{selectedJob.employmentType || 'Full-time'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7490]">Target Openings</span>
                    <span className="font-semibold text-[#1B2236]">{selectedJob.openings}</span>
                  </div>
                  {selectedJob.experienceMin !== null && (
                    <div className="flex justify-between">
                      <span className="text-[#6B7490]">Experience Required</span>
                      <span className="font-semibold text-[#1B2236]">{selectedJob.experienceMin}+ years</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-[#1B2236] uppercase tracking-wider text-[11px] text-[#6B7490] mb-2">
                  Required Competencies & Skills
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedJob.requiredSkills.map((s, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded bg-[#EEEBFB] text-[#5B49D6] font-semibold text-xs border border-[#5B49D6]/20"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {selectedJob.descriptionSummary && (
                <div>
                  <h4 className="font-bold text-[#1B2236] uppercase tracking-wider text-[11px] text-[#6B7490] mb-2">
                    Description & Deliverables
                  </h4>
                  <div className="bg-[#F6F7FB] p-4 rounded-lg border border-[#E6E8F0] whitespace-pre-wrap text-[#333F51] leading-relaxed">
                    {selectedJob.descriptionSummary}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#E6E8F0]">
              <button
                onClick={() => setSelectedJob(null)}
                className="w-full py-2.5 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
