'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Building2, MapPin, Calendar } from 'lucide-react';

export default function CandidateApplicationsPage() {
  const applications = [
    {
      id: 'app-1',
      title: 'Staff Frontend Engineer',
      company: 'Acme Corporation',
      location: 'Bengaluru / Hybrid',
      appliedAt: 'Nov 01, 2026',
      stage: 'Technical Round',
      stageColor: 'bg-[#EEEBFB] text-[#5B49D6]',
    },
    {
      id: 'app-2',
      title: 'Engineering Lead - Core Platform',
      company: 'Starlight Tech',
      location: 'Remote',
      appliedAt: 'Oct 28, 2026',
      stage: 'Client Review',
      stageColor: 'bg-[#E5F0FF] text-[#3B82F6]',
    },
  ];

  return (
    <div>
      <PageHeader
        title="My Applications"
        subtitle="Track all positions you have applied to or been submitted for by your HireFlow recruiter."
        breadcrumbs={[{ label: 'Candidate Portal', href: '/my-dashboard' }, { label: 'Applications' }]}
      />

      <div className="space-y-4">
        {applications.map((app) => (
          <div
            key={app.id}
            className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[#1B2236]">{app.title}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${app.stageColor}`}>
                  {app.stage}
                </span>
              </div>
              <div className="text-xs text-[#6B7490] flex items-center gap-3 mt-1.5">
                <span className="flex items-center gap-1 font-semibold text-[#1B2236]">
                  <Building2 className="w-3.5 h-3.5 text-[#5B49D6]" />
                  <span>{app.company}</span>
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{app.location}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Applied on {app.appliedAt}</span>
                </span>
              </div>
            </div>

            <button
              onClick={() => alert('Application timeline modal arrives in Phase 1 (Prompt 8).')}
              className="text-xs text-[#5B49D6] hover:underline font-semibold"
            >
              View Timeline →
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-white rounded-xl border border-[#E6E8F0] text-center text-xs text-[#6B7490]">
        Applicant tracking status & direct communication with recruiters will be active in Phase 1 (Prompt 8).
      </div>
    </div>
  );
}
