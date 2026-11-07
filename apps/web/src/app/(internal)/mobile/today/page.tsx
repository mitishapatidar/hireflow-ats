'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Video,
  Phone,
  FileCheck2,
  AlertCircle,
  Plus,
  Share2,
  FileText,
  User,
  Building,
  Briefcase,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { getRecruiterTodayAction, MobileTodayAgenda } from '../../../../actions/mobile';

export default function MobileTodayPage() {
  const [agenda, setAgenda] = useState<MobileTodayAgenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  useEffect(() => {
    async function loadToday() {
      try {
        const res = await getRecruiterTodayAction();
        setAgenda(res);
      } catch (err) {
        console.error('Failed to load mobile agenda:', err);
      } finally {
        setLoading(false);
      }
    }
    loadToday();
  }, []);

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      {/* 1. RECRUITER GREETING & DATE (FRAME 46) */}
      <div className="bg-gradient-to-r from-[#5B49D6] to-[#7B68EE] text-white p-5 rounded-2xl shadow-md space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider font-semibold opacity-80 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Today's Recruiter Agenda
          </span>
          <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
            IST Active
          </span>
        </div>
        <h1 className="text-xl font-bold">
          Hello, {agenda?.recruiterName || 'Recruiter'} 👋
        </h1>
        <p className="text-xs text-white/80 flex items-center gap-1 pt-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>{agenda?.todayDateFormatted || 'Today'}</span>
        </p>
      </div>

      {/* 2. URGENT ACTION CHIPS */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-white border border-[#E6E8F0] p-3 rounded-xl shadow-2xs flex flex-col items-center text-center">
          <div className="w-7 h-7 rounded-lg bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center mb-1">
            <Video className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold text-[#1B2236]">
            {agenda?.interviewsCount ?? 0}
          </div>
          <div className="text-[10px] text-[#6B7490] font-medium leading-tight">
            Interviews Today
          </div>
        </div>

        <div className="bg-white border border-[#E6E8F0] p-3 rounded-xl shadow-2xs flex flex-col items-center text-center">
          <div className="w-7 h-7 rounded-lg bg-[#FEF3DC] text-[#D97706] flex items-center justify-center mb-1">
            <FileCheck2 className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold text-[#1B2236]">
            {agenda?.pendingSubmissionsCount ?? 0}
          </div>
          <div className="text-[10px] text-[#6B7490] font-medium leading-tight">
            Pending Submissions
          </div>
        </div>

        <div className="bg-white border border-[#E6E8F0] p-3 rounded-xl shadow-2xs flex flex-col items-center text-center">
          <div className="w-7 h-7 rounded-lg bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center mb-1">
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold text-[#1B2236]">
            {agenda?.pendingOffersCount ?? 0}
          </div>
          <div className="text-[10px] text-[#6B7490] font-medium leading-tight">
            Awaiting Offer
          </div>
        </div>
      </div>

      {/* 3. TODAY'S SCHEDULE TIMELINE */}
      <div className="bg-white border border-[#E6E8F0] rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#E6E8F0]">
          <h2 className="text-sm font-bold text-[#1B2236] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#5B49D6]" />
            <span>Today's Interviews</span>
          </h2>
          <span className="text-[11px] text-[#6B7490] font-medium">
            {agenda?.interviews.length || 0} Scheduled
          </span>
        </div>

        {loading ? (
          <div className="py-6 text-center text-xs text-[#6B7490]">Loading today's schedule...</div>
        ) : !agenda?.interviews || agenda.interviews.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#6B7490] space-y-1">
            <div className="w-10 h-10 rounded-full bg-[#F6F7FB] text-[#6B7490] flex items-center justify-center mx-auto mb-2">
              <Calendar className="w-5 h-5" />
            </div>
            <p className="font-semibold text-[#1B2236]">No interviews scheduled today</p>
            <p className="text-[11px]">Take this time to review candidate pools or follow up on client feedback.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agenda.interviews.map((iv) => (
              <div
                key={iv.id}
                className="p-3.5 rounded-xl border border-[#E6E8F0] bg-[#F6F7FB]/50 hover:bg-[#F6F7FB] transition-colors space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-[#1B2236]">{iv.candidateName}</h3>
                    <p className="text-xs text-[#6B7490] flex items-center gap-1 mt-0.5">
                      <Briefcase className="w-3 h-3 text-[#5B49D6]" />
                      <span>{iv.jobTitle}</span>
                    </p>
                    <p className="text-[11px] text-[#6B7490] flex items-center gap-1 mt-0.5">
                      <Building className="w-3 h-3 text-[#6B7490]" />
                      <span>{iv.clientName}</span>
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EEEBFB] text-[#5B49D6] border border-[#D7D0F8]">
                    {iv.roundName}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#E6E8F0]/60">
                  <span className="font-medium text-[#1B2236] flex items-center gap-1 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-[#5B49D6]" />
                    {iv.timeFormatted}
                  </span>

                  <div className="flex items-center gap-2">
                    {iv.candidatePhone && (
                      <a
                        href={`tel:${iv.candidatePhone}`}
                        className="p-1.5 rounded-lg border border-[#E6E8F0] bg-white text-[#1B2236] hover:bg-[#F6F7FB]"
                        title="Call candidate"
                      >
                        <Phone className="w-3.5 h-3.5 text-[#12B76A]" />
                      </a>
                    )}
                    {iv.meetingUrl ? (
                      <a
                        href={iv.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-[#5B49D6] text-white text-[11px] font-semibold flex items-center gap-1 shadow-xs"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Join Meeting</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-[#6B7490] bg-gray-100 px-2 py-0.5 rounded">
                        No link
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. QUICK ACTION FLOATERS / TOUCH BAR */}
      <div className="bg-white border border-[#E6E8F0] rounded-2xl p-4 shadow-2xs space-y-2">
        <h3 className="text-xs font-bold text-[#6B7490] uppercase tracking-wider">Quick Actions</h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setActiveModal('CALL')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#E6E8F0] bg-[#F6F7FB] hover:bg-[#EEEBFB] transition-colors cursor-pointer"
          >
            <Phone className="w-4 h-4 text-[#5B49D6] mb-1" />
            <span className="text-[11px] font-semibold text-[#1B2236]">Log Call</span>
          </button>

          <button
            onClick={() => setActiveModal('NOTE')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#E6E8F0] bg-[#F6F7FB] hover:bg-[#EEEBFB] transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#5B49D6] mb-1" />
            <span className="text-[11px] font-semibold text-[#1B2236]">Quick Note</span>
          </button>

          <button
            onClick={() => setActiveModal('CV')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#E6E8F0] bg-[#F6F7FB] hover:bg-[#EEEBFB] transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-[#5B49D6] mb-1" />
            <span className="text-[11px] font-semibold text-[#1B2236]">Share CV</span>
          </button>
        </div>
      </div>

      {/* MODAL SIMULATION FOR QUICK ACTIONS */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-[#E6E8F0] space-y-3">
            <h3 className="font-bold text-sm text-[#1B2236]">
              {activeModal === 'CALL'
                ? 'Log Recruiter Call'
                : activeModal === 'NOTE'
                ? 'Add Quick Candidate Note'
                : 'Share Candidate CV Profile'}
            </h3>
            <textarea
              rows={3}
              placeholder="Enter details..."
              className="w-full p-2.5 border border-[#E6E8F0] rounded-lg text-xs outline-none focus:border-[#5B49D6]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 border border-[#E6E8F0] rounded-lg text-xs font-semibold text-[#6B7490]"
              >
                Cancel
              </button>
              <button
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
