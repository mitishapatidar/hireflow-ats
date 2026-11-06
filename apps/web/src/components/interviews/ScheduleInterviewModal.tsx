'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Video,
  User,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  VideoProvider,
  InterviewMode,
  DEFAULT_TIMEZONE,
} from '@hireflow/shared';
import {
  scheduleInterviewAction,
  checkAvailabilityAction,
  getInterviewPrerequisitesAction,
} from '@/actions/interviews';

interface ScheduleInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduled: () => void;
  preselectedJobId?: string;
  preselectedApplicationId?: string;
}

export const ScheduleInterviewModal: React.FC<ScheduleInterviewModalProps> = ({
  isOpen,
  onClose,
  onScheduled,
  preselectedJobId,
  preselectedApplicationId,
}) => {
  const [loadingPrereqs, setLoadingPrereqs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prerequisites data
  const [jobs, setJobs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Form states
  const [selectedJobId, setSelectedJobId] = useState<string>(preselectedJobId || '');
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>(preselectedApplicationId || '');
  const [selectedRoundId, setSelectedRoundId] = useState<string>('');
  const [selectedPanelMemberIds, setSelectedPanelMemberIds] = useState<string[]>([]);
  const [dateStr, setDateStr] = useState<string>(() => {
    // Tomorrow by default
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [timeStr, setTimeStr] = useState<string>('14:00'); // 2:00 PM IST
  const [duration, setDuration] = useState<number>(45);
  const [mode, setMode] = useState<InterviewMode>(InterviewMode.VIDEO);
  const [provider, setProvider] = useState<VideoProvider>(VideoProvider.GOOGLE_MEET);
  const [reminder24h, setReminder24h] = useState<boolean>(true);
  const [reminder30m, setReminder30m] = useState<boolean>(true);

  // Availability checking state
  const [availabilityResult, setAvailabilityResult] = useState<any | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      setLoadingPrereqs(true);
      setError(null);
      const res = await getInterviewPrerequisitesAction();
      if (res.success && res.data) {
        setJobs(res.data.jobs);
        setUsers(res.data.users);

        if (preselectedJobId) {
          setSelectedJobId(preselectedJobId);
          const j = res.data.jobs.find((x: any) => x.id === preselectedJobId);
          if (j?.rounds?.[0]) {
            setSelectedRoundId(j.rounds[0].id);
            setDuration(j.rounds[0].durationMinutes || 45);
          }
        } else if (res.data.jobs.length > 0) {
          const firstJob = res.data.jobs[0];
          setSelectedJobId(firstJob.id);
          if (firstJob.rounds?.[0]) {
            setSelectedRoundId(firstJob.rounds[0].id);
            setDuration(firstJob.rounds[0].durationMinutes || 45);
          }
          if (firstJob.applications?.[0]) {
            setSelectedApplicationId(firstJob.applications[0].applicationId);
          }
        }

        if (res.data.users.length > 0) {
          setSelectedPanelMemberIds([res.data.users[0].id]);
        }
      } else {
        setError(res.error || 'Failed to load scheduling data');
      }
      setLoadingPrereqs(false);
    }

    loadData();
  }, [isOpen, preselectedJobId, preselectedApplicationId]);

  // Selected job helper
  const currentJob = jobs.find((j) => j.id === selectedJobId);
  const applications = currentJob?.applications || [];
  const rounds = currentJob?.rounds || [];

  // When job changes, reset application and round
  const handleJobChange = (jobId: string) => {
    setSelectedJobId(jobId);
    const j = jobs.find((x) => x.id === jobId);
    if (j?.rounds?.[0]) {
      setSelectedRoundId(j.rounds[0].id);
      setDuration(j.rounds[0].durationMinutes || 45);
    } else {
      setSelectedRoundId('');
    }
    if (j?.applications?.[0]) {
      setSelectedApplicationId(j.applications[0].applicationId);
    } else {
      setSelectedApplicationId('');
    }
    setAvailabilityResult(null);
  };

  const handleRoundChange = (roundId: string) => {
    setSelectedRoundId(roundId);
    const r = rounds.find((x: any) => x.id === roundId);
    if (r?.durationMinutes) {
      setDuration(r.durationMinutes);
    }
  };

  const togglePanelMember = (userId: string) => {
    if (selectedPanelMemberIds.includes(userId)) {
      if (selectedPanelMemberIds.length === 1) {
        return; // require at least one
      }
      setSelectedPanelMemberIds(selectedPanelMemberIds.filter((id) => id !== userId));
    } else {
      setSelectedPanelMemberIds([...selectedPanelMemberIds, userId]);
    }
    setAvailabilityResult(null);
  };

  // Perform availability check
  const handleCheckAvailability = async () => {
    if (selectedPanelMemberIds.length === 0) return;
    setCheckingAvailability(true);
    setError(null);

    // Compute UTC ISO string from IST date and time
    // Asia/Kolkata is UTC+5:30 -> subtract 5.5 hours from IST wall time
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, mins] = timeStr.split(':').map(Number);
    const istTimeMs = Date.UTC(year, month - 1, day, hours, mins, 0);
    const utcTimeMs = istTimeMs - 5.5 * 60 * 60 * 1000;
    const scheduledAtUtc = new Date(utcTimeMs).toISOString();

    const res = await checkAvailabilityAction({
      scheduledAt: scheduledAtUtc,
      duration,
      panelMemberIds: selectedPanelMemberIds,
    });

    if (res.success && res.data) {
      setAvailabilityResult(res.data);
    } else {
      setError(res.error || 'Failed to check availability');
    }
    setCheckingAvailability(false);
  };

  // Confirm and schedule interview
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApplicationId) {
      setError('Please select a candidate application');
      return;
    }
    if (selectedPanelMemberIds.length === 0) {
      setError('Please select at least one panel member');
      return;
    }

    setSubmitting(true);
    setError(null);

    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, mins] = timeStr.split(':').map(Number);
    const istTimeMs = Date.UTC(year, month - 1, day, hours, mins, 0);
    const utcTimeMs = istTimeMs - 5.5 * 60 * 60 * 1000;
    const scheduledAtUtc = new Date(utcTimeMs).toISOString();

    const payload = {
      applicationId: selectedApplicationId,
      roundId: selectedRoundId || undefined,
      scheduledAt: scheduledAtUtc,
      duration,
      timezone: DEFAULT_TIMEZONE,
      mode,
      provider,
      panelMemberIds: selectedPanelMemberIds,
      reminder24h,
      reminder30m,
      recipients: {
        candidate: true,
        panel: true,
        recruiter: true,
      },
    };

    const res = await scheduleInterviewAction(payload);
    if (res.success) {
      onScheduled();
      onClose();
    } else {
      setError(res.error || 'Failed to schedule interview');
    }
    setSubmitting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#1E2A4A]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xl w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E8F0] bg-[#F6F7FB]/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1B2236]">Schedule Interview</h2>
              <p className="text-xs text-[#6B7490]">Figma Frame 27 — Panel coordination & mock meeting setup</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#6B7490] hover:text-[#1B2236] hover:bg-[#E6E8F0] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loadingPrereqs ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#5B49D6]" />
            <p className="text-xs text-[#6B7490]">Loading active jobs, candidates, and interview panels...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3.5 bg-[#FFF0F0] border border-[#E5484D]/30 rounded-xl flex items-start gap-2.5 text-xs text-[#E5484D]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Job & Candidate Application */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                  Job Mandate (Active Only) <span className="text-[#E5484D]">*</span>
                </label>
                <select
                  value={selectedJobId}
                  onChange={(e) => handleJobChange(e.target.value)}
                  className="w-full text-xs rounded-xl border border-[#E6E8F0] px-3.5 py-2.5 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none"
                  required
                >
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.code} — {j.title} ({j.clientName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                  Candidate Application <span className="text-[#E5484D]">*</span>
                </label>
                <select
                  value={selectedApplicationId}
                  onChange={(e) => {
                    setSelectedApplicationId(e.target.value);
                    setAvailabilityResult(null);
                  }}
                  className="w-full text-xs rounded-xl border border-[#E6E8F0] px-3.5 py-2.5 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none"
                  required
                >
                  {applications.length === 0 ? (
                    <option value="">No candidate applications in this job</option>
                  ) : (
                    applications.map((app: any) => (
                      <option key={app.applicationId} value={app.applicationId}>
                        {app.candidateName} — {app.candidateRole}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Round & Mode */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                  Interview Round
                </label>
                <select
                  value={selectedRoundId}
                  onChange={(e) => handleRoundChange(e.target.value)}
                  className="w-full text-xs rounded-xl border border-[#E6E8F0] px-3.5 py-2.5 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none"
                >
                  {rounds.length === 0 ? (
                    <option value="">Standard Screening Round</option>
                  ) : (
                    rounds.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        Round {r.roundOrder}: {r.name} ({r.durationMinutes} mins)
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                  Interview Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[InterviewMode.VIDEO, InterviewMode.PHONE, InterviewMode.IN_PERSON].map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setMode(m)}
                      className={`py-2 text-xs font-medium rounded-xl border transition-all ${
                        mode === m
                          ? 'bg-[#EEEBFB] border-[#5B49D6] text-[#5B49D6] font-semibold'
                          : 'bg-white border-[#E6E8F0] text-[#6B7490] hover:border-[#5B49D6]/40'
                      }`}
                    >
                      {m === InterviewMode.VIDEO ? 'Video' : m === InterviewMode.PHONE ? 'Phone' : 'In-Person'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Video Provider Selector */}
            {mode === InterviewMode.VIDEO && (
              <div className="p-3.5 bg-[#F6F7FB] border border-[#E6E8F0] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1B2236] flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-[#5B49D6]" />
                    Video Provider (Demo Mode)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#F59E0B] border border-[#F59E0B]/30">
                    Mock provider (Prompt 25 connects live APIs)
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { id: VideoProvider.GOOGLE_MEET, label: 'Google Meet' },
                    { id: VideoProvider.ZOOM, label: 'Zoom' },
                    { id: VideoProvider.TEAMS, label: 'Microsoft Teams' },
                  ].map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setProvider(p.id)}
                      className={`py-2 px-3 text-xs rounded-lg border font-medium transition-all ${
                        provider === p.id
                          ? 'bg-white border-[#5B49D6] text-[#5B49D6] font-bold shadow-xs'
                          : 'bg-white/60 border-[#E6E8F0] text-[#6B7490] hover:bg-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Panel Members Multi-Select */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#1B2236]">
                  Panel Members <span className="text-[#E5484D]">*</span>
                </label>
                <span className="text-[11px] text-[#6B7490]">
                  {selectedPanelMemberIds.length} member(s) selected
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1 border border-[#E6E8F0] rounded-xl">
                {users.map((u) => {
                  const isSelected = selectedPanelMemberIds.includes(u.id);
                  return (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => togglePanelMember(u.id)}
                      className={`p-2 text-left rounded-lg border text-xs transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'bg-[#EEEBFB] border-[#5B49D6] text-[#1B2236]'
                          : 'bg-white border-[#E6E8F0] text-[#6B7490] hover:border-[#5B49D6]/30'
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                          isSelected ? 'bg-[#5B49D6] border-[#5B49D6] text-white' : 'border-[#E6E8F0]'
                        }`}
                      >
                        {isSelected && '✓'}
                      </div>
                      <div className="truncate">
                        <div className="font-semibold truncate">{u.name}</div>
                        <div className="text-[10px] text-[#6B7490] capitalize">{u.role.toLowerCase()}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date, Time, Duration & Timezone */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                  Date (IST)
                </label>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => {
                    setDateStr(e.target.value);
                    setAvailabilityResult(null);
                  }}
                  className="w-full text-xs rounded-xl border border-[#E6E8F0] px-3 py-2 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                  Start Time (IST)
                </label>
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => {
                    setTimeStr(e.target.value);
                    setAvailabilityResult(null);
                  }}
                  className="w-full text-xs rounded-xl border border-[#E6E8F0] px-3 py-2 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                  Duration (mins)
                </label>
                <select
                  value={duration}
                  onChange={(e) => {
                    setDuration(Number(e.target.value));
                    setAvailabilityResult(null);
                  }}
                  className="w-full text-xs rounded-xl border border-[#E6E8F0] px-3 py-2 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none"
                >
                  <option value={30}>30 mins</option>
                  <option value={45}>45 mins</option>
                  <option value={60}>60 mins (1 hr)</option>
                  <option value={90}>90 mins (1.5 hrs)</option>
                  <option value={120}>120 mins (2 hrs)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                  Timezone
                </label>
                <input
                  type="text"
                  value={DEFAULT_TIMEZONE}
                  disabled
                  className="w-full text-xs rounded-xl border border-[#E6E8F0] px-3 py-2 bg-[#F6F7FB] text-[#6B7490] cursor-not-allowed"
                />
              </div>
            </div>

            {/* Live Panel Availability Checking */}
            <div className="p-3.5 bg-white border border-[#E6E8F0] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1B2236] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#5B49D6]" />
                  Panel Availability Check
                </span>
                <button
                  type="button"
                  onClick={handleCheckAvailability}
                  disabled={checkingAvailability}
                  className="text-xs font-semibold text-[#5B49D6] hover:text-[#5B49D6]/80 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {checkingAvailability ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    'Check Free/Busy Status'
                  )}
                </button>
              </div>

              {availabilityResult && (
                <div className="pt-2 border-t border-[#E6E8F0] space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {availabilityResult.panelMembers.map((m: any) => (
                      <span
                        key={m.userId}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                          m.status === 'FREE'
                            ? 'bg-[#E8FAF0] text-[#12B76A] border border-[#12B76A]/20'
                            : 'bg-[#FFF0F0] text-[#E5484D] border border-[#E5484D]/30'
                        }`}
                      >
                        {m.status === 'FREE' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        {m.userName}: {m.status === 'FREE' ? 'Free' : 'Busy (Conflict)'}
                      </span>
                    ))}
                  </div>

                  {!availabilityResult.isAvailable && availabilityResult.alternativeSlotsSuggested?.length > 0 && (
                    <div className="p-2.5 bg-[#FFFBEB] rounded-lg text-xs text-[#F59E0B] space-y-1">
                      <span className="font-bold">Suggested Alternative Slots:</span>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {availabilityResult.alternativeSlotsSuggested.map((alt: any, idx: number) => (
                          <button
                            type="button"
                            key={idx}
                            onClick={() => {
                              const d = new Date(alt.startTimeUtc);
                              // Convert to IST
                              const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
                              setDateStr(ist.toISOString().split('T')[0]);
                              const hh = String(ist.getUTCHours()).padStart(2, '0');
                              const mm = String(ist.getUTCMinutes()).padStart(2, '0');
                              setTimeStr(`${hh}:${mm}`);
                              setAvailabilityResult(null);
                            }}
                            className="px-2 py-1 bg-white border border-[#F59E0B]/30 rounded text-[11px] font-bold text-[#1B2236] hover:bg-[#EEEBFB]"
                          >
                            {alt.startTimeIST}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reminder Configuration */}
            <div className="p-3.5 bg-[#F6F7FB] border border-[#E6E8F0] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#5B49D6]" />
                <span className="text-xs font-semibold text-[#1B2236]">Automated Reminders:</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-[#1B2236]">
                  <input
                    type="checkbox"
                    checked={reminder24h}
                    onChange={(e) => setReminder24h(e.target.checked)}
                    className="rounded border-[#E6E8F0] text-[#5B49D6] focus:ring-[#5B49D6]"
                  />
                  <span>24 hours before</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-[#1B2236]">
                  <input
                    type="checkbox"
                    checked={reminder30m}
                    onChange={(e) => setReminder30m(e.target.checked)}
                    className="rounded border-[#E6E8F0] text-[#5B49D6] focus:ring-[#5B49D6]"
                  />
                  <span>30 mins before</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E6E8F0]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#6B7490] hover:text-[#1B2236] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-[#5B49D6] text-white rounded-xl text-xs font-bold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Scheduling...</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Confirm & Schedule Interview</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
