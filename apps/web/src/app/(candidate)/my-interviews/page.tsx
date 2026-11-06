'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Clock, Video } from 'lucide-react';

export default function CandidateInterviewsPage() {
  const interviews = [
    {
      id: 'int-1',
      round: 'Technical Architecture Deep-Dive',
      company: 'Acme Corporation',
      role: 'Staff Frontend Engineer',
      interviewer: 'David Sterling (VP of Engineering)',
      time: 'Tomorrow, Nov 07, 11:00 AM - 12:00 PM IST',
      platform: 'Google Meet',
      link: 'https://meet.google.com/sample-meet-link',
      status: 'Confirmed',
    },
  ];

  return (
    <div>
      <PageHeader
        title="My Interviews"
        subtitle="Upcoming interview slots, video meeting coordinates, and preparation details."
        breadcrumbs={[{ label: 'Candidate Portal', href: '/my-dashboard' }, { label: 'Interviews' }]}
      />

      <div className="space-y-4">
        {interviews.map((int) => (
          <div
            key={int.id}
            className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[#1B2236]">{int.round}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E3F6EC] text-[#12B76A]">
                  {int.status}
                </span>
              </div>
              <div className="text-xs text-[#6B7490] mt-1 space-x-3">
                <span>Company: <strong className="text-[#1B2236]">{int.company}</strong></span>
                <span>• Role: <strong className="text-[#1B2236]">{int.role}</strong></span>
                <span>• Interviewer: <strong className="text-[#1B2236]">{int.interviewer}</strong></span>
              </div>
              <div className="text-xs text-[#F59E0B] font-semibold flex items-center gap-1.5 mt-2">
                <Clock className="w-3.5 h-3.5" />
                <span>{int.time}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <a
                href={int.link}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Join Video Meeting</span>
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-white rounded-xl border border-[#E6E8F0] text-center text-xs text-[#6B7490]">
        Self-service slot rescheduling & calendar sync will be active in Phase 3.
      </div>
    </div>
  );
}
