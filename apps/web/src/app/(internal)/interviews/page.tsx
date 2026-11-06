'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Clock, Video, User, Building2, Plus } from 'lucide-react';

export default function InterviewsPage() {
  const mockInterviews = [
    {
      id: 'int-1',
      candidate: 'Aarav Shah',
      job: 'Senior Full Stack Engineer',
      client: 'Acme Corp',
      interviewer: 'David Sterling (VP Eng)',
      round: 'Technical Deep-Dive',
      time: 'Today, 2:30 PM - 3:30 PM IST',
      platform: 'Google Meet',
    },
    {
      id: 'int-2',
      candidate: 'Priya Sharma',
      job: 'Engineering Manager',
      client: 'Starlight Tech',
      interviewer: 'Vikram Joshi (CTO)',
      round: 'Leadership & Culture Fit',
      time: 'Tomorrow, 11:00 AM - 12:00 PM IST',
      platform: 'Zoom',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Interviews & Scheduling"
        subtitle="Coordinate candidate interview rounds, interviewer calendars, and video links."
        breadcrumbs={[{ label: 'Interviews' }]}
        actions={
          <button
            onClick={() => alert('Interview scheduler modal arrives in Phase 1 (Prompt 8).')}
            className="px-3.5 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Interview</span>
          </button>
        }
      />

      <div className="space-y-4">
        {mockInterviews.map((int) => (
          <div
            key={int.id}
            className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#1B2236]">{int.candidate}</span>
                <span className="text-xs text-[#6B7490]">• {int.job}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EEEBFB] text-[#5B49D6]">
                  {int.round}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B7490]">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-[#5B49D6]" />
                  <span>{int.client}</span>
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  <span>{int.interviewer}</span>
                </span>
                <span className="flex items-center gap-1 text-[#1B2236] font-medium">
                  <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>{int.time}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-1 text-xs text-[#3B82F6] font-medium px-2.5 py-1 rounded bg-[#E5F0FF]">
                <Video className="w-3.5 h-3.5" />
                <span>{int.platform}</span>
              </span>
              <button
                onClick={() => alert('Interview feedback form arrives in Phase 1 (Prompt 8).')}
                className="px-3 py-1.5 bg-[#F6F7FB] border border-[#E6E8F0] hover:bg-[#EEEBFB] hover:text-[#5B49D6] rounded-lg text-xs font-semibold text-[#1B2236] transition-colors"
              >
                Log Feedback
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-white rounded-xl border border-[#E6E8F0] text-center text-xs text-[#6B7490]">
        Calendar sync & auto-generated video links will be functional in Phase 1 & 3.
      </div>
    </div>
  );
}
