'use client';

import React from 'react';
import { PageHeader } from '../../../../components/layout/PageHeader';
import { Video } from 'lucide-react';

export default function ClientInterviewsPage() {
  const interviews = [
    {
      candidate: 'Aarav Shah',
      role: 'Senior Full Stack Engineer',
      interviewer: 'David Sterling (You)',
      time: 'Today, 2:30 PM IST',
      platform: 'Google Meet',
      link: 'https://meet.google.com/abc-defg-hij',
    },
    {
      candidate: 'Priya Sharma',
      role: 'DevOps Architect',
      interviewer: 'Rohan (Tech Lead)',
      time: 'Tomorrow, 11:00 AM IST',
      platform: 'Google Meet',
      link: 'https://meet.google.com/xyz-uvwx-rst',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Scheduled Client Interviews"
        subtitle="Manage upcoming technical rounds and candidate video interviews."
        breadcrumbs={[{ label: 'Client Portal', href: '/portal' }, { label: 'Interviews' }]}
      />

      <div className="space-y-4">
        {interviews.map((int, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[#1B2236]">{int.candidate}</h3>
                <span className="text-xs text-[#6B7490]">• {int.role}</span>
              </div>
              <div className="text-xs text-[#6B7490] mt-1 space-x-3">
                <span>Interviewer: <strong className="text-[#1B2236]">{int.interviewer}</strong></span>
                <span>• Time: <strong className="text-[#F59E0B]">{int.time}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={int.link}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Join Video Room</span>
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-white rounded-xl border border-[#E6E8F0] text-center text-xs text-[#6B7490]">
        Automated calendar sync & scorecards will be functional in Phase 3.
      </div>
    </div>
  );
}
