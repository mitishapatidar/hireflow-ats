'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Plus, Building2, MapPin, Users, DollarSign } from 'lucide-react';

export default function JobsPage() {
  const mockJobs = [
    { id: '1', title: 'Senior Full Stack Engineer', client: 'Acme Corp', location: 'Remote / Bengaluru', salary: '₹28L - ₹35L', candidatesCount: 14, status: 'Open', statusColor: 'bg-[#E3F6EC] text-[#12B76A]' },
    { id: '2', title: 'Engineering Manager - Cloud', client: 'Starlight Tech', location: 'Mumbai', salary: '₹45L - ₹55L', candidatesCount: 8, status: 'Open', statusColor: 'bg-[#E3F6EC] text-[#12B76A]' },
    { id: '3', title: 'Principal Data Scientist', client: 'FinServe Global', location: 'Hyderabad', salary: '₹40L - ₹50L', candidatesCount: 6, status: 'Draft', statusColor: 'bg-[#FEF3DC] text-[#F59E0B]' },
  ];

  return (
    <div>
      <PageHeader
        title="Job Mandates & Openings"
        subtitle="Manage open requisitions, client job orders, and pipeline stages."
        breadcrumbs={[{ label: 'Jobs' }]}
        actions={
          <button
            onClick={() => alert('Job creation wizard arrives in Phase 1 (Prompt 7).')}
            className="px-3.5 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Job</span>
          </button>
        }
      />

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {mockJobs.map((job) => (
          <div
            key={job.id}
            className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs hover:border-[#5B49D6]/50 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${job.statusColor}`}>
                  {job.status}
                </span>
                <span className="text-[11px] text-[#6B7490] flex items-center gap-1">
                  <Users className="w-3 h-3 text-[#5B49D6]" />
                  <span>{job.candidatesCount} in pipeline</span>
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#1B2236] leading-snug">{job.title}</h3>
              <div className="text-xs text-[#6B7490] flex items-center gap-1.5 mt-1.5 font-medium">
                <Building2 className="w-3.5 h-3.5 text-[#5B49D6]" />
                <span>{job.client}</span>
              </div>
              <div className="text-xs text-[#6B7490] flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{job.location}</span>
              </div>
              <div className="text-xs text-[#12B76A] font-semibold flex items-center gap-1.5 mt-1">
                <DollarSign className="w-3.5 h-3.5" />
                <span>{job.salary}</span>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-[#E6E8F0] flex items-center justify-between">
              <span className="text-[11px] text-[#6B7490]">Requisition #{job.id}</span>
              <button
                onClick={() => alert(`Opening pipeline for ${job.title}. Kanban pipeline arrives in Phase 1 (Prompt 8).`)}
                className="text-xs text-[#5B49D6] hover:underline font-semibold"
              >
                View Pipeline →
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-white rounded-xl border border-[#E6E8F0] text-center text-xs text-[#6B7490]">
        Job orders, client assignments, and pipeline configurations will be functional in Phase 1 (Prompt 7).
      </div>
    </div>
  );
}
