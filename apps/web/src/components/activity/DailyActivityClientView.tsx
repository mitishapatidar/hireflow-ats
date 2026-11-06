'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useTransition } from 'react';
import { PageHeader } from '../layout/PageHeader';
import {
  PhoneCall,
  Mail,
  Users,
  Send,
  CalendarCheck2,
  Clock,
  Plus,
  Settings2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { RecruiterActivityType } from '@hireflow/shared';
import {
  getRecruiterDailyActivityAction,
  logRecruiterActivityAction,
  updateRecruiterTargetAction,
} from '@/actions/activity';

interface DailyActivityClientViewProps {
  initialData: any;
}

export function DailyActivityClientView({ initialData }: DailyActivityClientViewProps) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Forms
  const [logForm, setLogForm] = useState({
    type: RecruiterActivityType.CALL,
    durationMinutes: 15,
    outcome: '',
    notes: '',
  });

  const [targetForm, setTargetForm] = useState({
    period: 'DAILY' as const,
    targetCandidatesSourced: data?.target?.targetCandidatesSourced || 10,
    targetCalls: data?.target?.targetCalls || 20,
    targetEmails: data?.target?.targetEmails || 15,
    targetSubmissions: data?.target?.targetSubmissions || 3,
    targetInterviews: data?.target?.targetInterviews || 2,
  });

  const refreshActivity = () => {
    startTransition(async () => {
      const res = await getRecruiterDailyActivityAction();
      if (res.success && res.data) {
        setData(res.data);
      }
    });
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    startTransition(async () => {
      const res = await logRecruiterActivityAction({
        type: logForm.type,
        durationMinutes: Number(logForm.durationMinutes),
        outcome: logForm.outcome || undefined,
        notes: logForm.notes,
      });

      if (!res.success) {
        setActionError(res.error || 'Failed to log activity');
      } else {
        setIsLogModalOpen(false);
        setLogForm({ type: RecruiterActivityType.CALL, durationMinutes: 15, outcome: '', notes: '' });
        setActionSuccess('Activity recorded successfully and targets updated.');
        setTimeout(() => setActionSuccess(null), 4000);
        refreshActivity();
      }
    });
  };

  const handleUpdateTargets = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    startTransition(async () => {
      const res = await updateRecruiterTargetAction(targetForm);
      if (!res.success) {
        setActionError(res.error || 'Failed to update targets');
      } else {
        setIsTargetModalOpen(false);
        setActionSuccess('Daily productivity targets updated successfully.');
        setTimeout(() => setActionSuccess(null), 4000);
        refreshActivity();
      }
    });
  };

  const summary = data?.summary || {};
  const sourced = summary.candidatesSourced || { count: 0, target: 10, progressPercentage: 0 };
  const calls = summary.callsMade || { count: 0, target: 20, progressPercentage: 0 };
  const emails = summary.emailsSent || { count: 0, target: 15, progressPercentage: 0 };
  const submissions = summary.submissionsSent || { count: 0, target: 3, progressPercentage: 0 };
  const interviews = summary.interviewsCompleted || { count: 0, target: 2, progressPercentage: 0 };
  const overallScore = summary.overallScorePercentage || 0;
  const asOfTimestamp = data?.asOfTimestamp || 'Live Sync';
  const recentActivities = data?.recentActivities || [];

  const activityMetrics = [
    {
      title: 'Candidates Sourced',
      icon: Users,
      data: sourced,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Calls Made',
      icon: PhoneCall,
      data: calls,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Emails Sent',
      icon: Mail,
      data: emails,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Client Submissions',
      icon: Send,
      data: submissions,
      color: 'bg-amber-500',
      textColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      title: 'Interviews Completed',
      icon: CalendarCheck2,
      data: interviews,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Recruiter Daily Activity"
        subtitle="Track today's outreach productivity, calls, submissions, and target achievements."
        breadcrumbs={[{ label: 'Daily Activity' }]}
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#F4F5FA] border border-[#E6E8F0] text-xs font-medium text-[#4A5568]">
              <Clock className="w-3.5 h-3.5 text-[#5B49D6]" />
              {asOfTimestamp}
            </span>
            <button
              onClick={refreshActivity}
              disabled={isPending}
              className="px-3 py-2 border border-[#E6E8F0] bg-white text-[#1B2236] rounded-lg text-xs font-semibold hover:bg-[#F9FAFB] transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setIsTargetModalOpen(true)}
              className="px-3.5 py-2 border border-[#5B49D6]/30 text-[#5B49D6] bg-[#EEEBFB]/50 rounded-lg text-xs font-semibold hover:bg-[#EEEBFB] transition-all flex items-center gap-1.5"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Edit Targets</span>
            </button>
            <button
              onClick={() => setIsLogModalOpen(true)}
              className="px-3.5 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Call / Activity</span>
            </button>
          </div>
        }
      />

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Overall Score Banner */}
      <div className="bg-white rounded-xl p-6 border border-[#E6E8F0] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#6B7490]">Overall Daily Score</span>
          <h2 className="text-2xl font-black text-[#1B2236] mt-1">
            {overallScore >= 100 ? 'Target Achieved! 🏆' : `${overallScore}% of Daily Goals Completed`}
          </h2>
          <p className="text-xs text-[#6B7490] mt-1">
            Calculated across candidates sourced, calls logged, outreach emails, client submissions, and completed interviews.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-3xl font-extrabold text-[#5B49D6]">{overallScore}%</div>
            <div className="text-[11px] text-[#6B7490]">Daily Velocity</div>
          </div>
          <div className="w-20 h-20 rounded-full border-4 border-[#EEEBFB] border-t-[#5B49D6] flex items-center justify-center font-bold text-lg text-[#5B49D6]">
            {overallScore}%
          </div>
        </div>
      </div>

      {/* 5 Target Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {activityMetrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <div
              key={idx}
              className="bg-white rounded-xl p-5 border border-[#E6E8F0] shadow-xs flex flex-col justify-between hover:border-[#CBD5E1] transition-all space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1B2236]">{m.title}</span>
                <div className={`p-2 rounded-lg ${m.bgColor} ${m.textColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-extrabold text-[#1B2236]">{m.data.count}</div>
                  <div className="text-xs text-[#64748B] font-semibold">/ {m.data.target} goal</div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] mb-1 font-medium">
                    <span className="text-[#64748B]">Progress</span>
                    <span className="text-[#1B2236] font-bold">{m.data.progressPercentage}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#F1F3F9] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${m.color}`}
                      style={{ width: `${Math.min(m.data.progressPercentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Logged Activity Table */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#F8FAFC] border-b border-[#E6E8F0] flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#1B2236]">Today&apos;s Outreach &amp; Activity Log</h3>
            <p className="text-[11px] text-[#64748B] mt-0.5">Calls, meetings, and outreach tasks logged today</p>
          </div>
          <button
            onClick={() => setIsLogModalOpen(true)}
            className="px-2.5 py-1 text-xs font-bold text-[#5B49D6] bg-white border border-[#CBD5E1] rounded hover:bg-[#F8FAFC]"
          >
            + Log Activity
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#64748B] font-bold uppercase tracking-wider text-[10px] border-b border-[#E6E8F0]">
              <tr>
                <th className="py-3 px-4">Time (IST)</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Counterpart / Entity</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Notes / Discussion</th>
                <th className="py-3 px-4">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8F0]">
              {recentActivities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#94A3B8]">
                    No calls or activities logged yet today. Click &quot;Log Call / Activity&quot; above.
                  </td>
                </tr>
              ) : (
                recentActivities.map((act: any) => (
                  <tr key={act.id} className="hover:bg-[#F8FAFC] transition-all">
                    <td className="py-3 px-4 whitespace-nowrap font-bold text-[#5B49D6]">{act.timeIST}</td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 uppercase">
                        {act.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-[#1E293B]">
                      {act.candidateName || act.clientName || act.opportunityName || 'General Outreach'}
                    </td>
                    <td className="py-3 px-4 text-[#64748B]">
                      {act.durationMinutes ? `${act.durationMinutes}m` : '-'}
                    </td>
                    <td className="py-3 px-4 text-[#334155] max-w-sm">{act.notes}</td>
                    <td className="py-3 px-4 text-emerald-700 font-medium">{act.outcome || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: LOG RECRUITER ACTIVITY */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
              <h3 className="text-sm font-bold text-[#1B2236]">Log Candidate Outreach or Call</h3>
              <button onClick={() => setIsLogModalOpen(false)}>
                <X className="w-4 h-4 text-[#94A3B8]" />
              </button>
            </div>

            <form onSubmit={handleLogActivity} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#334155] block mb-1">Activity Type *</label>
                <select
                  value={logForm.type}
                  onChange={(e) => setLogForm({ ...logForm, type: e.target.value as any })}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg bg-white"
                >
                  <option value={RecruiterActivityType.CALL}>Phone Call</option>
                  <option value={RecruiterActivityType.MEETING}>Meeting</option>
                  <option value={RecruiterActivityType.TASK}>Task</option>
                  <option value={RecruiterActivityType.NOTE}>Note / Touchpoint</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#334155] block mb-1">Duration (Minutes)</label>
                <input
                  type="number"
                  min="1"
                  value={logForm.durationMinutes}
                  onChange={(e) => setLogForm({ ...logForm, durationMinutes: parseInt(e.target.value, 10) || 15 })}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#334155] block mb-1">Notes / Call Summary *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Discussed compensation expectations and notice period..."
                  value={logForm.notes}
                  onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#334155] block mb-1">Outcome / Agreed Next Steps</label>
                <input
                  type="text"
                  placeholder="e.g. Candidate agreed to screening interview tomorrow"
                  value={logForm.outcome}
                  onChange={(e) => setLogForm({ ...logForm, outcome: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6E8F0]">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-3 py-1.5 border border-[#E6E8F0] rounded-lg text-xs font-semibold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 bg-[#5B49D6] text-white rounded-lg text-xs font-bold hover:bg-[#5B49D6]/90 disabled:opacity-50"
                >
                  Save Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT TARGETS */}
      {isTargetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
              <h3 className="text-sm font-bold text-[#1B2236]">Configure Daily Productivity Targets</h3>
              <button onClick={() => setIsTargetModalOpen(false)}>
                <X className="w-4 h-4 text-[#94A3B8]" />
              </button>
            </div>

            <form onSubmit={handleUpdateTargets} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#334155] block mb-1">Target Candidates Sourced</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={targetForm.targetCandidatesSourced}
                  onChange={(e) =>
                    setTargetForm({ ...targetForm, targetCandidatesSourced: parseInt(e.target.value, 10) || 10 })
                  }
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#334155] block mb-1">Target Calls Made</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={targetForm.targetCalls}
                  onChange={(e) => setTargetForm({ ...targetForm, targetCalls: parseInt(e.target.value, 10) || 20 })}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#334155] block mb-1">Target Emails Sent</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={targetForm.targetEmails}
                  onChange={(e) => setTargetForm({ ...targetForm, targetEmails: parseInt(e.target.value, 10) || 15 })}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#334155] block mb-1">Target Client Submissions</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={targetForm.targetSubmissions}
                  onChange={(e) =>
                    setTargetForm({ ...targetForm, targetSubmissions: parseInt(e.target.value, 10) || 3 })
                  }
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#334155] block mb-1">Target Interviews Completed</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={targetForm.targetInterviews}
                  onChange={(e) =>
                    setTargetForm({ ...targetForm, targetInterviews: parseInt(e.target.value, 10) || 2 })
                  }
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6E8F0]">
                <button
                  type="button"
                  onClick={() => setIsTargetModalOpen(false)}
                  className="px-3 py-1.5 border border-[#E6E8F0] rounded-lg text-xs font-semibold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 bg-[#5B49D6] text-white rounded-lg text-xs font-bold hover:bg-[#5B49D6]/90 disabled:opacity-50"
                >
                  Save Targets
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
