'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mail,
  MessageSquare,
  Users,
  Send,
  Calendar,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Clock,
  Sparkles,
  ShieldCheck,
  Info,
  HelpCircle,
  Eye,
  FileText,
  Loader2,
  Smartphone,
  Check,
} from 'lucide-react';
import {
  CampaignChannel,
  calculateSmsSegments,
  replaceMergeFields,
} from '@hireflow/shared';
import {
  createCampaignDraftAction,
  updateCampaignDraftAction,
  calculateCampaignAudienceAction,
  sendTestCampaignAction,
  scheduleCampaignAction,
} from '@/actions/campaigns';

interface CampaignWizardClientProps {
  templates: any[];
  jobs: { id: string; title: string; code: string }[];
  initialDraft?: any;
}

export function CampaignWizardClient({
  templates,
  jobs,
  initialDraft,
}: CampaignWizardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Wizard Step (1, 2, 3)
  const [step, setStep] = useState<number>(1);

  // Form State
  const [draftId, setDraftId] = useState<string | null>(initialDraft?.id || null);
  const [name, setName] = useState<string>(initialDraft?.name || '');
  const [channel, setChannel] = useState<CampaignChannel>(
    (initialDraft?.channel as CampaignChannel) || CampaignChannel.EMAIL
  );
  const [senderIdentity, setSenderIdentity] = useState<string>(
    initialDraft?.senderIdentity || 'HireFlow Talent Team <careers@hireflow.app>'
  );
  const [replyTo, setReplyTo] = useState<string>(initialDraft?.replyTo || '');
  
  // Audience Filters
  const [queryFilter, setQueryFilter] = useState<string>(
    initialDraft?.audienceFilters?.query || ''
  );
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>(
    initialDraft?.audienceFilters?.jobIds || []
  );
  const [tagsInput, setTagsInput] = useState<string>(
    (initialDraft?.audienceFilters?.tags || []).join(', ')
  );
  const [skillsInput, setSkillsInput] = useState<string>(
    (initialDraft?.audienceFilters?.skills || []).join(', ')
  );

  // Audience Validation Results
  const [audienceResult, setAudienceResult] = useState<any>(null);
  const [isCalculatingAudience, setIsCalculatingAudience] = useState<boolean>(false);
  const [audienceError, setAudienceError] = useState<string | null>(null);

  // Message Composer State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    initialDraft?.templateId || ''
  );
  const [subject, setSubject] = useState<string>(initialDraft?.subject || '');
  const [body, setBody] = useState<string>(initialDraft?.body || '');
  const [dltSenderId, setDltSenderId] = useState<string>(
    initialDraft?.dltSenderId || initialDraft?.dltHeaderId || 'AURCAP'
  );
  const [dltTemplateId, setDltTemplateId] = useState<string>(
    initialDraft?.dltTemplateId || '1107168923482910394'
  );
  const [dltEntityId, setDltEntityId] = useState<string>(
    initialDraft?.dltEntityId || '1101524390000012345'
  );

  // Test Send State
  const [testRecipient, setTestRecipient] = useState<string>('');
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(
    null
  );

  // Review & Schedule State
  const [sendMode, setSendMode] = useState<'IMMEDIATE' | 'SCHEDULED'>('IMMEDIATE');
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState<string>('14:30');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Computed SMS Segments
  const smsSegments = useMemo(() => {
    return calculateSmsSegments(body);
  }, [body]);

  // Handle template selection change
  const handleTemplateSelect = (tId: string) => {
    setSelectedTemplateId(tId);
    if (!tId) return;
    const t = templates.find((item) => item.id === tId);
    if (t) {
      if (t.subject && !subject) setSubject(t.subject);
      if (t.body) setBody(t.body);
      if (t.dltSenderId) setDltSenderId(t.dltSenderId);
      if (t.dltTemplateId) setDltTemplateId(t.dltTemplateId);
    }
  };

  // Insert merge tag into subject or body
  const handleInsertMergeTag = (tag: string, target: 'subject' | 'body') => {
    if (target === 'subject') {
      setSubject((prev) => prev + ` {{${tag}}}`);
    } else {
      setBody((prev) => prev + ` {{${tag}}}`);
    }
  };

  // 1. Calculate Audience
  const handleCalculateAudience = async () => {
    setIsCalculatingAudience(true);
    setAudienceError(null);
    try {
      const parsedTags = tagsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const parsedSkills = skillsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await calculateCampaignAudienceAction({
        channel,
        filters: {
          query: queryFilter.trim() || undefined,
          jobIds: selectedJobIds.length > 0 ? selectedJobIds : undefined,
          tags: parsedTags.length > 0 ? parsedTags : undefined,
          skills: parsedSkills.length > 0 ? parsedSkills : undefined,
        },
      });

      if (!res.success) {
        setAudienceError(res.error || 'Failed to evaluate audience');
      } else {
        setAudienceResult(res.data);
      }
    } catch (err: any) {
      setAudienceError(err.message || 'Error evaluating audience');
    } finally {
      setIsCalculatingAudience(false);
    }
  };

  // Save draft helper
  const handleSaveDraft = async () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Campaign title is required.');
      return null;
    }

    const parsedTags = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedSkills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: any = {
      name: name.trim(),
      channel,
      senderIdentity: senderIdentity.trim() || undefined,
      replyTo: replyTo.trim() || undefined,
      templateId: selectedTemplateId || undefined,
      subject: channel === CampaignChannel.EMAIL ? subject.trim() : undefined,
      body: body.trim(),
      dltSenderId: channel === CampaignChannel.SMS ? dltSenderId.trim() : undefined,
      dltTemplateId: channel === CampaignChannel.SMS ? dltTemplateId.trim() : undefined,
      dltEntityId: channel === CampaignChannel.SMS ? dltEntityId.trim() : undefined,
      audienceFilters: {
        query: queryFilter.trim() || undefined,
        jobIds: selectedJobIds.length > 0 ? selectedJobIds : undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
        skills: parsedSkills.length > 0 ? parsedSkills : undefined,
      },
    };

    if (draftId) {
      const res = await updateCampaignDraftAction(draftId, payload);
      if (!res.success || !res.data) {
        setFormError(res.error || 'Failed to update draft');
        return null;
      }
      return res.data;
    } else {
      const res = await createCampaignDraftAction(payload);
      if (!res.success || !res.data) {
        setFormError(res.error || 'Failed to create draft');
        return null;
      }
      setDraftId(res.data.id);
      return res.data;
    }
  };

  // Send Test Message
  const handleSendTest = async () => {
    if (!testRecipient.trim()) {
      setTestResult({
        success: false,
        message: channel === CampaignChannel.EMAIL ? 'Enter a valid recipient email.' : 'Enter a valid phone number (+91...).',
      });
      return;
    }

    if (!body.trim()) {
      setTestResult({ success: false, message: 'Message body cannot be empty.' });
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const res = await sendTestCampaignAction({
        channel,
        recipient: testRecipient.trim(),
        subject: channel === CampaignChannel.EMAIL ? subject.trim() : undefined,
        body: body.trim(),
        dltSenderId: channel === CampaignChannel.SMS ? dltSenderId.trim() : undefined,
        dltTemplateId: channel === CampaignChannel.SMS ? dltTemplateId.trim() : undefined,
      });

      if (!res.success) {
        setTestResult({ success: false, message: res.error || 'Failed to send test message' });
      } else {
        setTestResult({
          success: true,
          message: `Test ${channel} successfully dispatched to ${testRecipient.trim()}! Check delivery log.`,
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Error sending test message' });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Launch / Schedule Final Campaign
  const handleLaunchCampaign = async () => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      // 1. Ensure draft is created/updated
      const savedCampaign = await handleSaveDraft();
      if (!savedCampaign) {
        setIsSubmitting(false);
        return;
      }

      // 2. Validate scheduling time
      let scheduledAtIso: string | undefined = undefined;
      if (sendMode === 'SCHEDULED') {
        const fullDateStr = `${scheduledDate}T${scheduledTime}:00`;
        const dateObj = new Date(fullDateStr);
        if (isNaN(dateObj.getTime()) || dateObj.getTime() <= Date.now()) {
          setFormError('Scheduled time must be in the future.');
          setIsSubmitting(false);
          return;
        }
        scheduledAtIso = dateObj.toISOString();
      }

      // 3. Invoke schedule action
      const schedRes = await scheduleCampaignAction(savedCampaign.id, {
        sendNow: sendMode === 'IMMEDIATE',
        scheduledAt: scheduledAtIso,
      });

      if (!schedRes.success) {
        setFormError(schedRes.error || 'Failed to schedule campaign');
        setIsSubmitting(false);
        return;
      }

      // 4. Redirect to campaign details view
      router.push(`/communications/campaigns/${savedCampaign.id}`);
    } catch (err: any) {
      setFormError(err.message || 'Error launching campaign');
      setIsSubmitting(false);
    }
  };

  // Advance to Step 2
  const handleGoToStep2 = async () => {
    if (!name.trim()) {
      setFormError('Campaign title is required.');
      return;
    }
    setFormError(null);
    // If audience was not calculated yet, run calculation
    if (!audienceResult) {
      await handleCalculateAudience();
    }
    setStep(2);
  };

  // Advance to Step 3
  const handleGoToStep3 = () => {
    if (channel === CampaignChannel.EMAIL && !subject.trim()) {
      setFormError('Subject is required for email campaigns.');
      return;
    }
    if (!body.trim()) {
      setFormError('Message body is required.');
      return;
    }
    if (channel === CampaignChannel.SMS) {
      if (!dltSenderId || dltSenderId.trim().length !== 6) {
        setFormError('TRAI DLT Sender ID must be exactly 6 alphanumeric characters.');
        return;
      }
      if (!dltTemplateId || !/^\d{10,25}$/.test(dltTemplateId.trim())) {
        setFormError('TRAI DLT Template ID must be a valid registered numeric ID.');
        return;
      }
    }
    setFormError(null);
    setStep(3);
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-[#E6E8F0] px-8 py-5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7490] mb-1">
              <Link href="/communications/campaigns" className="hover:text-[#5B49D6]">
                Bulk Campaigns
              </Link>
              <span>/</span>
              <span className="text-[#5B49D6]">New Campaign</span>
            </div>
            <h1 className="text-2xl font-bold text-[#1B2236] tracking-tight">
              Create Omnichannel Campaign
            </h1>
            <p className="text-xs text-[#6B7490] mt-0.5">
              Targeted candidate outreach adhering to TRAI DLT compliance and candidate consent isolation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isPending}
              className="px-3.5 py-2 text-xs font-medium text-[#1B2236] bg-[#F4F5FA] hover:bg-[#EBECEF] rounded-xl border border-[#E6E8F0] transition-colors"
            >
              Save Draft
            </button>
            <Link
              href="/communications/campaigns"
              className="px-3.5 py-2 text-xs font-medium text-[#6B7490] hover:text-[#1B2236] rounded-xl transition-colors"
            >
              Cancel
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-8 pt-8 space-y-6">
        {/* Step Indicator Progress Bar */}
        <div className="bg-white p-4 rounded-2xl border border-[#E6E8F0] shadow-xs">
          <div className="grid grid-cols-3 gap-2">
            <div
              className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${
                step === 1
                  ? 'bg-[#EEEBFB] text-[#5B49D6]'
                  : step > 1
                  ? 'text-emerald-700'
                  : 'text-[#6B7490]'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  step === 1
                    ? 'bg-[#5B49D6] text-white'
                    : step > 1
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#E6E8F0] text-[#6B7490]'
                }`}
              >
                {step > 1 ? <Check className="w-3.5 h-3.5" /> : '1'}
              </div>
              <div className="hidden sm:block">
                <span className="text-xs font-bold block">1. Audience Target</span>
                <span className="text-[10px] text-[#6B7490]">Consent & Segments</span>
              </div>
            </div>

            <div
              className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${
                step === 2
                  ? 'bg-[#EEEBFB] text-[#5B49D6]'
                  : step > 2
                  ? 'text-emerald-700'
                  : 'text-[#6B7490]'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  step === 2
                    ? 'bg-[#5B49D6] text-white'
                    : step > 2
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#E6E8F0] text-[#6B7490]'
                }`}
              >
                {step > 2 ? <Check className="w-3.5 h-3.5" /> : '2'}
              </div>
              <div className="hidden sm:block">
                <span className="text-xs font-bold block">2. Compose & DLT</span>
                <span className="text-[10px] text-[#6B7490]">Message & Verification</span>
              </div>
            </div>

            <div
              className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${
                step === 3
                  ? 'bg-[#EEEBFB] text-[#5B49D6]'
                  : 'text-[#6B7490]'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  step === 3
                    ? 'bg-[#5B49D6] text-white'
                    : 'bg-[#E6E8F0] text-[#6B7490]'
                }`}
              >
                3
              </div>
              <div className="hidden sm:block">
                <span className="text-xs font-bold block">3. Review & Schedule</span>
                <span className="text-[10px] text-[#6B7490]">IST Dispatch Time</span>
              </div>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {formError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
            <button
              onClick={() => setFormError(null)}
              className="text-rose-600 hover:text-rose-800 font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* ========================================================
            STEP 1: AUDIENCE SELECTION & VALIDATION
        ======================================================== */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-[#E6E8F0] shadow-xs space-y-5">
              <h2 className="text-base font-bold text-[#1B2236] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#5B49D6]" />
                Campaign Basics & Channel Selection
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1B2236] mb-1">
                    Campaign Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Q4 Senior Java Backend Engineers Outreach"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl px-3 py-2.5 text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2236] mb-1">
                    Outreach Channel <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setChannel(CampaignChannel.EMAIL);
                        setAudienceResult(null);
                      }}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        channel === CampaignChannel.EMAIL
                          ? 'bg-[#EEEBFB] border-[#5B49D6] text-[#5B49D6]'
                          : 'bg-[#F8F9FC] border-[#E6E8F0] text-[#6B7490] hover:text-[#1B2236]'
                      }`}
                    >
                      <Mail className="w-4 h-4" />
                      <span>Email Blast</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setChannel(CampaignChannel.SMS);
                        setAudienceResult(null);
                      }}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        channel === CampaignChannel.SMS
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-700'
                          : 'bg-[#F8F9FC] border-[#E6E8F0] text-[#6B7490] hover:text-[#1B2236]'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>SMS (TRAI DLT)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sender Identities */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#E6E8F0]">
                <div>
                  <label className="block text-xs font-bold text-[#1B2236] mb-1">
                    Sender Identity / From Display
                  </label>
                  <input
                    type="text"
                    value={senderIdentity}
                    onChange={(e) => setSenderIdentity(e.target.value)}
                    placeholder="e.g. Aureva Capital Careers <careers@aurevacapital.com>"
                    className="w-full text-xs bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl px-3 py-2 text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                  />
                  <p className="text-[11px] text-[#6B7490] mt-1">
                    Recipients see this name and email address in their inbox.
                  </p>
                </div>

                {channel === CampaignChannel.EMAIL && (
                  <div>
                    <label className="block text-xs font-bold text-[#1B2236] mb-1">
                      Reply-To Address (Optional)
                    </label>
                    <input
                      type="email"
                      value={replyTo}
                      onChange={(e) => setReplyTo(e.target.value)}
                      placeholder="e.g. talent-inbound@aurevacapital.com"
                      className="w-full text-xs bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl px-3 py-2 text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                    />
                    <p className="text-[11px] text-[#6B7490] mt-1">
                      Candidate direct replies will route here.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Audience Targeting Filters */}
            <div className="bg-white p-6 rounded-2xl border border-[#E6E8F0] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1B2236]">Audience Filters & Criteria</h3>
                  <p className="text-xs text-[#6B7490] mt-0.5">
                    Select criteria to pull candidate profiles from your database.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCalculateAudience}
                  disabled={isCalculatingAudience}
                  className="flex items-center gap-2 px-3.5 py-2 bg-[#5B49D6] hover:bg-[#4D3DC2] text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {isCalculatingAudience ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Users className="w-3.5 h-3.5" />
                  )}
                  <span>Calculate Audience</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1B2236] mb-1">
                    Target Jobs (Optional)
                  </label>
                  <select
                    multiple
                    value={selectedJobIds}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                      setSelectedJobIds(selected);
                    }}
                    className="w-full text-xs bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl px-3 py-2 text-[#1B2236] h-24 focus:outline-none focus:border-[#5B49D6]"
                  >
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} ({j.code})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-[#6B7490]">Hold Ctrl/Cmd to select multiple jobs.</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1B2236] mb-1">
                      Search Query / Keywords
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Node.js, Fintech, Bengaluru"
                      value={queryFilter}
                      onChange={(e) => setQueryFilter(e.target.value)}
                      className="w-full text-xs bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl px-3 py-2 text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1B2236] mb-1">
                      Tags (Comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Priority, Sourced, Ex-Google"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      className="w-full text-xs bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl px-3 py-2 text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                    />
                  </div>
                </div>
              </div>

              {/* Audience Validation Results Box */}
              {audienceError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                  {audienceError}
                </div>
              )}

              {audienceResult && (
                <div className="mt-4 p-4 rounded-xl bg-[#F8F9FC] border border-[#E6E8F0] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6E8F0] pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-[#1B2236]">
                          {audienceResult.eligibleCount} Eligible Recipients
                        </div>
                        <div className="text-[11px] text-[#6B7490]">
                          {audienceResult.totalEvaluated} total candidate records evaluated
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {audienceResult.eligibleCount} Validated
                      </span>
                      <span className="px-2.5 py-1 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        {audienceResult.excludedCount} Excluded
                      </span>
                    </div>
                  </div>

                  {/* Exclusion Reasons Breakdown */}
                  {audienceResult.excludedCount > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-[#6B7490] uppercase tracking-wider block mb-2">
                        Exclusion & Consent Breakdown
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="p-2.5 rounded-xl bg-white border border-[#E6E8F0]">
                          <span className="text-[10px] text-[#6B7490] block">No Email / Phone</span>
                          <span className="text-sm font-bold text-[#1B2236]">
                            {audienceResult.exclusionBreakdown?.NO_EMAIL ||
                              audienceResult.exclusionBreakdown?.NO_PHONE ||
                              0}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-[#E6E8F0]">
                          <span className="text-[10px] text-[#6B7490] block">No SMS Opt-In</span>
                          <span className="text-sm font-bold text-amber-700">
                            {audienceResult.exclusionBreakdown?.NO_SMS_CONSENT || 0}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-[#E6E8F0]">
                          <span className="text-[10px] text-[#6B7490] block">Unsubscribed</span>
                          <span className="text-sm font-bold text-rose-700">
                            {audienceResult.exclusionBreakdown?.UNSUBSCRIBED ||
                              audienceResult.exclusionBreakdown?.OPTED_OUT ||
                              0}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-[#E6E8F0]">
                          <span className="text-[10px] text-[#6B7490] block">Invalid Format</span>
                          <span className="text-sm font-bold text-gray-700">
                            {audienceResult.exclusionBreakdown?.INVALID_FORMAT || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sample Candidate Previews */}
                  {audienceResult.sampleEligible?.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-[#6B7490] uppercase tracking-wider block mb-1.5">
                        Sample Eligible Candidates ({audienceResult.sampleEligible.length})
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {audienceResult.sampleEligible.slice(0, 6).map((c: any) => (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-white border border-[#E6E8F0] text-[#1B2236]"
                          >
                            <span className="font-semibold">{c.name}</span>
                            <span className="text-[11px] text-[#6B7490]">
                              ({channel === CampaignChannel.EMAIL ? c.email : c.phone})
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions Step 1 */}
            <div className="flex items-center justify-between pt-2">
              <Link
                href="/communications/campaigns"
                className="text-xs font-semibold text-[#6B7490] hover:text-[#1B2236]"
              >
                Cancel & Exit
              </Link>
              <button
                type="button"
                onClick={handleGoToStep2}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#5B49D6] hover:bg-[#4D3DC2] text-white rounded-xl text-xs font-semibold transition-colors"
              >
                <span>Continue to Message Composer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 2: MESSAGE COMPOSER & DLT COMPLIANCE
        ======================================================== */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-[#E6E8F0] shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[#1B2236] flex items-center gap-2">
                    {channel === CampaignChannel.EMAIL ? (
                      <Mail className="w-4 h-4 text-[#5B49D6]" />
                    ) : (
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                    )}
                    {channel === CampaignChannel.EMAIL ? 'Email Composer' : 'SMS Composer & DLT Settings'}
                  </h2>
                  <p className="text-xs text-[#6B7490] mt-0.5">
                    Write targeted outreach copy and configure compliance headers.
                  </p>
                </div>

                {/* Template Preset Dropdown */}
                {templates.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[#6B7490]">Template:</span>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => handleTemplateSelect(e.target.value)}
                      className="text-xs bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl px-3 py-1.5 text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                    >
                      <option value="">Load from saved template...</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.category})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Merge Fields Quick Insert Buttons */}
              <div className="p-3 bg-[#F8F9FC] rounded-xl border border-[#E6E8F0]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[#6B7490] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#5B49D6]" />
                    Available Merge Tags
                  </span>
                  <span className="text-[10px] text-[#6B7490]">
                    Auto-replaces with candidate & job profile values
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['first_name', 'full_name', 'job_title', 'company', 'recruiter_name', 'application_link'].map(
                    (tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleInsertMergeTag(tag, 'body')}
                        className="px-2 py-1 bg-white hover:bg-[#EEEBFB] hover:text-[#5B49D6] border border-[#E6E8F0] text-[11px] font-mono rounded-md text-[#1B2236] transition-colors"
                      >
                        {`{{${tag}}}`}
                      </button>
                    )
                  )}
                  {channel === CampaignChannel.EMAIL && (
                    <button
                      type="button"
                      onClick={() => handleInsertMergeTag('unsubscribe_link', 'body')}
                      className="px-2 py-1 bg-white hover:bg-rose-50 hover:text-rose-700 border border-[#E6E8F0] text-[11px] font-mono rounded-md text-[#1B2236] transition-colors"
                    >
                      {'{{unsubscribe_link}}'}
                    </button>
                  )}
                </div>
              </div>

              {/* Email Specific Inputs */}
              {channel === CampaignChannel.EMAIL && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-[#1B2236]">
                        Subject Line <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleInsertMergeTag('first_name', 'subject')}
                        className="text-[11px] text-[#5B49D6] hover:underline"
                      >
                        + Add {'{{first_name}}'}
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Exciting Opportunity: Senior Backend Engineer at {{company}}"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full text-xs bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl px-3 py-2 text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1B2236] mb-1">
                      Email Body (HTML / Plain Text) <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={8}
                      placeholder="Hi {{first_name}},&#10;&#10;We came across your profile and were impressed with your background..."
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="w-full text-xs font-mono bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl p-3 text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                    />
                  </div>

                  {/* Unsubscribe Legal Footer Notice */}
                  <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 flex items-start gap-3 text-xs text-[#1B2236]">
                    <ShieldCheck className="w-4 h-4 text-[#5B49D6] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">1-Click Unsubscribe Guarantee</span>
                      <p className="text-[11px] text-[#6B7490] mt-0.5">
                        In accordance with privacy and anti-spam standards, HireFlow will automatically append a signed, 1-click unsubscribe token link at the bottom of each email.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SMS & TRAI DLT Specific Inputs */}
              {channel === CampaignChannel.SMS && (
                <div className="space-y-4">
                  {/* TRAI DLT Headers Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                    <div>
                      <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                        TRAI Sender ID (Header) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="e.g. AURCAP"
                        value={dltSenderId}
                        onChange={(e) => setDltSenderId(e.target.value.toUpperCase())}
                        className="w-full text-xs font-mono uppercase bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 text-emerald-950 focus:outline-none focus:border-emerald-600"
                      />
                      <span className="text-[10px] text-emerald-800">Exactly 6 alphanumeric chars</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                        DLT Template ID (TID) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 1107168923482910394"
                        value={dltTemplateId}
                        onChange={(e) => setDltTemplateId(e.target.value.trim())}
                        className="w-full text-xs font-mono bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 text-emerald-950 focus:outline-none focus:border-emerald-600"
                      />
                      <span className="text-[10px] text-emerald-800">Registered 19-digit number</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                        Principal Entity ID (PEID)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 1101524390000012345"
                        value={dltEntityId}
                        onChange={(e) => setDltEntityId(e.target.value.trim())}
                        className="w-full text-xs font-mono bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 text-emerald-950 focus:outline-none focus:border-emerald-600"
                      />
                      <span className="text-[10px] text-emerald-800">Enterprise Entity ID</span>
                    </div>
                  </div>

                  {/* SMS Body & Live Segment Calculation */}
                  <div>
                    <label className="block text-xs font-bold text-[#1B2236] mb-1">
                      SMS Message Content <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Hi {{first_name}}, Aureva Capital is hiring a {{job_title}}. Check: {{application_link}} - Reply STOP to opt out"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="w-full text-xs font-mono bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl p-3 text-[#1B2236] focus:outline-none focus:border-emerald-600"
                    />

                    {/* Segment and Encoding Info */}
                    <div className="flex items-center justify-between text-xs mt-1.5 text-[#6B7490]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#1B2236]">
                          {smsSegments.characterCount} characters
                        </span>
                        <span>·</span>
                        <span className="font-medium">
                          {smsSegments.remainingInSegment} remaining in segment
                        </span>
                        <span>·</span>
                        <span className="font-bold text-[#5B49D6]">
                          {smsSegments.segmentCount} {smsSegments.segmentCount === 1 ? 'Segment' : 'Segments'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-semibold ${
                            smsSegments.isUnicode
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {smsSegments.isUnicode ? 'UCS-2 (Unicode - max 70/seg)' : 'GSM-7 (Standard - max 160/seg)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Test Message Dispatch Section */}
              <div className="p-4 rounded-xl bg-[#F8F9FC] border border-[#E6E8F0] space-y-3">
                <span className="text-xs font-bold text-[#1B2236] flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-[#5B49D6]" />
                  Verify with Test Dispatch
                </span>
                <p className="text-[11px] text-[#6B7490]">
                  Send a single preview message to verify merge tags, TRAI DLT header, and provider formatting before initiating bulk blast.
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <input
                    type={channel === CampaignChannel.EMAIL ? 'email' : 'tel'}
                    placeholder={
                      channel === CampaignChannel.EMAIL
                        ? 'e.g. recruiter@aurevacapital.com'
                        : 'e.g. +919876543210'
                    }
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    className="flex-1 text-xs bg-white border border-[#E6E8F0] rounded-xl px-3 py-2 text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                  />
                  <button
                    type="button"
                    onClick={handleSendTest}
                    disabled={isSendingTest}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-[#E6E8F0] rounded-xl text-xs font-semibold text-[#1B2236] transition-colors disabled:opacity-50"
                  >
                    {isSendingTest ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 text-[#5B49D6]" />
                    )}
                    <span>Send Test</span>
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Step 2 */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-2 text-xs font-semibold text-[#6B7490] hover:text-[#1B2236]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Audience</span>
              </button>
              <button
                type="button"
                onClick={handleGoToStep3}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#5B49D6] hover:bg-[#4D3DC2] text-white rounded-xl text-xs font-semibold transition-colors"
              >
                <span>Continue to Review & Schedule</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 3: REVIEW & SCHEDULE (IST TIMEZONE)
        ======================================================== */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-[#E6E8F0] shadow-xs space-y-6">
              <h2 className="text-base font-bold text-[#1B2236] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5B49D6]" />
                Review Campaign & Schedule Launch
              </h2>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#F8F9FC] border border-[#E6E8F0]">
                  <span className="text-[11px] font-bold text-[#6B7490] uppercase tracking-wider block">
                    Campaign & Channel
                  </span>
                  <div className="font-bold text-[#1B2236] text-sm mt-1">{name}</div>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-[#5B49D6]">
                    {channel === CampaignChannel.EMAIL ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                    <span>{channel === CampaignChannel.EMAIL ? 'Email Outreach' : 'SMS (DLT)'}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F8F9FC] border border-[#E6E8F0]">
                  <span className="text-[11px] font-bold text-[#6B7490] uppercase tracking-wider block">
                    Validated Audience
                  </span>
                  <div className="font-black text-[#1B2236] text-xl mt-1">
                    {audienceResult?.eligibleCount || 0}
                  </div>
                  <div className="text-[11px] text-[#6B7490] mt-1">
                    All candidates verified with active opt-in consent
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F8F9FC] border border-[#E6E8F0]">
                  <span className="text-[11px] font-bold text-[#6B7490] uppercase tracking-wider block">
                    Compliance Verification
                  </span>
                  <div className="text-xs font-bold text-emerald-700 mt-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    {channel === CampaignChannel.EMAIL ? 'Unsubscribe Token Active' : 'TRAI DLT Verified'}
                  </div>
                  <p className="text-[11px] text-[#6B7490] mt-1">
                    {channel === CampaignChannel.EMAIL
                      ? 'RFC-8058 compliant 1-click unsubscribe included'
                      : `Header: ${dltSenderId} · TID: ${dltTemplateId}`}
                  </p>
                </div>
              </div>

              {/* Live Preview Render Card */}
              <div className="p-4 rounded-xl bg-[#F8F9FC] border border-[#E6E8F0] space-y-2">
                <span className="text-xs font-bold text-[#1B2236] flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-[#5B49D6]" />
                  Rendered Preview (Sample: Priya Sharma)
                </span>
                <div className="bg-white p-4 rounded-xl border border-[#E6E8F0] text-xs space-y-2">
                  {channel === CampaignChannel.EMAIL && (
                    <div className="pb-2 border-b border-[#E6E8F0]">
                      <span className="font-bold text-[#1B2236]">Subject: </span>
                      <span className="text-gray-800">
                        {replaceMergeFields(subject, {
                          first_name: 'Priya',
                          full_name: 'Priya Sharma',
                          company: 'Aureva Capital',
                          job_title: 'Senior Java Backend Engineer',
                        }).text}
                      </span>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap text-gray-800 font-sans">
                    {replaceMergeFields(body, {
                      first_name: 'Priya',
                      full_name: 'Priya Sharma',
                      company: 'Aureva Capital',
                      job_title: 'Senior Java Backend Engineer',
                      recruiter_name: 'Rohit Mehta',
                      application_link: 'https://careers.aurevacapital.com/jobs/JOB-001',
                      unsubscribe_link: 'https://careers.aurevacapital.com/unsubscribe/sample-token',
                    }).text}
                  </div>

                  {channel === CampaignChannel.EMAIL && (
                    <div className="pt-3 border-t border-[#E6E8F0] text-[10px] text-[#8F97B0]">
                      ---<br />
                      You received this email because you registered on Aureva Capital careers portal. If you no longer wish to receive marketing outreach, click here to{' '}
                      <span className="text-[#5B49D6] underline">unsubscribe</span>.
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule Launch Options */}
              <div className="space-y-4 pt-4 border-t border-[#E6E8F0]">
                <h3 className="text-sm font-bold text-[#1B2236] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#5B49D6]" />
                  Dispatch Timing (IST - Asia/Kolkata)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      sendMode === 'IMMEDIATE'
                        ? 'bg-[#EEEBFB] border-[#5B49D6]'
                        : 'bg-white border-[#E6E8F0] hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sendMode"
                      value="IMMEDIATE"
                      checked={sendMode === 'IMMEDIATE'}
                      onChange={() => setSendMode('IMMEDIATE')}
                      className="mt-0.5 text-[#5B49D6] focus:ring-[#5B49D6]"
                    />
                    <div>
                      <span className="text-xs font-bold text-[#1B2236] block">Send Immediately</span>
                      <span className="text-[11px] text-[#6B7490]">
                        Queue messages for instant batch dispatch across providers.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      sendMode === 'SCHEDULED'
                        ? 'bg-[#EEEBFB] border-[#5B49D6]'
                        : 'bg-white border-[#E6E8F0] hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sendMode"
                      value="SCHEDULED"
                      checked={sendMode === 'SCHEDULED'}
                      onChange={() => setSendMode('SCHEDULED')}
                      className="mt-0.5 text-[#5B49D6] focus:ring-[#5B49D6]"
                    />
                    <div>
                      <span className="text-xs font-bold text-[#1B2236] block">Schedule for Later</span>
                      <span className="text-[11px] text-[#6B7490]">
                        Schedule batch execution at a specific date and time in IST.
                      </span>
                    </div>
                  </label>
                </div>

                {sendMode === 'SCHEDULED' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#F8F9FC] border border-[#E6E8F0]">
                    <div>
                      <label className="block text-xs font-bold text-[#1B2236] mb-1">
                        Scheduled Date (IST)
                      </label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full text-xs bg-white border border-[#E6E8F0] rounded-xl px-3 py-2 text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#1B2236] mb-1">
                        Scheduled Time (IST)
                      </label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full text-xs bg-white border border-[#E6E8F0] rounded-xl px-3 py-2 text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Step 3 */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-2 text-xs font-semibold text-[#6B7490] hover:text-[#1B2236]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Composer</span>
              </button>

              <button
                type="button"
                onClick={handleLaunchCampaign}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#5B49D6] hover:bg-[#4D3DC2] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  {sendMode === 'IMMEDIATE' ? 'Launch Campaign Now' : 'Schedule Campaign (IST)'}
                </span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
