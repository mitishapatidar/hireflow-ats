'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useTransition } from 'react';
import {
  Zap,
  Plus,
  Play,
  Pause,
  Edit,
  Eye,
  History,
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  ChevronRight,
  Filter,
  Users,
  Mail,
  MessageSquare,
  Bell,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  getAutomationRulesAction,
  createAutomationRuleAction,
  updateAutomationRuleAction,
  activateAutomationRuleAction,
  pauseAutomationRuleAction,
  previewAutomationTemplateAction,
  getAutomationExecutionsAction,
} from '@/actions/automation';
import {
  AutomationTriggerEnum,
  AutomationRuleStatusEnum,
  NotificationChannelEnum,
  RecipientTypeEnum,
  SUPPORTED_MERGE_FIELDS,
} from '@hireflow/shared';

export default function AutomationAdminPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();

  // Modals & Drawers state
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [isExecutionLogOpen, setIsExecutionLogOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Rule Form state
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    triggerEvent: AutomationTriggerEnum.INTERVIEW_SCHEDULED,
    timingType: 'BEFORE_EVENT',
    durationMinutes: 1440,
    cron: '',
    clientScope: '',
    recipients: ['ASSIGNED_RECRUITER'],
    channels: [NotificationChannelEnum.IN_APP, NotificationChannelEnum.EMAIL],
    templateSubject: '',
    templateBody: '',
    status: AutomationRuleStatusEnum.ACTIVE,
  });

  // Preview form state
  const [previewTemplate, setPreviewTemplate] = useState({
    subject: '',
    body: '',
    isCandidateFacing: false,
    context: {
      first_name: 'Priya',
      candidate_name: 'Priya Sharma',
      client: 'Acme Technologies',
      job_title: 'Lead Full Stack Engineer',
      round: 'Technical Round 2',
      date: '10 Nov 2026',
      time: '3:30 PM IST',
      meeting_link: 'https://meet.google.com/abc-defg-hij',
      recruiter_name: 'Anika Rao',
      task_title: 'Prepare Offer Dossier',
      due_date: '12 Nov 2026',
    },
  });
  const [previewResult, setPreviewResult] = useState<any>(null);

  const loadRules = async () => {
    try {
      const res = await getAutomationRulesAction();
      if (res.success && res.rules) {
        setRules(res.rules);
      }
    } catch {
      // ignore
    }
  };

  const loadExecutions = async () => {
    try {
      const res = await getAutomationExecutionsAction(30, 0);
      if (res.success && res.items) {
        setExecutions(res.items);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    startTransition(() => {
      loadRules();
    });
  }, []);

  const handleOpenCreate = () => {
    setEditingRuleId(null);
    setRuleForm({
      name: '',
      description: '',
      triggerEvent: AutomationTriggerEnum.INTERVIEW_SCHEDULED,
      timingType: 'BEFORE_EVENT',
      durationMinutes: 1440,
      cron: '',
      clientScope: '',
      recipients: ['ASSIGNED_RECRUITER'],
      channels: [NotificationChannelEnum.IN_APP, NotificationChannelEnum.EMAIL],
      templateSubject: 'Upcoming Interview: {candidate_name} ({job_title})',
      templateBody: 'Hello {first_name},\n\nThis is a reminder for your upcoming interview for {job_title} on {date} at {time}.\nMeeting link: {meeting_link}',
      status: AutomationRuleStatusEnum.ACTIVE,
    });
    setIsRuleModalOpen(true);
  };

  const handleOpenEdit = (rule: any) => {
    setEditingRuleId(rule.id);
    const recipientsList = Array.isArray(rule.recipients)
      ? rule.recipients.map((r: any) => r.type)
      : ['ASSIGNED_RECRUITER'];

    setRuleForm({
      name: rule.name,
      description: rule.description || '',
      triggerEvent: rule.triggerEvent,
      timingType: rule.timing?.type || 'IMMEDIATE',
      durationMinutes: rule.timing?.durationMinutes || 0,
      cron: rule.timing?.cron || '',
      clientScope: rule.clientScope || '',
      recipients: recipientsList,
      channels: Array.isArray(rule.channels) ? rule.channels : [NotificationChannelEnum.IN_APP],
      templateSubject: rule.templateSubject || '',
      templateBody: rule.templateBody || '',
      status: rule.status,
    });
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.name.trim() || !ruleForm.templateBody.trim()) return;

    startTransition(async () => {
      const payload: any = {
        name: ruleForm.name,
        description: ruleForm.description || null,
        triggerEvent: ruleForm.triggerEvent,
        timing: {
          type: ruleForm.timingType,
          durationMinutes: ruleForm.timingType === 'BEFORE_EVENT' ? Number(ruleForm.durationMinutes) : undefined,
          cron: ruleForm.timingType === 'SCHEDULED_CRON' ? ruleForm.cron : undefined,
          timezone: 'Asia/Kolkata',
        },
        clientScope: ruleForm.clientScope ? ruleForm.clientScope : null,
        recipients: ruleForm.recipients.map((type) => ({ type })),
        channels: ruleForm.channels,
        templateSubject: ruleForm.templateSubject || null,
        templateBody: ruleForm.templateBody,
        status: ruleForm.status,
      };

      if (editingRuleId) {
        await updateAutomationRuleAction(editingRuleId, payload);
      } else {
        await createAutomationRuleAction(payload);
      }

      setIsRuleModalOpen(false);
      loadRules();
    });
  };

  const handleToggleStatus = async (rule: any) => {
    startTransition(async () => {
      if (rule.status === 'ACTIVE') {
        await pauseAutomationRuleAction(rule.id);
      } else {
        await activateAutomationRuleAction(rule.id);
      }
      loadRules();
    });
  };

  const handleOpenPreview = (rule: any) => {
    setPreviewTemplate({
      subject: rule.templateSubject || rule.name,
      body: rule.templateBody || '',
      isCandidateFacing: false,
      context: previewTemplate.context,
    });
    runPreview(rule.templateSubject || rule.name, rule.templateBody, false);
    setIsPreviewModalOpen(true);
  };

  const runPreview = async (subject: string, body: string, isCandidate: boolean) => {
    try {
      const res = await previewAutomationTemplateAction({
        templateSubject: subject,
        templateBody: body,
        context: previewTemplate.context,
        isCandidateFacing: isCandidate,
      });
      if (res.success) {
        setPreviewResult(res);
      }
    } catch {
      // ignore
    }
  };

  const formatIST = (dateInput: string | Date) => {
    return new Date(dateInput).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] p-6 sm:p-8">
      {/* Header (Figma Frame 36) */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#1E2A4A] flex items-center justify-center text-white shadow-md shadow-[#1E2A4A]/20">
              <Zap className="w-5 h-5 text-[#F59E0B]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1B2236]">Automation Rules Engine</h1>
              <p className="text-xs text-[#6B7490]">
                Admin automated workflows, reminders, client triggers, and message templates (Frame 36)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              loadExecutions();
              setIsExecutionLogOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-[#E6E8F0] text-[#1B2236] hover:bg-[#F6F7FB] transition-colors flex items-center gap-2 shadow-sm"
          >
            <History className="w-4 h-4 text-[#6B7490]" />
            <span>Execution History Log</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#5B49D6] text-white hover:bg-[#4C3CBD] transition-colors flex items-center gap-2 shadow-sm shadow-[#5B49D6]/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create Automation Rule</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Rules Table / Cards (Frame 36) */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-[#E6E8F0] flex items-center justify-between bg-[#F6F7FB]/40">
            <div>
              <h2 className="text-sm font-bold text-[#1B2236]">Configured Automation Rules ({rules.length})</h2>
              <p className="text-xs text-[#6B7490] mt-0.5">
                Idempotent execution with bounded retries, candidate-safe templates, and client scoping
              </p>
            </div>
            <button
              onClick={loadRules}
              className="p-1.5 rounded-lg border border-[#E6E8F0] bg-white text-[#6B7490] hover:text-[#1B2236] text-xs flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E6E8F0] bg-[#F6F7FB] text-[#6B7490] font-semibold">
                  <th className="py-3.5 px-4">Rule Name & Details</th>
                  <th className="py-3.5 px-4">Trigger & Schedule</th>
                  <th className="py-3.5 px-4">Client Scope</th>
                  <th className="py-3.5 px-4">Channels</th>
                  <th className="py-3.5 px-4">Version</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8F0]">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-[#F6F7FB]/50 transition-colors">
                    <td className="py-4 px-4 max-w-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#1B2236]">{rule.name}</span>
                      </div>
                      {rule.description && (
                        <p className="text-xs text-[#6B7490] mt-0.5 line-clamp-1">
                          {rule.description}
                        </p>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-[#EEEBFB] text-[#5B49D6] border border-[#5B49D6]/20 block w-max">
                        {rule.triggerEvent}
                      </span>
                      <span className="text-[11px] text-[#6B7490] mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {rule.timing?.durationMinutes
                          ? `${rule.timing.durationMinutes / 60}h before`
                          : rule.timing?.type || 'IMMEDIATE'}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      {rule.clientScope ? (
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-[#FEF3DC] text-[#F59E0B] border border-[#F59E0B]/30">
                          Client Specific
                        </span>
                      ) : (
                        <span className="text-[#6B7490]">All Organization</span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex gap-1">
                        {(rule.channels || []).map((ch: string) => (
                          <span
                            key={ch}
                            className="w-6 h-6 rounded flex items-center justify-center bg-[#F6F7FB] border border-[#E6E8F0] text-[#1B2236]"
                            title={ch}
                          >
                            {ch === 'EMAIL' ? (
                              <Mail className="w-3 h-3" />
                            ) : ch === 'WHATSAPP' ? (
                              <MessageSquare className="w-3 h-3" />
                            ) : (
                              <Bell className="w-3 h-3" />
                            )}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded font-mono text-xs font-semibold bg-[#F6F7FB] text-[#1B2236] border border-[#E6E8F0]">
                        v{rule.version || 1}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <button
                        onClick={() => handleToggleStatus(rule)}
                        className={`px-2.5 py-1 rounded-full font-bold text-[10px] flex items-center gap-1 border transition-colors ${
                          rule.status === 'ACTIVE'
                            ? 'bg-[#E3F6EC] text-[#12B76A] border-[#12B76A]/30 hover:bg-[#FDECEC] hover:text-[#E5484D]'
                            : 'bg-[#F6F7FB] text-[#6B7490] border-[#E6E8F0] hover:bg-[#E3F6EC] hover:text-[#12B76A]'
                        }`}
                      >
                        {rule.status === 'ACTIVE' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A]" />
                            <span>ACTIVE</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6B7490]" />
                            <span>{rule.status}</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenPreview(rule)}
                          className="p-1.5 rounded-lg border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#6B7490]"
                          title="Preview template"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(rule)}
                          className="p-1.5 rounded-lg border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#5B49D6]"
                          title="Edit rule"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT RULE MODAL (Frame 36) */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#E6E8F0] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0]">
              <h3 className="font-bold text-base text-[#1B2236]">
                {editingRuleId ? 'Edit Automation Rule' : 'New Automation Rule'}
              </h3>
              <button
                onClick={() => setIsRuleModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#F6F7FB] text-[#6B7490]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder="e.g. Interview Reminder 24 Hours Prior"
                  className="w-full px-3.5 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-none focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">Description</label>
                <input
                  type="text"
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                  placeholder="Summarize the intent and audience of this workflow"
                  className="w-full px-3.5 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-none focus:border-[#5B49D6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">Trigger Event</label>
                  <select
                    value={ruleForm.triggerEvent}
                    onChange={(e) => setRuleForm({ ...ruleForm, triggerEvent: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-none focus:border-[#5B49D6]"
                  >
                    <option value={AutomationTriggerEnum.INTERVIEW_SCHEDULED}>Interview Scheduled</option>
                    <option value={AutomationTriggerEnum.TASK_DUE}>Task Follow-up Due</option>
                    <option value={AutomationTriggerEnum.CANDIDATE_STAGE_CHANGE}>Candidate Stage Changed</option>
                    <option value={AutomationTriggerEnum.DAILY_DIGEST_SCHEDULE}>Daily Pending Digest (08:30 IST)</option>
                    <option value={AutomationTriggerEnum.EMAIL_RESUME_INGESTION}>Inbound Email Resume</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">Timing</label>
                  <select
                    value={ruleForm.timingType}
                    onChange={(e) => setRuleForm({ ...ruleForm, timingType: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-none focus:border-[#5B49D6]"
                  >
                    <option value="IMMEDIATE">Immediate</option>
                    <option value="BEFORE_EVENT">Before Event</option>
                    <option value="AFTER_EVENT">After Event</option>
                    <option value="SCHEDULED_CRON">Scheduled Cron</option>
                  </select>
                </div>
              </div>

              {ruleForm.timingType === 'BEFORE_EVENT' && (
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                    Duration Before Event (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={ruleForm.durationMinutes}
                    onChange={(e) => setRuleForm({ ...ruleForm, durationMinutes: Number(e.target.value) })}
                    placeholder="1440 for 24 hours, 30 for 30 minutes"
                    className="w-full px-3.5 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-none focus:border-[#5B49D6]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Client Scope (Optional Isolation)
                </label>
                <input
                  type="text"
                  value={ruleForm.clientScope}
                  onChange={(e) => setRuleForm({ ...ruleForm, clientScope: e.target.value })}
                  placeholder="Leave empty for organization-wide, or enter Client ID for exclusive rule"
                  className="w-full px-3.5 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-none focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">Subject Line</label>
                <input
                  type="text"
                  value={ruleForm.templateSubject}
                  onChange={(e) => setRuleForm({ ...ruleForm, templateSubject: e.target.value })}
                  placeholder="e.g. Reminder: Interview with {candidate_name} in 24 hours"
                  className="w-full px-3.5 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-none focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#1B2236]">Message Template Body *</label>
                  <span className="text-[11px] text-[#6B7490]">Click merge field to insert:</span>
                </div>

                {/* Merge field chips */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SUPPORTED_MERGE_FIELDS.map((field) => (
                    <button
                      key={field}
                      type="button"
                      onClick={() =>
                        setRuleForm({
                          ...ruleForm,
                          templateBody: `${ruleForm.templateBody} {${field}}`,
                        })
                      }
                      className="px-2 py-0.5 rounded bg-[#EEEBFB] text-[#5B49D6] text-[10px] font-mono hover:bg-[#5B49D6] hover:text-white transition-colors"
                    >
                      {`{${field}}`}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={4}
                  required
                  value={ruleForm.templateBody}
                  onChange={(e) => setRuleForm({ ...ruleForm, templateBody: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-none focus:border-[#5B49D6] font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E6E8F0]">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-[#E6E8F0] text-[#6B7490] hover:bg-[#F6F7FB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#5B49D6] text-white hover:bg-[#4C3CBD] shadow-sm disabled:opacity-50"
                >
                  Save Automation Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEMPLATE PREVIEW DRAWER */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-lg h-full p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0]">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-[#5B49D6]" />
                  <h3 className="font-bold text-base text-[#1B2236]">Template Live Preview</h3>
                </div>
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-[#F6F7FB] text-[#6B7490]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between p-3 bg-[#F6F7FB] rounded-xl border border-[#E6E8F0]">
                  <span className="text-xs font-semibold text-[#1B2236]">Target Audience:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setPreviewTemplate({ ...previewTemplate, isCandidateFacing: false });
                        runPreview(previewTemplate.subject, previewTemplate.body, false);
                      }}
                      className={`px-3 py-1 text-xs rounded-lg font-semibold transition-all ${
                        !previewTemplate.isCandidateFacing
                          ? 'bg-[#5B49D6] text-white'
                          : 'bg-white text-[#6B7490] border border-[#E6E8F0]'
                      }`}
                    >
                      Internal Staff
                    </button>
                    <button
                      onClick={() => {
                        setPreviewTemplate({ ...previewTemplate, isCandidateFacing: true });
                        runPreview(previewTemplate.subject, previewTemplate.body, true);
                      }}
                      className={`px-3 py-1 text-xs rounded-lg font-semibold transition-all ${
                        previewTemplate.isCandidateFacing
                          ? 'bg-[#5B49D6] text-white'
                          : 'bg-white text-[#6B7490] border border-[#E6E8F0]'
                      }`}
                    >
                      Candidate Facing
                    </button>
                  </div>
                </div>

                {previewResult && (
                  <div className="space-y-4">
                    {previewResult.sanitized && (
                      <div className="p-3 bg-[#FEF3DC] border border-[#F59E0B]/30 rounded-xl text-xs text-[#F59E0B] flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Sensitive internal notes or margin words were automatically redacted for candidate privacy.</span>
                      </div>
                    )}

                    <div>
                      <span className="text-[11px] font-bold text-[#6B7490] uppercase tracking-wider block mb-1">
                        Rendered Subject
                      </span>
                      <div className="p-3 bg-[#F6F7FB] rounded-lg border border-[#E6E8F0] text-xs font-semibold text-[#1B2236]">
                        {previewResult.renderedSubject || 'No subject'}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-[#6B7490] uppercase tracking-wider block mb-1">
                        Rendered Body
                      </span>
                      <div className="p-4 bg-white rounded-lg border border-[#E6E8F0] text-xs text-[#1B2236] whitespace-pre-wrap leading-relaxed shadow-sm font-sans">
                        {previewResult.renderedBody}
                      </div>
                    </div>

                    {previewResult.missingFields?.length > 0 && (
                      <div className="p-3 bg-[#FDECEC] border border-[#E5484D]/30 rounded-xl text-xs text-[#E5484D]">
                        Missing or unmapped variables: {previewResult.missingFields.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsPreviewModalOpen(false)}
              className="w-full py-2.5 text-xs font-semibold rounded-lg bg-[#5B49D6] text-white hover:bg-[#4C3CBD] shadow-sm"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* EXECUTION LOG DRAWER (Frame 36) */}
      {isExecutionLogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0]">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-[#5B49D6]" />
                  <h3 className="font-bold text-base text-[#1B2236]">Execution History Log</h3>
                </div>
                <button
                  onClick={() => setIsExecutionLogOpen(false)}
                  className="p-1 rounded-lg hover:bg-[#F6F7FB] text-[#6B7490]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 max-h-[75vh] overflow-y-auto space-y-3">
                {executions.map((exec) => (
                  <div
                    key={exec.id}
                    className="p-3.5 rounded-xl border border-[#E6E8F0] bg-[#F6F7FB]/40 flex items-start justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[#1B2236]">
                          {exec.rule?.name || 'Automation Event'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            exec.status === 'SUCCESS'
                              ? 'bg-[#E3F6EC] text-[#12B76A]'
                              : exec.status === 'FAILED'
                              ? 'bg-[#FDECEC] text-[#E5484D]'
                              : 'bg-[#FEF3DC] text-[#F59E0B]'
                          }`}
                        >
                          {exec.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6B7490] mt-1 font-mono">
                        Key: {exec.idempotencyKey}
                      </p>
                      {exec.failureReason && (
                        <p className="text-[11px] text-[#E5484D] mt-1">
                          Error: {exec.failureReason}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-[#6B7490] shrink-0">
                      {formatIST(exec.startedAt)}
                    </span>
                  </div>
                ))}

                {executions.length === 0 && (
                  <div className="py-12 text-center text-xs text-[#6B7490]">
                    No executions recorded yet.
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsExecutionLogOpen(false)}
              className="w-full py-2.5 text-xs font-semibold rounded-lg bg-white border border-[#E6E8F0] text-[#1B2236] hover:bg-[#F6F7FB]"
            >
              Close Log
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
