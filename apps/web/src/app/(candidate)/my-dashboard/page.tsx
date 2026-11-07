'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '../../../components/layout/PageHeader';
import { getCandidatePortalDataAction, updateCandidateProfileAction } from '@/actions/candidate-portal';
import { CandidatePortalPayload, CandidateApplicationDTO, CandidateInterviewDTO } from '@hireflow/shared';
import {
  Calendar,
  Clock,
  Video,
  AlertCircle,
  Briefcase,
  ChevronRight,
  Edit2,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  UserCheck,
} from 'lucide-react';

export default function CandidateDashboardPage() {
  const [data, setData] = useState<CandidatePortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit profile state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editSkills, setEditSkills] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    async function loadPortal() {
      setLoading(true);
      setError(null);
      const res = await getCandidatePortalDataAction();
      if (res.success && res.data) {
        setData(res.data);
        setEditPhone(res.data.profile.phone || '');
        setEditLocation(res.data.profile.location || '');
        setEditSkills((res.data.profile.skills || []).join(', '));
      } else {
        setError(res.error || 'Failed to load your applicant dashboard');
      }
      setLoading(false);
    }
    loadPortal();
  }, []);

  async function handleSaveProfile() {
    setIsSavingProfile(true);
    const skillsArray = editSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await updateCandidateProfileAction({
      phone: editPhone.trim() || undefined,
      location: editLocation.trim() || undefined,
      skills: skillsArray.length > 0 ? skillsArray : undefined,
    });

    if (res.success && res.data) {
      if (data) {
        setData({
          ...data,
          profile: res.data,
        });
      }
      setIsEditingProfile(false);
    } else {
      alert(res.error || 'Failed to update profile');
    }
    setIsSavingProfile(false);
  }

  // Determine Urgent Next Step Card
  const pendingInvitationApp = data?.applications.find((app: CandidateApplicationDTO) => app.activeSlotInvitation);
  const nextInterview = data?.upcomingInterviews[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={data ? `Welcome back, ${data.profile.name}` : 'Applicant Portal'}
        subtitle="Track your applications, choose interview times, and join video meeting rooms."
        breadcrumbs={[{ label: 'Candidate Portal', href: '/my-dashboard' }]}
        actions={
          <button
            type="button"
            onClick={() => setIsEditingProfile(true)}
            className="px-3.5 py-2 bg-white border border-[#E6E8F0] text-[#1B2236] rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <Edit2 className="w-3.5 h-3.5 text-[#5B49D6]" />
            <span>Update Profile</span>
          </button>
        }
      />

      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E6E8F0] p-12 text-center shadow-xs">
          <div className="w-8 h-8 border-3 border-[#5B49D6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <div className="font-semibold text-sm text-[#1B2236]">Loading candidate dossier...</div>
          <div className="text-xs text-[#6B7490] mt-1">Connecting to Aureva Capital Recruitment System</div>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-red-200 p-8 text-center shadow-xs">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <div className="font-bold text-sm text-[#1B2236]">{error}</div>
          <div className="text-xs text-[#6B7490] mt-1">Please ensure your account has a registered candidate profile.</div>
        </div>
      ) : (
        <>
          {/* Top Banner: Profile Completeness & Key Stats */}
          <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#EEEBFB] text-[#5B49D6] font-bold text-xl flex items-center justify-center shrink-0 shadow-xs">
                  {data?.profile.name?.slice(0, 2).toUpperCase() || 'CP'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#1B2236]">{data?.profile.name}</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <UserCheck className="w-3 h-3" />
                      Active Candidate
                    </span>
                  </div>
                  <div className="text-xs text-[#6B7490] mt-0.5">
                    {data?.profile.currentTitle || 'Professional'} {data?.profile.currentCompany && `at ${data?.profile.currentCompany}`}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-[#6B7490]">
                    {data?.profile.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-gray-400" />
                        {data.profile.email}
                      </span>
                    )}
                    {data?.profile.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-gray-400" />
                        {data.profile.phone}
                      </span>
                    )}
                    {data?.profile.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        {data.profile.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Completeness Bar */}
              <div className="bg-[#F8FAFC] border border-[#E6E8F0] rounded-xl p-4 min-w-[240px]">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-[#1B2236]">Profile Completeness</span>
                  <span className="font-bold text-[#5B49D6]">{data?.profile.completenessScore || 0}%</span>
                </div>
                <div className="w-full bg-[#E6E8F0] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#5B49D6] h-full rounded-full transition-all duration-500"
                    style={{ width: `${data?.profile.completenessScore || 0}%` }}
                  />
                </div>
                <div className="text-[10px] text-[#6B7490] mt-2">
                  {data?.profile.completenessScore === 100
                    ? '🎉 Your candidate profile is 100% complete!'
                    : 'Add missing phone, location or skills to reach 100%.'}
                </div>
              </div>
            </div>
          </div>

          {/* Urgent Next Step Action Card */}
          {pendingInvitationApp && pendingInvitationApp.activeSlotInvitation ? (
            <div className="bg-gradient-to-r from-[#5B49D6] to-[#7B68EE] text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/20">
                  <Sparkles className="w-3 h-3" />
                  Action Required: Interview Invitation
                </div>
                <h3 className="text-lg font-bold">Choose your interview time for {pendingInvitationApp.jobTitle}</h3>
                <p className="text-xs text-white/80">
                  Round: <strong>{pendingInvitationApp.activeSlotInvitation.roundName}</strong>. Select an available time slot before the invitation expires.
                </p>
              </div>

              <Link
                href={`/schedule/${pendingInvitationApp.activeSlotInvitation.token}`}
                className="px-5 py-3 bg-white text-[#5B49D6] rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors shadow-sm shrink-0 text-center flex items-center justify-center gap-2"
              >
                <span>Select Time Slot</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          ) : nextInterview ? (
            <div className="bg-white border border-[#5B49D6]/30 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EEEBFB] text-[#5B49D6]">
                  Upcoming Interview
                </span>
                <h3 className="text-base font-bold text-[#1B2236]">{nextInterview.jobTitle} — {nextInterview.roundName}</h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B7490] pt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#5B49D6]" />
                    {new Date(nextInterview.scheduledAt).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#5B49D6]" />
                    {new Date(nextInterview.scheduledAt).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })} ({nextInterview.duration} mins)
                  </span>
                  <span className="flex items-center gap-1">
                    <Video className="w-3.5 h-3.5 text-[#12B76A]" />
                    {nextInterview.provider}
                  </span>
                </div>
              </div>

              {nextInterview.meetingLink && (
                <a
                  href={nextInterview.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 bg-[#5B49D6] text-white rounded-xl text-xs font-bold hover:bg-[#5B49D6]/90 transition-colors shadow-xs shrink-0 flex items-center justify-center gap-2"
                >
                  <Video className="w-4 h-4" />
                  <span>Join Video Call</span>
                </a>
              )}
            </div>
          ) : null}

          {/* Section: My Applications (Frame 14) */}
          <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-[#1B2236] flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#5B49D6]" />
                My Applications ({data?.applications.length || 0})
              </h3>
            </div>

            {data?.applications.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#6B7490]">
                No applications submitted yet.
              </div>
            ) : (
              <div className="space-y-3">
                {data?.applications.map((app: CandidateApplicationDTO) => (
                  <div
                    key={app.id}
                    className="p-4 rounded-xl border border-[#E6E8F0] hover:border-gray-300 transition-all bg-[#F8FAFC]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-[#1B2236]">{app.jobTitle}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            app.statusPillVariant === 'purple'
                              ? 'bg-[#EEEBFB] text-[#5B49D6]'
                              : app.statusPillVariant === 'blue'
                              ? 'bg-blue-50 text-blue-700'
                              : app.statusPillVariant === 'emerald'
                              ? 'bg-emerald-50 text-emerald-700'
                              : app.statusPillVariant === 'amber'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {app.status}
                        </span>
                      </div>
                      <div className="text-xs text-[#6B7490] mt-1">
                        {app.companyName} • {app.location} • Applied {app.appliedAt}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {app.activeSlotInvitation ? (
                        <Link
                          href={`/schedule/${app.activeSlotInvitation.token}`}
                          className="px-3.5 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-colors shadow-2xs"
                        >
                          Book Interview Slot
                        </Link>
                      ) : (
                        <div className="text-right">
                          <span className="text-[11px] text-[#6B7490] block">Next Step:</span>
                          <span className="text-xs font-semibold text-[#1B2236]">{app.nextStep}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Upcoming Interviews */}
          <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs">
            <h3 className="font-bold text-base text-[#1B2236] mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#5B49D6]" />
              Scheduled Interviews ({data?.upcomingInterviews.length || 0})
            </h3>

            {data?.upcomingInterviews.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#6B7490]">
                No scheduled interviews at this time.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data?.upcomingInterviews.map((interview: CandidateInterviewDTO) => (
                  <div
                    key={interview.id}
                    className="p-5 rounded-xl border border-[#E6E8F0] bg-white shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-sm text-[#1B2236]">{interview.jobTitle}</div>
                        <div className="text-xs text-[#5B49D6] font-semibold">{interview.roundName}</div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Confirmed
                      </span>
                    </div>

                    <div className="text-xs text-[#6B7490] space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>
                          {new Date(interview.scheduledAt).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>
                          {new Date(interview.scheduledAt).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}{' '}
                          ({interview.duration} mins) • {interview.timezone}
                        </span>
                      </div>
                    </div>

                    {interview.meetingLink && (
                      <div className="pt-2 border-t border-[#E6E8F0] flex items-center justify-between">
                        <span className="text-[11px] text-[#6B7490]">{interview.provider} Video Room</span>
                        <a
                          href={interview.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-colors shadow-2xs flex items-center gap-1.5"
                        >
                          <Video className="w-3 h-3" />
                          <span>Join Meeting</span>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Profile Edit Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-base text-[#1B2236]">Update Candidate Coordinates</h3>
            <p className="text-xs text-[#6B7490]">
              Keep your contact details up to date for interview coordination.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#1B2236] font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full p-2.5 rounded-lg border border-[#E6E8F0] focus:outline-none focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="block text-[#1B2236] font-semibold mb-1">Current Location</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="Mumbai, India"
                  className="w-full p-2.5 rounded-lg border border-[#E6E8F0] focus:outline-none focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="block text-[#1B2236] font-semibold mb-1">Skills (Comma-separated)</label>
                <input
                  type="text"
                  value={editSkills}
                  onChange={(e) => setEditSkills(e.target.value)}
                  placeholder="React, TypeScript, Next.js, Node.js"
                  className="w-full p-2.5 rounded-lg border border-[#E6E8F0] focus:outline-none focus:border-[#5B49D6]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6E8F0]">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="px-4 py-2 border border-[#E6E8F0] text-[#6B7490] rounded-lg text-xs font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingProfile}
                onClick={handleSaveProfile}
                className="px-4 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 disabled:opacity-50"
              >
                {isSavingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
