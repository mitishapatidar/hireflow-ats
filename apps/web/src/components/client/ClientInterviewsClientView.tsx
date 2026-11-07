'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { PageHeader } from '../layout/PageHeader';
import { ClientInterviewDTO } from '@hireflow/shared';
import {
  Calendar,
  Clock,
  Video,
  Phone,
  ExternalLink,
  CheckCircle2,
  Users,
} from 'lucide-react';

interface Props {
  initialInterviews: ClientInterviewDTO[];
}

export function ClientInterviewsClientView({ initialInterviews }: Props) {
  const [interviews] = useState<ClientInterviewDTO[]>(initialInterviews);
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'COMPLETED' | 'ALL'>('UPCOMING');

  const now = new Date();

  const filtered = interviews.filter((int) => {
    const isPast = new Date(int.scheduledAt) < now;
    if (activeTab === 'UPCOMING') return !isPast && int.status === 'SCHEDULED';
    if (activeTab === 'COMPLETED') return isPast || int.status === 'COMPLETED';
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduled Client Interviews"
        subtitle="Review upcoming candidate technical evaluations, video panels, and client rounds in Asia/Kolkata (IST)."
        breadcrumbs={[{ label: 'Client Portal', href: '/portal' }, { label: 'Interviews' }]}
      />

      {/* Tabs */}
      <div className="flex border-b border-[#E6E8F0] bg-white rounded-t-xl px-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('UPCOMING')}
          className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'UPCOMING'
              ? 'border-[#5B49D6] text-[#5B49D6]'
              : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Upcoming Interviews</span>
        </button>
        <button
          onClick={() => setActiveTab('COMPLETED')}
          className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'COMPLETED'
              ? 'border-[#5B49D6] text-[#5B49D6]'
              : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Completed Rounds</span>
        </button>
        <button
          onClick={() => setActiveTab('ALL')}
          className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'ALL'
              ? 'border-[#5B49D6] text-[#5B49D6]'
              : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>All ({interviews.length})</span>
        </button>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="p-12 bg-white rounded-b-xl border border-t-0 border-[#E6E8F0] text-center shadow-xs">
          <Calendar className="w-10 h-10 text-[#6B7490]/40 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#1B2236]">No scheduled interviews</h3>
          <p className="text-xs text-[#6B7490] mt-1 max-w-sm mx-auto">
            When candidates are shortlisted for client interviews, calendar appointments and video links will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((int) => (
            <div
              key={int.id}
              className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#5B49D6] transition-all"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-[#1B2236]">{int.candidateName}</span>
                  <span className="text-xs font-mono font-medium text-[#6B7490] bg-[#F6F7FB] px-1.5 py-0.5 rounded border border-[#E6E8F0]">
                    {int.candidateCode}
                  </span>
                  <span className="text-xs font-semibold text-[#5B49D6]">
                    • {int.jobTitle} ({int.jobCode})
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EEEBFB] text-[#5B49D6]">
                    {int.roundName}
                  </span>
                </div>

                <div className="text-xs text-[#6B7490] flex items-center gap-4 flex-wrap">
                  <span className="font-semibold text-[#1B2236] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#5B49D6]" />
                    <span>{int.scheduledAtIST}</span>
                  </span>
                  <span>• Duration: {int.duration} mins</span>
                  <span className="flex items-center gap-1">
                    {int.mode.toLowerCase().includes('phone') ? (
                      <Phone className="w-3.5 h-3.5" />
                    ) : (
                      <Video className="w-3.5 h-3.5" />
                    )}
                    <span>{int.mode}</span>
                  </span>
                </div>

                {int.participants.length > 0 && (
                  <div className="text-[11px] text-[#6B7490] flex items-center gap-1.5 pt-1">
                    <Users className="w-3.5 h-3.5 text-[#6B7490]" />
                    <span>Interview Panel: <strong>{int.participants.join(', ')}</strong></span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {int.meetingLink ? (
                  <a
                    href={int.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Join Meeting</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-xs text-[#6B7490] bg-[#F6F7FB] px-3 py-1.5 rounded-lg border border-[#E6E8F0]">
                    Link provided before interview
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
