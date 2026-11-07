'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  Mail,
  MessageSquare,
  Phone,
  Clock,
  Send,
  FileText,
  Paperclip,
  Check,
  CheckCheck,
  AlertCircle,
  Search,
  Sparkles,
  User,
  Briefcase,
  ChevronRight,
  ExternalLink,
  Calendar,
  Lock,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  getCommunicationsInboxAction,
  getThreadDetailsAction,
  sendEmailAction,
  sendWhatsAppAction,
  sendSMSAction,
  markThreadReadAction,
  getCandidateTimelineAction,
  getTemplatesAction,
  previewTemplateAction,
} from '@/actions/communications';

interface CommunicationsClientViewProps {
  initialInboxData: any;
  templates: any[];
}

export function CommunicationsClientView({ initialInboxData, templates }: CommunicationsClientViewProps) {
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [threads, setThreads] = useState<any[]>(initialInboxData?.threads || []);
  const [stats, setStats] = useState<any>(initialInboxData?.stats || { emailUnread: 0, whatsappUnread: 0, totalThreads: 0 });
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialInboxData?.threads?.[0]?.id || null
  );

  const [activeTab, setActiveTab] = useState<'EMAIL' | 'WHATSAPP' | 'ACTIVITY'>('EMAIL');
  const [currentThreadData, setCurrentThreadData] = useState<any>(null);
  const [candidateTimeline, setCandidateTimeline] = useState<any[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  // Email Composer Form State
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState<string>('');
  const [emailSuccessMsg, setEmailSuccessMsg] = useState<string | null>(null);
  const [emailErrorMsg, setEmailErrorMsg] = useState<string | null>(null);

  // WhatsApp Composer Form State
  const [whatsAppText, setWhatsAppText] = useState<string>('');
  const [selectedWhatsAppTemplateId, setSelectedWhatsAppTemplateId] = useState<string>('');
  const [whatsAppSuccessMsg, setWhatsAppSuccessMsg] = useState<string | null>(null);
  const [whatsAppErrorMsg, setWhatsAppErrorMsg] = useState<string | null>(null);

  // Fetch thread details when selectedThreadId changes
  useEffect(() => {
    if (!selectedThreadId) return;

    setIsLoadingThread(true);
    getThreadDetailsAction(selectedThreadId).then((res) => {
      setIsLoadingThread(false);
      if (res.success && res.data) {
        setCurrentThreadData(res.data);
        if (res.data.thread.channel === 'WHATSAPP') {
          setActiveTab('WHATSAPP');
        } else {
          setActiveTab('EMAIL');
        }

        // Fetch candidate timeline activities
        if (res.data.thread.candidate?.id) {
          getCandidateTimelineAction(res.data.thread.candidate.id).then((tRes) => {
            if (tRes.success && tRes.data) {
              setCandidateTimeline(tRes.data);
            }
          });
        }

        // Mark thread read if unread
        if (res.data.thread.unreadCount > 0) {
          markThreadReadAction(selectedThreadId);
        }
      }
    });
  }, [selectedThreadId]);

  // Handle inbox filtering
  const handleFilterChange = (channel: string) => {
    setSelectedChannel(channel);
    startTransition(async () => {
      const res = await getCommunicationsInboxAction(channel, searchQuery);
      if (res.success && res.data) {
        setThreads(res.data.threads);
        setStats(res.data.stats);
        if (res.data.threads.length > 0 && !res.data.threads.some((t: any) => t.id === selectedThreadId)) {
          setSelectedThreadId(res.data.threads[0].id);
        }
      }
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await getCommunicationsInboxAction(selectedChannel, searchQuery);
      if (res.success && res.data) {
        setThreads(res.data.threads);
        setStats(res.data.stats);
      }
    });
  };

  // Template change handler for Email
  const handleEmailTemplateChange = async (templateId: string) => {
    setSelectedEmailTemplateId(templateId);
    if (!templateId) return;

    const t = templates.find((item) => item.id === templateId);
    if (!t) return;

    const candidateId = currentThreadData?.candidateDetails?.id;
    const preview = await previewTemplateAction(templateId, candidateId);
    if (preview.success && preview.data) {
      if (preview.data.renderedSubject) setEmailSubject(preview.data.renderedSubject);
      setEmailBody(preview.data.renderedBody);
    } else {
      if (t.subject) setEmailSubject(t.subject);
      setEmailBody(t.body);
    }
  };

  // Template change handler for WhatsApp
  const handleWhatsAppTemplateChange = async (templateId: string) => {
    setSelectedWhatsAppTemplateId(templateId);
    if (!templateId) return;

    const t = templates.find((item) => item.id === templateId);
    if (!t) return;

    const candidateId = currentThreadData?.candidateDetails?.id;
    const preview = await previewTemplateAction(templateId, candidateId);
    if (preview.success && preview.data) {
      setWhatsAppText(preview.data.renderedBody);
    } else {
      setWhatsAppText(t.body);
    }
  };

  // Submit Email
  const handleSendEmail = async (saveAsDraft: boolean = false) => {
    setEmailErrorMsg(null);
    setEmailSuccessMsg(null);

    if (!currentThreadData?.candidateDetails?.id) {
      setEmailErrorMsg('Candidate context is missing.');
      return;
    }
    if (!emailSubject.trim() || !emailBody.trim()) {
      setEmailErrorMsg('Subject and body cannot be empty.');
      return;
    }

    startTransition(async () => {
      const res = await sendEmailAction({
        candidateId: currentThreadData.candidateDetails.id,
        jobId: currentThreadData.thread.job?.id || null,
        subject: emailSubject,
        bodyHtml: emailBody,
        templateId: selectedEmailTemplateId || null,
        saveAsDraft,
      });

      if (res.success) {
        setEmailSuccessMsg(
          saveAsDraft ? 'Draft saved successfully.' : 'Email dispatched (Demo Mode — OAuth active).'
        );
        setEmailSubject('');
        setEmailBody('');
        setSelectedEmailTemplateId('');
        // Refresh active thread
        if (selectedThreadId) {
          const updated = await getThreadDetailsAction(selectedThreadId);
          if (updated.success && updated.data) setCurrentThreadData(updated.data);
        }
      } else {
        setEmailErrorMsg(res.error || 'Failed to send email.');
      }
    });
  };

  // Submit WhatsApp
  const handleSendWhatsApp = async () => {
    setWhatsAppErrorMsg(null);
    setWhatsAppSuccessMsg(null);

    if (!currentThreadData?.candidateDetails?.id) {
      setWhatsAppErrorMsg('Candidate context is missing.');
      return;
    }
    if (!whatsAppText.trim()) {
      setWhatsAppErrorMsg('Message text cannot be empty.');
      return;
    }

    startTransition(async () => {
      const res = await sendWhatsAppAction({
        candidateId: currentThreadData.candidateDetails.id,
        jobId: currentThreadData.thread.job?.id || null,
        messageText: whatsAppText,
        templateId: selectedWhatsAppTemplateId || null,
      });

      if (res.success) {
        setWhatsAppSuccessMsg('WhatsApp message sent (Demo Mode — Meta API connected).');
        setWhatsAppText('');
        setSelectedWhatsAppTemplateId('');
        if (selectedThreadId) {
          const updated = await getThreadDetailsAction(selectedThreadId);
          if (updated.success && updated.data) setCurrentThreadData(updated.data);
        }
      } else {
        setWhatsAppErrorMsg(res.error || 'Failed to send WhatsApp message.');
      }
    });
  };

  const emailTemplates = templates.filter((t) => t.channel === 'EMAIL');
  const whatsAppTemplates = templates.filter((t) => t.channel === 'WHATSAPP');

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#F8F9FC]">
      {/* Top Banner / Breadcrumb & Header */}
      <div className="bg-white border-b border-[#E6E8F0] px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7490] uppercase tracking-wider mb-1">
            <span>Aureva Capital</span>
            <span>/</span>
            <span className="text-[#5B49D6]">Candidate Communications</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1B2236] tracking-tight">Communications Inbox</h1>
          <p className="text-xs text-[#6B7490] mt-0.5">
            Unified omnichannel outreach with audit logs, shared team signatures, and 24-hour compliance rules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/communications/campaigns"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[#5B49D6] hover:bg-[#4D3DC2] rounded-lg shadow-xs transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Bulk Campaigns</span>
          </Link>

          <Link
            href="/communications/templates"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#1B2236] bg-[#F4F5FA] hover:bg-[#EBECEF] rounded-lg border border-[#E6E8F0] transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-[#5B49D6]" />
            <span>Templates & Signatures</span>
          </Link>

          <Link
            href="/integrations"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#1B2236] bg-[#F4F5FA] hover:bg-[#EBECEF] rounded-lg border border-[#E6E8F0] transition-colors"
          >
            <Lock className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>Integrations (AES-256)</span>
          </Link>
        </div>
      </div>

      {/* Main Two-Pane Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Inbox & Thread List */}
        <div className="w-full md:w-96 lg:w-[420px] bg-white border-r border-[#E6E8F0] flex flex-col shrink-0">
          {/* Channel Filter Pills */}
          <div className="p-3 border-b border-[#E6E8F0]">
            <div className="grid grid-cols-4 gap-1 p-1 bg-[#F4F5FA] rounded-lg">
              <button
                type="button"
                onClick={() => handleFilterChange('ALL')}
                className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                  selectedChannel === 'ALL'
                    ? 'bg-white text-[#1B2236] shadow-sm font-semibold'
                    : 'text-[#6B7490] hover:text-[#1B2236]'
                }`}
              >
                All ({stats.totalThreads || 0})
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange('EMAIL')}
                className={`py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1 ${
                  selectedChannel === 'EMAIL'
                    ? 'bg-white text-[#5B49D6] shadow-sm font-semibold'
                    : 'text-[#6B7490] hover:text-[#1B2236]'
                }`}
              >
                <Mail className="w-3 h-3" />
                <span>Email</span>
                {stats.emailUnread > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5B49D6]"></span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange('WHATSAPP')}
                className={`py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1 ${
                  selectedChannel === 'WHATSAPP'
                    ? 'bg-white text-[#22C55E] shadow-sm font-semibold'
                    : 'text-[#6B7490] hover:text-[#1B2236]'
                }`}
              >
                <MessageSquare className="w-3 h-3" />
                <span>WhatsApp</span>
                {stats.whatsappUnread > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"></span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange('SMS')}
                className={`py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1 ${
                  selectedChannel === 'SMS'
                    ? 'bg-white text-[#1B2236] shadow-sm font-semibold'
                    : 'text-[#6B7490] hover:text-[#1B2236]'
                }`}
              >
                <Phone className="w-3 h-3" />
                <span>SMS</span>
              </button>
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearch} className="relative mt-2.5">
              <Search className="w-3.5 h-3.5 text-[#6B7490] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search candidates or subjects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F8F9FC] border border-[#E6E8F0] rounded-lg text-[#1B2236] placeholder-[#8F97B0] focus:outline-none focus:border-[#5B49D6]"
              />
            </form>
          </div>

          {/* Thread List Scrollable Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#E6E8F0]">
            {threads.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6B7490]">
                <Mail className="w-8 h-8 text-[#A0A7BD] mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-[#1B2236]">No conversation threads found</p>
                <p className="mt-1">Candidates you message will appear in this unified inbox.</p>
              </div>
            ) : (
              threads.map((thread) => {
                const isSelected = thread.id === selectedThreadId;
                const initials = thread.candidate.name
                  ? thread.candidate.name
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  : 'C';

                return (
                  <div
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`p-4 cursor-pointer transition-colors relative ${
                      isSelected
                        ? 'bg-[#F4F1FD] border-l-4 border-l-[#5B49D6]'
                        : 'hover:bg-[#F8F9FC] border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#E5E0FA] text-[#5B49D6] font-bold text-xs flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#1B2236] truncate">
                            {thread.candidate.name}
                          </p>
                          <p className="text-xs text-[#6B7490] truncate">
                            {thread.candidate.currentTitle || 'Candidate'}
                            {thread.job ? ` • ${thread.job.title}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-[10px] text-[#8F97B0]">
                          {thread.lastMessageAt
                            ? new Date(thread.lastMessageAt).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : ''}
                        </span>
                        {thread.unreadCount > 0 && (
                          <span className="mt-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#5B49D6] text-white">
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      {thread.channel === 'EMAIL' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#EBE9FE] text-[#5B49D6] flex items-center gap-1">
                          <Mail className="w-2.5 h-2.5" /> Email
                        </span>
                      )}
                      {thread.channel === 'WHATSAPP' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#DCFCE7] text-[#16A34A] flex items-center gap-1">
                          <MessageSquare className="w-2.5 h-2.5" /> WhatsApp
                        </span>
                      )}
                      {thread.channel === 'SMS' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FEF3C7] text-[#D97706] flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5" /> SMS
                        </span>
                      )}

                      <p className="text-xs text-[#6B7490] truncate flex-1">
                        {thread.latestMessage?.body
                          ? thread.latestMessage.body.replace(/<[^>]*>?/gm, '')
                          : thread.subject || 'No messages yet'}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Thread Detail, Conversation & Composer */}
        <div className="flex-1 bg-white flex flex-col overflow-hidden">
          {isLoadingThread ? (
            <div className="flex-1 flex items-center justify-center text-xs text-[#6B7490]">
              <RefreshCw className="w-6 h-6 text-[#5B49D6] animate-spin mb-2" />
              <span>Loading candidate conversation...</span>
            </div>
          ) : !currentThreadData ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#6B7490]">
              <Mail className="w-12 h-12 text-[#A0A7BD] opacity-40 mb-3" />
              <h3 className="text-base font-bold text-[#1B2236]">Select a conversation to view</h3>
              <p className="text-xs max-w-sm mt-1">
                Choose any candidate thread on the left pane to send emails, WhatsApp messages, or inspect timeline activity.
              </p>
            </div>
          ) : (
            <>
              {/* Header: Candidate Details & Quick ATS Actions */}
              <div className="p-4 border-b border-[#E6E8F0] flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#FAFBFD]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#5B49D6] text-white font-bold text-sm flex items-center justify-center">
                    {currentThreadData.candidateDetails?.name?.[0] || 'C'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-[#1B2236]">
                        {currentThreadData.candidateDetails?.name}
                      </h2>
                      {currentThreadData.thread.job && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EAE8FD] text-[#5B49D6]">
                          {currentThreadData.thread.job.title} ({currentThreadData.thread.job.code})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#6B7490] mt-0.5">
                      <span>{currentThreadData.candidateDetails?.email}</span>
                      {currentThreadData.candidateDetails?.phone && (
                        <>
                          <span>•</span>
                          <span>{currentThreadData.candidateDetails?.phone}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>Assigned: {currentThreadData.assignedRecruiter?.name || 'Recruitment Team'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/candidates/${currentThreadData.candidateDetails?.id}`}
                    className="px-3 py-1.5 text-xs font-semibold text-[#1B2236] bg-white border border-[#E6E8F0] rounded-lg hover:bg-[#F8F9FC] transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <User className="w-3.5 h-3.5 text-[#5B49D6]" />
                    <span>View Profile</span>
                  </Link>

                  <Link
                    href={`/interviews?candidateId=${currentThreadData.candidateDetails?.id}`}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#5B49D6] rounded-lg hover:bg-[#4C3BC2] transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Schedule Interview</span>
                  </Link>
                </div>
              </div>

              {/* 3 Tabs Navigation: Email | WhatsApp | Activity Log */}
              <div className="flex items-center border-b border-[#E6E8F0] px-6 bg-white">
                <button
                  type="button"
                  onClick={() => setActiveTab('EMAIL')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
                    activeTab === 'EMAIL'
                      ? 'border-[#5B49D6] text-[#5B49D6]'
                      : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email Thread</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('WHATSAPP')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
                    activeTab === 'WHATSAPP'
                      ? 'border-[#22C55E] text-[#16A34A]'
                      : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                  {currentThreadData.whatsAppPolicy?.isWithin24hWindow && (
                    <span className="w-2 h-2 rounded-full bg-[#22C55E]" title="24-hour window open"></span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('ACTIVITY')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
                    activeTab === 'ACTIVITY'
                      ? 'border-[#1B2236] text-[#1B2236]'
                      : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Activity Log ({candidateTimeline.length})</span>
                </button>
              </div>

              {/* Tab 1: Email Thread & Compose Box */}
              {activeTab === 'EMAIL' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Messages Bubble List */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F8F9FC]">
                    {currentThreadData.messages.filter((m: any) => m.channel === 'EMAIL').length === 0 ? (
                      <div className="text-center py-8 text-xs text-[#6B7490]">
                        <Mail className="w-6 h-6 text-[#A0A7BD] mx-auto mb-1 opacity-50" />
                        <p>No email correspondence recorded yet for this candidate.</p>
                      </div>
                    ) : (
                      currentThreadData.messages
                        .filter((m: any) => m.channel === 'EMAIL')
                        .map((msg: any) => {
                          const isOutbound = msg.direction === 'OUTBOUND';
                          return (
                            <div
                              key={msg.id}
                              className={`p-4 rounded-xl border max-w-2xl text-xs ${
                                isOutbound
                                  ? 'ml-auto bg-white border-[#E6E8F0] shadow-sm'
                                  : 'mr-auto bg-[#F0EDFD] border-[#D8D2FB] text-[#1B2236]'
                              }`}
                            >
                              <div className="flex items-center justify-between border-b border-[#E6E8F0]/50 pb-2 mb-2">
                                <span className="font-semibold text-[#1B2236]">
                                  {isOutbound ? `To: ${msg.recipient}` : `From: ${msg.sender}`}
                                </span>
                                <div className="flex items-center gap-2 text-[10px] text-[#8F97B0]">
                                  <span>
                                    {new Date(msg.sentAt).toLocaleString('en-IN', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                  {msg.deliveryStatus === 'SENT' && (
                                    <span className="flex items-center gap-0.5 text-[#5B49D6]">
                                      <Check className="w-3 h-3" /> Sent
                                    </span>
                                  )}
                                  {msg.deliveryStatus === 'DELIVERED' && (
                                    <span className="flex items-center gap-0.5 text-[#22C55E]">
                                      <CheckCheck className="w-3 h-3" /> Delivered
                                    </span>
                                  )}
                                  {msg.deliveryStatus === 'DRAFT' && (
                                    <span className="px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#D97706] font-bold">
                                      Draft
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Email Body with Injected Signature */}
                              <div
                                className="prose prose-xs max-w-none text-[#1B2236] leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: msg.body }}
                              />

                              {msg.demoNotice && (
                                <div className="mt-2 text-[10px] text-[#5B49D6] italic flex items-center gap-1">
                                  <Info className="w-2.5 h-2.5" />
                                  <span>{msg.demoNotice}</span>
                                </div>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>

                  {/* Compose Email Box */}
                  <div className="p-4 border-t border-[#E6E8F0] bg-white">
                    {emailSuccessMsg && (
                      <div className="mb-3 p-2.5 rounded-lg bg-[#DCFCE7] border border-[#86EFAC] text-xs text-[#15803D] flex items-center justify-between">
                        <span>{emailSuccessMsg}</span>
                        <button type="button" onClick={() => setEmailSuccessMsg(null)}>
                          ✕
                        </button>
                      </div>
                    )}
                    {emailErrorMsg && (
                      <div className="mb-3 p-2.5 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-xs text-[#B91C1C] flex items-center justify-between">
                        <span>{emailErrorMsg}</span>
                        <button type="button" onClick={() => setEmailErrorMsg(null)}>
                          ✕
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 mb-2">
                      <input
                        type="text"
                        placeholder="Email Subject Line *"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs border border-[#E6E8F0] rounded-lg font-medium text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                      />

                      <div className="flex items-center gap-2">
                        <select
                          value={selectedEmailTemplateId}
                          onChange={(e) => handleEmailTemplateChange(e.target.value)}
                          className="px-2.5 py-1.5 text-xs border border-[#E6E8F0] rounded-lg bg-[#FAFBFD] text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                        >
                          <option value="">Insert Email Template...</option>
                          {emailTemplates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title} ({t.category})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <textarea
                      rows={4}
                      placeholder="Write your email to candidate... (Corporate team signature is automatically appended)"
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full p-3 text-xs border border-[#E6E8F0] rounded-lg text-[#1B2236] focus:outline-none focus:border-[#5B49D6] resize-none"
                    />

                    <div className="flex items-center justify-between mt-2.5">
                      <div className="flex items-center gap-2 text-xs text-[#6B7490]">
                        <span className="flex items-center gap-1 text-[11px] text-[#5B49D6] font-medium">
                          <Sparkles className="w-3 h-3" /> Auto-appends Aureva Team Signature
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleSendEmail(true)}
                          className="px-3.5 py-1.5 text-xs font-semibold text-[#1B2236] bg-[#F4F5FA] hover:bg-[#EAEBED] rounded-lg border border-[#E6E8F0] transition-colors"
                        >
                          Save Draft
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleSendEmail(false)}
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-[#5B49D6] hover:bg-[#4C3BC2] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          <Send className="w-3 h-3" />
                          <span>{isPending ? 'Sending...' : 'Send Email'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: WhatsApp Chat & Compliance Policy Banner */}
              {activeTab === 'WHATSAPP' && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[#EFEAE2]">
                  {/* WhatsApp Policy Banner */}
                  <div className="p-3 border-b border-[#E6E8F0] bg-white">
                    {currentThreadData.whatsAppPolicy?.isWithin24hWindow ? (
                      <div className="p-2.5 rounded-lg bg-[#DCFCE7] border border-[#86EFAC] text-xs text-[#15803D] flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] shrink-0"></span>
                        <div>
                          <p className="font-bold">24-Hour Customer Care Window Active</p>
                          <p className="text-[11px] text-[#166534]">
                            Candidate has messaged recently. Freeform conversational messages and replies are allowed without template restriction.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-[#FEF3C7] border border-[#FCD34D] text-xs text-[#92400E] flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0" />
                        <div>
                          <p className="font-bold">Outside 24-Hour Service Window</p>
                          <p className="text-[11px] text-[#78350F]">
                            Meta Cloud API rules require pre-approved WhatsApp templates for outbound messages outside the 24-hour window.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* WhatsApp Bubbles */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {currentThreadData.messages.filter((m: any) => m.channel === 'WHATSAPP').length === 0 ? (
                      <div className="text-center py-8 text-xs text-[#6B7490]">
                        <MessageSquare className="w-6 h-6 text-[#A0A7BD] mx-auto mb-1 opacity-50" />
                        <p>No WhatsApp conversation yet with {currentThreadData.candidateDetails?.name}.</p>
                      </div>
                    ) : (
                      currentThreadData.messages
                        .filter((m: any) => m.channel === 'WHATSAPP')
                        .map((msg: any) => {
                          const isOutbound = msg.direction === 'OUTBOUND';
                          return (
                            <div
                              key={msg.id}
                              className={`p-3 rounded-lg max-w-sm text-xs shadow-sm ${
                                isOutbound
                                  ? 'ml-auto bg-[#D9FDD3] text-[#111B21] rounded-tr-none'
                                  : 'mr-auto bg-white text-[#111B21] rounded-tl-none'
                              }`}
                            >
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                              <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-[#667781]">
                                <span>
                                  {new Date(msg.sentAt).toLocaleTimeString('en-IN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                {isOutbound && <CheckCheck className="w-3 h-3 text-[#53BDEB]" />}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>

                  {/* WhatsApp Composer Box */}
                  <div className="p-4 border-t border-[#E6E8F0] bg-white">
                    {whatsAppSuccessMsg && (
                      <div className="mb-2 p-2 rounded bg-[#DCFCE7] text-xs text-[#15803D]">
                        {whatsAppSuccessMsg}
                      </div>
                    )}
                    {whatsAppErrorMsg && (
                      <div className="mb-2 p-2 rounded bg-[#FEE2E2] text-xs text-[#B91C1C]">
                        {whatsAppErrorMsg}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-2">
                      <select
                        value={selectedWhatsAppTemplateId}
                        onChange={(e) => handleWhatsAppTemplateChange(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-[#E6E8F0] rounded-lg bg-[#FAFBFD] text-[#1B2236] focus:outline-none focus:border-[#22C55E]"
                      >
                        <option value="">
                          {currentThreadData.whatsAppPolicy?.isWithin24hWindow
                            ? 'Optional: Select Meta-Approved Template...'
                            : 'Mandatory: Select Meta-Approved Template (Outside 24h)...'}
                        </option>
                        {whatsAppTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title} ({t.providerApprovalState})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Type WhatsApp message..."
                        value={whatsAppText}
                        onChange={(e) => setWhatsAppText(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs border border-[#E6E8F0] rounded-lg text-[#1B2236] focus:outline-none focus:border-[#22C55E]"
                      />
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={handleSendWhatsApp}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#22C55E] hover:bg-[#16A34A] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send</span>
                      </button>
                    </div>

                    <p className="text-[10px] text-[#6B7490] mt-1.5">
                      Candidate WhatsApp opt-in: {currentThreadData.candidateDetails?.whatsappOptIn ? 'Active' : 'Unsubscribed'} • Strictly plain text format (no email signatures appended).
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 3: Unified Candidate Activity Timeline */}
              {activeTab === 'ACTIVITY' && (
                <div className="flex-1 overflow-y-auto p-6 bg-[#F8F9FC]">
                  <h3 className="text-sm font-bold text-[#1B2236] mb-4">Candidate Communication Timeline</h3>
                  {candidateTimeline.length === 0 ? (
                    <div className="text-center py-8 text-xs text-[#6B7490]">
                      <Clock className="w-6 h-6 text-[#A0A7BD] mx-auto mb-1 opacity-50" />
                      <p>No activity records logged yet for this candidate.</p>
                    </div>
                  ) : (
                    <div className="relative border-l-2 border-[#E6E8F0] ml-4 pl-6 space-y-6">
                      {candidateTimeline.map((item) => (
                        <div key={item.id} className="relative">
                          <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-[#5B49D6] border-2 border-white"></div>
                          <div className="bg-white p-3.5 rounded-xl border border-[#E6E8F0] shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-[#1B2236]">{item.title}</span>
                              <span className="text-[10px] text-[#8F97B0]">
                                {new Date(item.createdAt).toLocaleString('en-IN', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-xs text-[#6B7490] mt-1">{item.description}</p>
                            )}
                            <div className="mt-2 flex items-center gap-2 text-[10px] text-[#5B49D6] font-medium">
                              <span>Channel: {item.channel || 'SYSTEM'}</span>
                              <span>•</span>
                              <span>Direction: {item.direction || 'INTERNAL'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
