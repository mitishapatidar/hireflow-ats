'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Video,
  User,
  Building2,
  AlertCircle,
  CheckCircle2,
  UserX,
  RefreshCw,
  ExternalLink,
  CalendarCheck,
  ShieldAlert,
} from 'lucide-react';
import { PageHeader } from '../layout/PageHeader';
import { InterviewOutcome } from '@hireflow/shared';
import { getCalendarDataAction } from '@/actions/interviews';
import { ScheduleInterviewModal } from './ScheduleInterviewModal';
import { InterviewDetailsDrawer } from './InterviewDetailsDrawer';

interface InterviewsCalendarClientViewProps {
  initialWeek: any;
  initialEvents: any[];
  initialStats: {
    thisWeek: number;
    pendingFeedback: number;
    noShowsThisWeek: number;
    calendarSync: {
      status: string;
      label: string;
      badge: string;
      description?: string;
    };
  };
  users: Array<{ id: string; name: string; email: string }>;
}

export const InterviewsCalendarClientView: React.FC<InterviewsCalendarClientViewProps> = ({
  initialWeek,
  initialEvents,
  initialStats,
  users,
}) => {
  const [week, setWeek] = useState(initialWeek);
  const [events, setEvents] = useState<any[]>(initialEvents);
  const [stats, setStats] = useState(initialStats);
  const [currentReferenceDate, setCurrentReferenceDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  // Modals state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(null);

  // Load calendar for a specific date
  const loadWeekData = async (targetDate: Date) => {
    setLoading(true);
    setCurrentReferenceDate(targetDate);
    const res = await getCalendarDataAction(targetDate.toISOString());
    if (res.success && res.data) {
      setWeek(res.data.week);
      setEvents(res.data.events);
      setStats(res.data.stats);
    }
    setLoading(false);
  };

  const handlePrevWeek = () => {
    const d = new Date(currentReferenceDate);
    d.setDate(d.getDate() - 7);
    loadWeekData(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentReferenceDate);
    d.setDate(d.getDate() + 7);
    loadWeekData(d);
  };

  const handleToday = () => {
    loadWeekData(new Date());
  };

  const handleRefresh = () => {
    loadWeekData(currentReferenceDate);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Interviews"
        subtitle="Coordinate candidate interview rounds, interviewer calendars, and video links (Frame 06)."
        breadcrumbs={[{ label: 'Interviews' }]}
        actions={
          <button
            onClick={() => setShowScheduleModal(true)}
            className="px-4 py-2 bg-[#5B49D6] text-white rounded-xl text-xs font-bold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Interview</span>
          </button>
        }
      />

      {/* 4 Live Database-Backed Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: This Week */}
        <div className="bg-white rounded-2xl border border-[#E6E8F0] p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7490]">This Week</span>
            <div className="text-2xl font-extrabold text-[#1B2236] mt-1">{stats.thisWeek}</div>
            <span className="text-[11px] text-[#12B76A] font-semibold mt-0.5 block">Scheduled & active</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center">
            <CalendarCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Pending Feedback */}
        <div className="bg-white rounded-2xl border border-[#E6E8F0] p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7490]">Pending Feedback</span>
            <div className="text-2xl font-extrabold text-[#1B2236] mt-1">{stats.pendingFeedback}</div>
            <span className="text-[11px] text-[#F59E0B] font-semibold mt-0.5 block">Action required by panel</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-[#FFFBEB] text-[#F59E0B] flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: No-shows This Week */}
        <div className="bg-white rounded-2xl border border-[#E6E8F0] p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7490]">No-shows This Week</span>
            <div className="text-2xl font-extrabold text-[#1B2236] mt-1">{stats.noShowsThisWeek}</div>
            <span className="text-[11px] text-[#6B7490] font-semibold mt-0.5 block">Stage preserved (no auto-reject)</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-[#FFF0F0] text-[#E5484D] flex items-center justify-center">
            <UserX className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Calendar Sync */}
        <div className="bg-white rounded-2xl border border-[#E6E8F0] p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7490]">Calendar Sync</span>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#F59E0B] border border-[#F59E0B]/30">
                {stats.calendarSync.badge}
              </span>
            </div>
            <span className="text-[11px] text-[#6B7490] font-medium mt-1 block">
              Google & MS Teams (Demo Mode)
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-[#F6F7FB] text-[#6B7490] flex items-center justify-center">
            <RefreshCw className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Week Calendar Card */}
      <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-sm overflow-hidden">
        {/* Navigation Bar */}
        <div className="px-6 py-4 border-b border-[#E6E8F0] flex flex-wrap items-center justify-between gap-4 bg-[#F6F7FB]/40">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white border border-[#E6E8F0] rounded-xl p-1 shadow-2xs">
              <button
                onClick={handlePrevWeek}
                title="Previous Week"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[#6B7490] hover:text-[#1B2236] hover:bg-[#F6F7FB] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleToday}
                className="px-3 py-1 text-xs font-bold text-[#1B2236] hover:text-[#5B49D6] rounded-lg hover:bg-[#F6F7FB] transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={handleNextWeek}
                title="Next Week"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[#6B7490] hover:text-[#1B2236] hover:bg-[#F6F7FB] transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[#5B49D6]" />
              <span className="text-sm font-extrabold text-[#1B2236]">{week?.weekLabel || 'Current Week'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Color Legend */}
            <div className="hidden md:flex items-center gap-3 text-[11px] text-[#6B7490]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#5B49D6]" />
                <span>Screening</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
                <span>Technical</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#12B76A]" />
                <span>Final / HM</span>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              title="Refresh Calendar"
              className="h-8 w-8 rounded-xl border border-[#E6E8F0] bg-white flex items-center justify-center text-[#6B7490] hover:text-[#1B2236] transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 7-Day Columns Header */}
        <div className="grid grid-cols-7 border-b border-[#E6E8F0] bg-[#F6F7FB] text-center divide-x divide-[#E6E8F0]">
          {week?.days?.map((day: any) => (
            <div
              key={day.dayIndex}
              className={`py-3 px-2 transition-colors ${
                day.isToday ? 'bg-[#EEEBFB]/60 text-[#5B49D6]' : 'text-[#1B2236]'
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#6B7490]">{day.dayName}</div>
              <div className={`text-base font-extrabold mt-0.5 ${day.isToday ? 'text-[#5B49D6]' : 'text-[#1B2236]'}`}>
                {day.dayNumber}
              </div>
              {day.isToday && (
                <span className="inline-block text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-[#5B49D6] text-white mt-1">
                  TODAY
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Calendar Body: 7 Day Columns */}
        <div className="grid grid-cols-7 divide-x divide-[#E6E8F0] min-h-[520px] bg-white">
          {week?.days?.map((day: any) => {
            const dayEvents = events.filter((e) => e.dayIndex === day.dayIndex);

            return (
              <div
                key={day.dayIndex}
                className={`p-2 space-y-2.5 flex flex-col ${day.isToday ? 'bg-[#F6F7FB]/30' : ''}`}
              >
                {dayEvents.map((evt) => {
                  const isScreening = evt.roundType === 'SCREENING' || evt.roundName.toLowerCase().includes('screen');
                  const isTechnical = evt.roundType === 'TECHNICAL' || evt.roundName.toLowerCase().includes('tech');
                  const isHiringManager =
                    evt.roundType === 'HIRING_MANAGER' ||
                    evt.roundName.toLowerCase().includes('manager') ||
                    evt.roundName.toLowerCase().includes('final');

                  const borderColor = isScreening
                    ? 'border-l-4 border-l-[#5B49D6]'
                    : isTechnical
                    ? 'border-l-4 border-l-[#3B82F6]'
                    : isHiringManager
                    ? 'border-l-4 border-l-[#12B76A]'
                    : 'border-l-4 border-l-[#5B49D6]';

                  return (
                    <div
                      key={evt.id}
                      onClick={() => setSelectedInterviewId(evt.id)}
                      className={`p-2.5 rounded-xl border border-[#E6E8F0] bg-white shadow-2xs hover:shadow-md transition-all cursor-pointer space-y-1.5 ${borderColor} ${
                        evt.outcome === InterviewOutcome.NO_SHOW
                          ? 'opacity-80 bg-[#FFF0F0]/30'
                          : evt.outcome === InterviewOutcome.CANCELLED
                          ? 'opacity-50 line-through bg-gray-50'
                          : ''
                      }`}
                    >
                      {/* Candidate Name & Status Pill */}
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-xs text-[#1B2236] truncate">{evt.candidateName}</span>
                        {evt.outcome !== InterviewOutcome.SCHEDULED && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                              evt.outcome === InterviewOutcome.COMPLETED
                                ? 'bg-[#E8FAF0] text-[#12B76A]'
                                : evt.outcome === InterviewOutcome.NO_SHOW
                                ? 'bg-[#FFF0F0] text-[#E5484D]'
                                : evt.outcome === InterviewOutcome.RESCHEDULED
                                ? 'bg-[#FFFBEB] text-[#F59E0B]'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {evt.outcome}
                          </span>
                        )}
                      </div>

                      {/* Job Title & Round */}
                      <div className="text-[11px] text-[#6B7490] truncate">{evt.jobTitle}</div>
                      <div className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#EEEBFB] text-[#5B49D6] truncate max-w-full">
                        {evt.roundName}
                      </div>

                      {/* Time & Mode */}
                      <div className="pt-1 border-t border-[#E6E8F0]/70 flex items-center justify-between text-[10px] text-[#6B7490]">
                        <span className="font-semibold text-[#1B2236] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#F59E0B]" />
                          <span>{evt.startTimeIST.replace(' IST', '')}</span>
                        </span>
                        <span className="flex items-center gap-1 text-[#5B49D6] font-medium">
                          <Video className="w-3 h-3" />
                          <span>{evt.duration}m</span>
                        </span>
                      </div>

                      {/* Pending feedback indicator */}
                      {evt.hasPendingFeedback && (
                        <div className="pt-0.5 text-[10px] text-[#F59E0B] font-bold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Feedback due</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {dayEvents.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-[11px] text-[#6B7490]/50 italic min-h-[100px]">
                    No interviews
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule Interview Modal (Frame 27) */}
      <ScheduleInterviewModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onScheduled={handleRefresh}
      />

      {/* Interview Details Drawer */}
      <InterviewDetailsDrawer
        interviewId={selectedInterviewId}
        onClose={() => setSelectedInterviewId(null)}
        onInterviewUpdated={handleRefresh}
        users={users}
      />
    </div>
  );
};
