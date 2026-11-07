'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getPublicSlotInvitationAction, confirmSlotBookingAction } from '@/actions/slot-invitations';
import { PublicSlotInvitationDTO } from '@hireflow/shared';
import { Calendar, Clock, Video, CheckCircle2, AlertCircle, Building2, ChevronRight } from 'lucide-react';

export default function CandidateSlotSchedulingPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<PublicSlotInvitationDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [candidateNotes, setCandidateNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedData, setConfirmedData] = useState<any | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!token) return;
      setLoading(true);
      setError(null);
      const res = await getPublicSlotInvitationAction(token);
      if (res.success && res.data) {
        setInvitation(res.data);
        if (res.data.status === 'BOOKED' && res.data.bookedInterview) {
          setConfirmedData({
            scheduledAt: res.data.bookedInterview.scheduledAt,
            duration: res.data.bookedInterview.duration,
            meetingLink: res.data.bookedInterview.meetingLink,
          });
        }
      } else {
        setError(res.error || 'Failed to load scheduling invitation');
      }
      setLoading(false);
    }
    loadData();
  }, [token]);

  // Group slots by Date (YYYY-MM-DD or formatted)
  const slotsGroupedByDate = React.useMemo(() => {
    if (!invitation?.slotOptions) return {};
    const groups: Record<string, typeof invitation.slotOptions> = {};
    for (const slot of invitation.slotOptions) {
      const d = new Date(slot.startTime);
      const dateKey = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(slot);
    }
    return groups;
  }, [invitation?.slotOptions]);

  const dateKeys = Object.keys(slotsGroupedByDate);

  // Set default selected date once loaded
  useEffect(() => {
    if (dateKeys.length > 0 && !selectedDate) {
      setSelectedDate(dateKeys[0]);
    }
  }, [dateKeys, selectedDate]);

  const selectedSlot = invitation?.slotOptions.find((s) => s.id === selectedSlotId);

  async function handleConfirmBooking() {
    if (!selectedSlotId || !token) return;
    setIsSubmitting(true);
    setError(null);

    const res = await confirmSlotBookingAction(token, {
      slotOptionId: selectedSlotId,
      timezone: invitation?.timezone || 'Asia/Kolkata',
      candidateNotes: candidateNotes.trim() || undefined,
    });

    if (res.success && res.data) {
      setConfirmedData(res.data);
    } else {
      setError(res.error || 'Failed to confirm booking. Please try selecting another slot.');
    }
    setIsSubmitting(false);
  }

  // Format time in 12-hour AM/PM
  function formatSlotTime(utcIso: string) {
    const d = new Date(utcIso);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: invitation?.timezone || 'Asia/Kolkata',
    });
  }

  return (
    <div className="min-h-screen bg-[#F6F7FB] flex flex-col items-center justify-start p-4 sm:p-8">
      {/* Brand Header */}
      <div className="w-full max-w-3xl flex items-center justify-between pb-6 mb-4 border-b border-[#E6E8F0]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5B49D6] text-white flex items-center justify-center font-bold text-lg shadow-sm">
            H
          </div>
          <div>
            <div className="font-bold text-base text-[#1B2236] leading-none">HireFlow</div>
            <div className="text-xs text-[#6B7490] mt-0.5">Aureva Capital Recruitment</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#EEEBFB] text-[#5B49D6]">
            Candidate Self-Scheduling
          </span>
        </div>
      </div>

      <div className="w-full max-w-3xl">
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#E6E8F0] p-12 text-center shadow-xs">
            <div className="w-8 h-8 border-3 border-[#5B49D6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <div className="font-semibold text-sm text-[#1B2236]">Loading interview options...</div>
            <div className="text-xs text-[#6B7490] mt-1">Checking real-time interviewer availability</div>
          </div>
        ) : error && !invitation ? (
          <div className="bg-white rounded-2xl border border-red-200 p-8 text-center shadow-xs">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-[#1B2236] mb-1">Invitation Link Inactive</h2>
            <p className="text-sm text-[#6B7490] max-w-md mx-auto mb-6">{error}</p>
            <div className="text-xs text-[#6B7490]">
              If you believe this is an error, please reply to your invitation email or contact your recruiter.
            </div>
          </div>
        ) : confirmedData ? (
          /* Confirmation Success View */
          <div className="bg-white rounded-2xl border border-[#E6E8F0] p-8 sm:p-10 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h1 className="text-2xl font-bold text-center text-[#1B2236]">Interview Confirmed!</h1>
            <p className="text-center text-sm text-[#6B7490] mt-1 mb-6">
              Hi <span className="font-semibold text-[#1B2236]">{invitation?.candidateName}</span>, your interview has been scheduled.
            </p>

            <div className="bg-[#F8FAFC] border border-[#E6E8F0] rounded-xl p-6 space-y-4 max-w-lg mx-auto mb-8">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-[#5B49D6] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-[#6B7490] font-medium">Position & Round</div>
                  <div className="text-sm font-bold text-[#1B2236]">{invitation?.jobTitle}</div>
                  <div className="text-xs text-[#5B49D6] font-semibold">{invitation?.roundName}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-[#5B49D6] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-[#6B7490] font-medium">Scheduled Time</div>
                  <div className="text-sm font-bold text-[#1B2236]">
                    {new Date(confirmedData.scheduledAt).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="text-xs text-[#6B7490]">
                    {formatSlotTime(confirmedData.scheduledAt)} ({confirmedData.duration || invitation?.duration} minutes) • {invitation?.timezone}
                  </div>
                </div>
              </div>

              {confirmedData.meetingLink && (
                <div className="flex items-start gap-3 pt-2 border-t border-[#E6E8F0]">
                  <Video className="w-5 h-5 text-[#12B76A] mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-[#6B7490] font-medium">Video Meeting Room</div>
                    <a
                      href={confirmedData.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-1.5 px-4 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-colors shadow-xs"
                    >
                      <Video className="w-3.5 h-3.5" />
                      Join Video Meeting
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="text-center space-y-2 text-xs text-[#6B7490] border-t border-[#E6E8F0] pt-6">
              <p>📅 A calendar invite with an RFC-5545 <strong>.ics attachment</strong> has been sent to your email.</p>
              <p>🔔 Automatic reminder notifications will be sent 24 hours and 30 minutes before the interview.</p>
            </div>
          </div>
        ) : (
          /* Slot Selection View (Frame 44) */
          <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-[#5B49D6] uppercase tracking-wider">Aureva Capital Partner</span>
                    <span className="text-[#6B7490]">•</span>
                    <span className="text-xs text-[#6B7490] font-medium">{invitation?.roundName}</span>
                  </div>
                  <h1 className="text-2xl font-bold text-[#1B2236]">{invitation?.jobTitle}</h1>
                  <p className="text-xs text-[#6B7490] mt-1">
                    Hi <span className="font-semibold text-[#1B2236]">{invitation?.candidateName}</span>, please select an interview time that works best for you.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#E6E8F0] text-xs font-semibold text-[#1B2236]">
                    <Clock className="w-3.5 h-3.5 text-[#5B49D6]" />
                    {invitation?.duration} Mins
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#E6E8F0] text-xs font-semibold text-[#1B2236]">
                    <Video className="w-3.5 h-3.5 text-[#12B76A]" />
                    Video Call
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Select Date */}
            <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm text-[#1B2236] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#5B49D6]" />
                  1. Select a Date
                </h3>
                <span className="text-[11px] text-[#6B7490]">All times in {invitation?.timezone}</span>
              </div>

              <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                {dateKeys.map((dateStr) => {
                  const slots = slotsGroupedByDate[dateStr];
                  const availableCount = slots.filter((s) => s.isAvailable).length;
                  const isSelected = selectedDate === dateStr;

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => {
                        setSelectedDate(dateStr);
                        setSelectedSlotId(null);
                      }}
                      className={`px-4 py-3 rounded-xl border text-left shrink-0 transition-all ${
                        isSelected
                          ? 'border-[#5B49D6] bg-[#EEEBFB] text-[#5B49D6] shadow-xs'
                          : 'border-[#E6E8F0] bg-white text-[#1B2236] hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xs font-bold">{dateStr}</div>
                      <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-[#5B49D6]' : 'text-[#6B7490]'}`}>
                        {availableCount} {availableCount === 1 ? 'slot' : 'slots'} available
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Select Time Slot */}
            {selectedDate && (
              <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs">
                <h3 className="font-bold text-sm text-[#1B2236] mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#5B49D6]" />
                  2. Select a Time Slot
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {slotsGroupedByDate[selectedDate]?.map((slot) => {
                    const isSelected = selectedSlotId === slot.id;
                    const isAvailable = slot.isAvailable;

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={`p-3.5 rounded-xl border text-center transition-all ${
                          !isAvailable
                            ? 'border-[#F1F3F9] bg-[#F8FAFC] text-gray-400 cursor-not-allowed opacity-60'
                            : isSelected
                            ? 'border-[#5B49D6] bg-[#5B49D6] text-white shadow-xs font-bold'
                            : 'border-[#E6E8F0] bg-white text-[#1B2236] hover:border-[#5B49D6] font-medium'
                        }`}
                      >
                        <div className="text-xs">
                          {formatSlotTime(slot.startTime)} – {formatSlotTime(slot.endTime)}
                        </div>
                        {!isAvailable && <div className="text-[10px] mt-0.5 text-gray-400">Unavailable</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Optional Notes & Confirm */}
            {selectedSlot && (
              <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs space-y-4">
                <h3 className="font-bold text-sm text-[#1B2236]">3. Booking Summary & Confirmation</h3>

                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E6E8F0] text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#6B7490]">Selected Date:</span>
                    <span className="font-bold text-[#1B2236]">{selectedDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7490]">Time Window:</span>
                    <span className="font-bold text-[#5B49D6]">
                      {formatSlotTime(selectedSlot.startTime)} – {formatSlotTime(selectedSlot.endTime)} ({invitation?.timezone})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7490]">Format:</span>
                    <span className="font-medium text-[#1B2236]">Video Call (Meeting link generated upon confirmation)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                    Notes for the Interviewer (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={candidateNotes}
                    onChange={(e) => setCandidateNotes(e.target.value)}
                    placeholder="E.g., Any topic preferences or device constraints"
                    className="w-full text-xs p-3 rounded-xl border border-[#E6E8F0] bg-white focus:outline-none focus:border-[#5B49D6]"
                  />
                </div>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmBooking}
                  className="w-full py-3.5 bg-[#5B49D6] text-white rounded-xl text-sm font-bold hover:bg-[#5B49D6]/90 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Confirming Your Booking...
                    </>
                  ) : (
                    <>
                      Confirm Interview Booking
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
