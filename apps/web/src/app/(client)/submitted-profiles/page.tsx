'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Check, X, FileText } from 'lucide-react';

export default function ClientSubmittedProfilesPage() {
  const submittedCandidates = [
    {
      id: 'sub-1',
      name: 'Aarav Shah',
      position: 'Senior Full Stack Engineer',
      experience: '8 Years (React, Node, Postgres)',
      noticePeriod: '15 Days',
      expectedCTC: '₹32,00,000 / yr',
      status: 'Awaiting Decision',
    },
    {
      id: 'sub-2',
      name: 'Priya Sharma',
      position: 'DevOps Architect',
      experience: '11 Years (AWS, Kubernetes, Terraform)',
      noticePeriod: 'Immediate',
      expectedCTC: '₹40,00,000 / yr',
      status: 'Interview Scheduled',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Submitted Candidate Profiles"
        subtitle="Review anonymized candidate CVs, schedule interviews, or provide rejection feedback."
        breadcrumbs={[{ label: 'Client Portal', href: '/portal' }, { label: 'Submitted Profiles' }]}
      />

      <div className="space-y-4">
        {submittedCandidates.map((c) => (
          <div
            key={c.id}
            className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[#1B2236]">{c.name}</h3>
                <span className="text-xs text-[#6B7490]">• {c.position}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EEEBFB] text-[#5B49D6]">
                  {c.status}
                </span>
              </div>
              <div className="text-xs text-[#6B7490] mt-1 space-x-3">
                <span>Experience: <strong className="text-[#1B2236]">{c.experience}</strong></span>
                <span>• Notice: <strong className="text-[#1B2236]">{c.noticePeriod}</strong></span>
                <span>• Expected: <strong className="text-[#12B76A]">{c.expectedCTC}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => alert(`Reviewing resume for ${c.name}. Profile viewer arrives in Phase 1 (Prompt 8).`)}
                className="px-3 py-1.5 bg-[#F6F7FB] border border-[#E6E8F0] hover:bg-[#EEEBFB] text-xs font-semibold text-[#1B2236] rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-[#5B49D6]" />
                <span>View CV</span>
              </button>
              <button
                onClick={() => alert('Approve candidate for interview round (Phase 1, Prompt 8).')}
                className="px-3.5 py-1.5 bg-[#12B76A] hover:bg-[#12B76A]/90 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Shortlist & Schedule</span>
              </button>
              <button
                onClick={() => alert('Reject candidate with feedback reason (Phase 1, Prompt 8).')}
                className="px-3 py-1.5 bg-[#FDECEC] hover:bg-[#FDECEC]/80 text-[#E5484D] text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-white rounded-xl border border-[#E6E8F0] text-center text-xs text-[#6B7490]">
        Data privacy protected: Internal agency margins and recruiter notes are never visible in Client Portal.
      </div>
    </div>
  );
}
