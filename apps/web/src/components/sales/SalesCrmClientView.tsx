'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useTransition } from 'react';
import { PageHeader } from '../layout/PageHeader';
import {
  Plus,
  Calendar,
  Building2,
  Mail,
  Users,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  Briefcase,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  OpportunityStage,
  MeetingStatus,
  isValidStageTransition,
} from '@hireflow/shared';
import {
  getSalesPipelineAction,
  createOpportunityAction,
  changeOpportunityStageAction,
  convertOpportunityToJobAction,
  getClientMeetingsAction,
  scheduleClientMeetingAction,
  updateMeetingOutcomeAction,
} from '@/actions/sales';

interface SalesCrmClientViewProps {
  initialPipelineData: any;
  initialMeetingsData: any;
}

export function SalesCrmClientView({
  initialPipelineData,
  initialMeetingsData,
}: SalesCrmClientViewProps) {
  const [pipelineData, setPipelineData] = useState(initialPipelineData);
  const [meetingsData, setMeetingsData] = useState(initialMeetingsData);
  const [activeTab, setActiveTab] = useState<'PIPELINE' | 'MEETINGS'>('PIPELINE');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [isAddOppModalOpen, setIsAddOppModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isScheduleMeetingModalOpen, setIsScheduleMeetingModalOpen] = useState(false);
  const [isOutcomeModalOpen, setIsOutcomeModalOpen] = useState(false);

  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Form states
  const [newOppForm, setNewOppForm] = useState({
    title: '',
    companyName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    industry: '',
    location: 'Bengaluru, India',
    estimatedValue: '1000000',
    estimatedOpenings: '2',
    priority: 'MEDIUM',
    notes: '',
  });

  const [convertForm, setConvertForm] = useState({
    feePercentage: 15,
    paymentTerms: 'NET_30',
    jobTitle: '',
    recruiterOwnerId: '',
    openings: 1,
    location: '',
    employmentType: 'FULL_TIME',
    description: '',
  });

  const [meetingForm, setMeetingForm] = useState({
    title: '',
    opportunityId: '',
    contactName: '',
    contactEmail: '',
    scheduledAt: '',
    durationMinutes: 30,
    notes: '',
  });

  const [outcomeForm, setOutcomeForm] = useState({
    status: MeetingStatus.COMPLETED,
    outcome: '',
    nextAction: '',
    nextFollowUpAt: '',
  });

  const refreshAll = () => {
    startTransition(async () => {
      const [pipeRes, meetRes] = await Promise.all([
        getSalesPipelineAction({ search: searchQuery }),
        getClientMeetingsAction(),
      ]);
      if (pipeRes.success && pipeRes.data) setPipelineData(pipeRes.data);
      if (meetRes.success && meetRes.data) setMeetingsData(meetRes.data);
    });
  };

  // Pipeline summary
  const stageSummaries = pipelineData?.stageSummaries || {};
  const allOpportunities = pipelineData?.opportunities || [];
  const recruiters = pipelineData?.recruiters || [];

  const filteredOpportunities = allOpportunities.filter((opp: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      opp.companyName?.toLowerCase().includes(q) ||
      opp.title?.toLowerCase().includes(q) ||
      opp.primaryContact?.name?.toLowerCase().includes(q)
    );
  });

  const stagesList = [
    { key: OpportunityStage.PROSPECTING, title: 'Prospecting', color: 'border-t-blue-500' },
    { key: OpportunityStage.MEETING, title: 'Meeting Scheduled', color: 'border-t-purple-500' },
    { key: OpportunityStage.PROPOSAL, title: 'Proposal / Terms', color: 'border-t-amber-500' },
    { key: OpportunityStage.WON, title: 'Won Mandate', color: 'border-t-emerald-500' },
  ];

  // Total Pipeline Value
  const totalPipelineValue = Object.values(stageSummaries).reduce(
    (sum: number, s: any) => sum + (s.totalValue || 0),
    0
  );

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Handlers
  const handleStageChange = async (opportunityId: string, currentStage: OpportunityStage, targetStage: OpportunityStage) => {
    if (!isValidStageTransition(currentStage, targetStage)) {
      setActionError(`Cannot transition from ${currentStage} directly to ${targetStage}`);
      return;
    }
    setActionError(null);
    startTransition(async () => {
      const res = await changeOpportunityStageAction(opportunityId, targetStage);
      if (!res.success) {
        setActionError(res.error || 'Failed to update stage');
      } else {
        refreshAll();
      }
    });
  };

  const handleCreateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    startTransition(async () => {
      const res = await createOpportunityAction({
        title: newOppForm.title,
        companyName: newOppForm.companyName,
        contactName: newOppForm.contactName || undefined,
        contactEmail: newOppForm.contactEmail || undefined,
        contactPhone: newOppForm.contactPhone || undefined,
        industry: newOppForm.industry || undefined,
        location: newOppForm.location || undefined,
        estimatedValue: parseFloat(newOppForm.estimatedValue) || undefined,
        estimatedOpenings: parseInt(newOppForm.estimatedOpenings, 10) || 1,
        priority: newOppForm.priority as any,
        notes: newOppForm.notes || undefined,
      });

      if (!res.success) {
        setActionError(res.error || 'Failed to create opportunity');
      } else {
        setIsAddOppModalOpen(false);
        setActionSuccess('Opportunity created successfully!');
        setTimeout(() => setActionSuccess(null), 4000);
        refreshAll();
      }
    });
  };

  const openConvertModal = (opp: any) => {
    setSelectedOpportunity(opp);
    setConvertForm({
      feePercentage: 15,
      paymentTerms: 'NET_30',
      jobTitle: opp.title,
      recruiterOwnerId: opp.ownerId || (recruiters[0]?.id ?? ''),
      openings: opp.estimatedOpenings || 1,
      location: opp.location || 'Bengaluru, India',
      employmentType: 'FULL_TIME',
      description: `Mandate converted from opportunity: ${opp.title} (${opp.companyName})`,
    });
    setIsConvertModalOpen(true);
  };

  const handleConvertToJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpportunity) return;
    setActionError(null);

    startTransition(async () => {
      const res = await convertOpportunityToJobAction({
        opportunityId: selectedOpportunity.id,
        contactName: selectedOpportunity.primaryContact?.name || selectedOpportunity.companyName,
        contactEmail: selectedOpportunity.primaryContact?.email || 'contact@client.com',
        contactPhone: selectedOpportunity.primaryContact?.phone || undefined,
        feePercentage: Number(convertForm.feePercentage),
        paymentTerms: convertForm.paymentTerms,
        jobTitle: convertForm.jobTitle,
        recruiterOwnerId: convertForm.recruiterOwnerId,
        openings: Number(convertForm.openings),
        location: convertForm.location,
        employmentType: convertForm.employmentType,
        description: convertForm.description,
      });

      if (!res.success) {
        setActionError(res.error || 'Failed to convert opportunity');
      } else {
        setIsConvertModalOpen(false);
        setActionSuccess(`Converted successfully! Created job mandate code: ${res.data?.job?.code} in DRAFT status.`);
        setTimeout(() => setActionSuccess(null), 6000);
        refreshAll();
      }
    });
  };

  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    startTransition(async () => {
      const res = await scheduleClientMeetingAction({
        title: meetingForm.title,
        opportunityId: meetingForm.opportunityId || undefined,
        contactName: meetingForm.contactName,
        contactEmail: meetingForm.contactEmail || undefined,
        scheduledAt: new Date(meetingForm.scheduledAt).toISOString(),
        durationMinutes: Number(meetingForm.durationMinutes),
        notes: meetingForm.notes || undefined,
        calendarProvider: 'DEMO_MODE',
      });

      if (!res.success) {
        setActionError(res.error || 'Failed to schedule meeting');
      } else {
        setIsScheduleMeetingModalOpen(false);
        setActionSuccess('Client meeting scheduled with calendar sync notice (Demo Mode).');
        setTimeout(() => setActionSuccess(null), 4000);
        refreshAll();
      }
    });
  };

  const openOutcomeModal = (meeting: any) => {
    setSelectedMeeting(meeting);
    setOutcomeForm({
      status: MeetingStatus.COMPLETED,
      outcome: meeting.outcome || '',
      nextAction: meeting.nextAction || '',
      nextFollowUpAt: meeting.nextFollowUpAt || '',
    });
    setIsOutcomeModalOpen(true);
  };

  const handleUpdateOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeeting) return;
    setActionError(null);
    startTransition(async () => {
      const res = await updateMeetingOutcomeAction(selectedMeeting.id, {
        status: outcomeForm.status,
        outcome: outcomeForm.outcome,
        nextAction: outcomeForm.nextAction || undefined,
        nextFollowUpAt: outcomeForm.nextFollowUpAt ? new Date(outcomeForm.nextFollowUpAt).toISOString() : undefined,
      });

      if (!res.success) {
        setActionError(res.error || 'Failed to record outcome');
      } else {
        setIsOutcomeModalOpen(false);
        setActionSuccess('Meeting outcome and next steps recorded.');
        setTimeout(() => setActionSuccess(null), 4000);
        refreshAll();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Sales CRM & Mandate Pipeline"
        subtitle="Manage prospective clients, commercial opportunities, discovery meetings & convert won mandates into draft jobs."
        breadcrumbs={[{ label: 'Sales CRM' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={refreshAll}
              disabled={isPending}
              className="px-3 py-2 border border-[#E6E8F0] bg-white text-[#1B2236] rounded-lg text-xs font-semibold hover:bg-[#F9FAFB] transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => {
                setMeetingForm({
                  title: '',
                  opportunityId: '',
                  contactName: '',
                  contactEmail: '',
                  scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
                  durationMinutes: 30,
                  notes: '',
                });
                setIsScheduleMeetingModalOpen(true);
              }}
              className="px-3.5 py-2 border border-[#5B49D6]/30 text-[#5B49D6] bg-[#EEEBFB]/50 rounded-lg text-xs font-semibold hover:bg-[#EEEBFB] transition-all flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Schedule Meeting</span>
            </button>
            <button
              onClick={() => setIsAddOppModalOpen(true)}
              className="px-3.5 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Opportunity</span>
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

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-[#E6E8F0] shadow-xs">
          <span className="text-[11px] font-semibold text-[#6B7490] uppercase tracking-wider">Total Pipeline Value</span>
          <div className="text-2xl font-bold text-[#1B2236] mt-1">{formatINR(totalPipelineValue)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#E6E8F0] shadow-xs">
          <span className="text-[11px] font-semibold text-[#6B7490] uppercase tracking-wider">Active Opportunities</span>
          <div className="text-2xl font-bold text-[#5B49D6] mt-1">
            {(stageSummaries.PROSPECTING?.count || 0) +
              (stageSummaries.MEETING?.count || 0) +
              (stageSummaries.PROPOSAL?.count || 0)}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#E6E8F0] shadow-xs">
          <span className="text-[11px] font-semibold text-[#6B7490] uppercase tracking-wider">Won Mandates</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{stageSummaries.WON?.count || 0}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#E6E8F0] shadow-xs">
          <span className="text-[11px] font-semibold text-[#6B7490] uppercase tracking-wider">Client Meetings Logged</span>
          <div className="text-2xl font-bold text-purple-600 mt-1">{meetingsData?.meetings?.length || 0}</div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#E6E8F0] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('PIPELINE')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'PIPELINE'
                ? 'bg-[#5B49D6] text-white shadow-xs'
                : 'bg-white border border-[#E6E8F0] text-[#6B7490] hover:bg-[#F9FAFB]'
            }`}
          >
            Opportunities Kanban
          </button>
          <button
            onClick={() => setActiveTab('MEETINGS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'MEETINGS'
                ? 'bg-[#5B49D6] text-white shadow-xs'
                : 'bg-white border border-[#E6E8F0] text-[#6B7490] hover:bg-[#F9FAFB]'
            }`}
          >
            Client Meetings Tracker ({meetingsData?.meetings?.length || 0})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search company, title, contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[#E6E8F0] bg-white focus:outline-hidden focus:border-[#5B49D6]"
          />
        </div>
      </div>

      {/* TAB 1: KANBAN PIPELINE */}
      {activeTab === 'PIPELINE' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {stagesList.map((st) => {
            const oppsInStage = filteredOpportunities.filter((o: any) => o.stage === st.key);
            const totalStageValue = oppsInStage.reduce((sum: number, o: any) => sum + (o.estimatedValue || 0), 0);

            return (
              <div
                key={st.key}
                className={`bg-[#F8FAFC] rounded-xl border border-[#E6E8F0] border-t-4 ${st.color} p-4 shadow-xs flex flex-col min-h-[500px]`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                  <div>
                    <h3 className="text-xs font-bold text-[#1B2236]">{st.title}</h3>
                    <span className="text-[11px] text-[#64748B] font-medium">{formatINR(totalStageValue)}</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white border border-[#CBD5E1] text-[#334155]">
                    {oppsInStage.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="mt-3 space-y-3 flex-1 overflow-y-auto max-h-[700px] pr-1">
                  {oppsInStage.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#94A3B8]">No opportunities</div>
                  ) : (
                    oppsInStage.map((opp: any) => (
                      <div
                        key={opp.id}
                        className="bg-white rounded-lg border border-[#E2E8F0] p-3.5 shadow-xs hover:border-[#5B49D6]/40 transition-all space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-[#1B2236]">{opp.title}</div>
                            <div className="text-[11px] font-semibold text-[#5B49D6] mt-0.5 flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              <span>{opp.companyName}</span>
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                              opp.priority === 'HIGH'
                                ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                : opp.priority === 'MEDIUM'
                                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                : 'bg-slate-50 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {opp.priority}
                          </span>
                        </div>

                        {/* Value & Openings */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#F8FAFC] p-2 rounded">
                          <div>
                            <span className="text-[#64748B] block text-[10px]">Est. Value</span>
                            <span className="font-bold text-[#1E293B]">
                              {opp.estimatedValue ? formatINR(opp.estimatedValue) : '₹0'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#64748B] block text-[10px]">Openings</span>
                            <span className="font-bold text-[#1E293B]">{opp.estimatedOpenings} Mandates</span>
                          </div>
                        </div>

                        {/* Contact details */}
                        {opp.primaryContact?.name && (
                          <div className="text-[11px] text-[#475569] space-y-0.5">
                            <div className="flex items-center gap-1 font-medium">
                              <Users className="w-3 h-3 text-[#94A3B8]" />
                              <span>{opp.primaryContact.name}</span>
                            </div>
                            {opp.primaryContact.email && (
                              <div className="flex items-center gap-1 text-[10px] text-[#64748B]">
                                <Mail className="w-2.5 h-2.5" />
                                <span>{opp.primaryContact.email}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Next Follow-up in IST */}
                        {opp.nextFollowUpAt && (
                          <div className="text-[10px] text-amber-700 bg-amber-50/60 p-1.5 rounded flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Follow-up: {new Date(opp.nextFollowUpAt).toLocaleDateString('en-GB')}</span>
                          </div>
                        )}

                        {/* Conversion Status or Actions */}
                        {opp.isConverted ? (
                          <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Converted</span>
                            </span>
                          </div>
                        ) : opp.stage === OpportunityStage.WON ? (
                          <div className="pt-2 border-t border-[#F1F5F9]">
                            <button
                              onClick={() => openConvertModal(opp)}
                              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-all shadow-xs"
                            >
                              <Briefcase className="w-3 h-3" />
                              <span>Convert to Job</span>
                            </button>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between text-[11px]">
                            <span className="text-[#64748B] text-[10px]">Move to:</span>
                            <div className="flex items-center gap-1">
                              {opp.stage === OpportunityStage.PROSPECTING && (
                                <button
                                  onClick={() => handleStageChange(opp.id, opp.stage, OpportunityStage.MEETING)}
                                  className="px-2 py-0.5 bg-[#EEEBFB] hover:bg-[#5B49D6] hover:text-white text-[#5B49D6] text-[10px] font-bold rounded transition-all"
                                >
                                  Meeting →
                                </button>
                              )}
                              {opp.stage === OpportunityStage.MEETING && (
                                <button
                                  onClick={() => handleStageChange(opp.id, opp.stage, OpportunityStage.PROPOSAL)}
                                  className="px-2 py-0.5 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 text-[10px] font-bold rounded transition-all"
                                >
                                  Proposal →
                                </button>
                              )}
                              {opp.stage === OpportunityStage.PROPOSAL && (
                                <button
                                  onClick={() => handleStageChange(opp.id, opp.stage, OpportunityStage.WON)}
                                  className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 text-[10px] font-bold rounded transition-all"
                                >
                                  Won ★
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: CLIENT MEETINGS TRACKER */}
      {activeTab === 'MEETINGS' && (
        <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
          <div className="p-4 bg-[#F8FAFC] border-b border-[#E6E8F0] flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#1B2236]">Scheduled Client Meetings</h3>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                Indian Standard Time (IST) schedule with demo calendar synchronization
              </p>
            </div>
            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded border border-purple-200">
              Demo Calendar Provider Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B] font-bold uppercase tracking-wider text-[10px] border-b border-[#E6E8F0]">
                <tr>
                  <th className="py-3 px-4">Date & Time (IST)</th>
                  <th className="py-3 px-4">Prospect / Client</th>
                  <th className="py-3 px-4">Meeting Details</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Status & Sync</th>
                  <th className="py-3 px-4">Outcome / Next Steps</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8F0]">
                {meetingsData?.meetings?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#94A3B8]">
                      No client meetings scheduled.
                    </td>
                  </tr>
                ) : (
                  meetingsData?.meetings?.map((m: any) => (
                    <tr key={m.id} className="hover:bg-[#F8FAFC] transition-all">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-[#1B2236]">{m.timeIST}</div>
                        <div className="text-[10px] text-[#64748B]">
                          {new Date(m.scheduledAt).toLocaleDateString('en-GB')}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-[#5B49D6]">{m.companyName}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#1B2236]">{m.title}</div>
                        <div className="text-[10px] text-[#64748B]">{m.durationMinutes} minutes</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#1B2236]">{m.contactName}</div>
                        {m.contactEmail && <div className="text-[10px] text-[#64748B]">{m.contactEmail}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            m.status === MeetingStatus.COMPLETED
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : m.status === MeetingStatus.SCHEDULED
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-50 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {m.status}
                        </span>
                        <div className="text-[9px] text-[#94A3B8] mt-0.5">{m.calendarProvider} (Active)</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        {m.outcome ? (
                          <div>
                            <div className="text-[#1E293B] font-medium line-clamp-1">{m.outcome}</div>
                            {m.nextAction && (
                              <div className="text-[10px] text-purple-700 mt-0.5 font-medium">
                                Next: {m.nextAction}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#94A3B8] italic">Awaiting meeting completion</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openOutcomeModal(m)}
                          className="px-2.5 py-1 text-xs font-semibold text-[#5B49D6] border border-[#5B49D6]/30 rounded hover:bg-[#EEEBFB] transition-all"
                        >
                          Record Outcome
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD OPPORTUNITY */}
      {isAddOppModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
              <h3 className="text-sm font-bold text-[#1B2236]">Create Sales Opportunity</h3>
              <button onClick={() => setIsAddOppModalOpen(false)}>
                <X className="w-4 h-4 text-[#94A3B8]" />
              </button>
            </div>

            <form onSubmit={handleCreateOpportunity} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#334155] block mb-1">Company / Prospective Client *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nexus FinTech India"
                  value={newOppForm.companyName}
                  onChange={(e) => setNewOppForm({ ...newOppForm, companyName: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#334155] block mb-1">Opportunity / Mandate Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lead Fullstack Engineer Mandate"
                  value={newOppForm.title}
                  onChange={(e) => setNewOppForm({ ...newOppForm, title: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#334155] block mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Ananya Roy"
                    value={newOppForm.contactName}
                    onChange={(e) => setNewOppForm({ ...newOppForm, contactName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#334155] block mb-1">Contact Email</label>
                  <input
                    type="email"
                    placeholder="contact@company.com"
                    value={newOppForm.contactEmail}
                    onChange={(e) => setNewOppForm({ ...newOppForm, contactEmail: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#334155] block mb-1">Estimated Value (₹)</label>
                  <input
                    type="number"
                    value={newOppForm.estimatedValue}
                    onChange={(e) => setNewOppForm({ ...newOppForm, estimatedValue: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#334155] block mb-1">Estimated Openings</label>
                  <input
                    type="number"
                    value={newOppForm.estimatedOpenings}
                    onChange={(e) => setNewOppForm({ ...newOppForm, estimatedOpenings: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#334155] block mb-1">Priority</label>
                  <select
                    value={newOppForm.priority}
                    onChange={(e) => setNewOppForm({ ...newOppForm, priority: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6] bg-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#334155] block mb-1">Location</label>
                  <input
                    type="text"
                    value={newOppForm.location}
                    onChange={(e) => setNewOppForm({ ...newOppForm, location: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#334155] block mb-1">Notes / Scope</label>
                <textarea
                  rows={2}
                  value={newOppForm.notes}
                  onChange={(e) => setNewOppForm({ ...newOppForm, notes: e.target.value })}
                  placeholder="Details discussed during initial outreach..."
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6E8F0]">
                <button
                  type="button"
                  onClick={() => setIsAddOppModalOpen(false)}
                  className="px-3 py-1.5 border border-[#E6E8F0] rounded-lg text-xs font-semibold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 bg-[#5B49D6] text-white rounded-lg text-xs font-bold hover:bg-[#5B49D6]/90 disabled:opacity-50"
                >
                  Create Opportunity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONVERT WON OPPORTUNITY TO DRAFT JOB */}
      {isConvertModalOpen && selectedOpportunity && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
              <div>
                <h3 className="text-sm font-bold text-[#1B2236]">Convert Opportunity to Job Mandate</h3>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Converts {selectedOpportunity.companyName} into an active Client & instantiates a DRAFT job.
                </p>
              </div>
              <button onClick={() => setIsConvertModalOpen(false)}>
                <X className="w-4 h-4 text-[#94A3B8]" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] space-y-1">
              <span className="font-bold block">Status Integrity Rule:</span>
              <p>
                Jobs created through conversion are strictly placed in <strong>DRAFT</strong> status. They require
                manager sign-off before becoming active.
              </p>
            </div>

            <form onSubmit={handleConvertToJob} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#334155] block mb-1">Agreed Fee Percentage (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={convertForm.feePercentage}
                    onChange={(e) => setConvertForm({ ...convertForm, feePercentage: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#334155] block mb-1">Commercial Payment Terms</label>
                  <select
                    value={convertForm.paymentTerms}
                    onChange={(e) => setConvertForm({ ...convertForm, paymentTerms: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg bg-white"
                  >
                    <option value="NET_15">NET 15</option>
                    <option value="NET_30">NET 30</option>
                    <option value="NET_45">NET 45</option>
                    <option value="NET_60">NET 60</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#334155] block mb-1">Job Mandate Title *</label>
                <input
                  type="text"
                  required
                  value={convertForm.jobTitle}
                  onChange={(e) => setConvertForm({ ...convertForm, jobTitle: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#334155] block mb-1">Assigned Recruiter Owner *</label>
                  <select
                    required
                    value={convertForm.recruiterOwnerId}
                    onChange={(e) => setConvertForm({ ...convertForm, recruiterOwnerId: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg bg-white"
                  >
                    {recruiters.map((rec: any) => (
                      <option key={rec.id} value={rec.id}>
                        {rec.name} ({rec.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#334155] block mb-1">Target Openings</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={convertForm.openings}
                    onChange={(e) => setConvertForm({ ...convertForm, openings: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#334155] block mb-1">Job Description & Tech Stack</label>
                <textarea
                  rows={3}
                  value={convertForm.description}
                  onChange={(e) => setConvertForm({ ...convertForm, description: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6E8F0]">
                <button
                  type="button"
                  onClick={() => setIsConvertModalOpen(false)}
                  className="px-3 py-1.5 border border-[#E6E8F0] rounded-lg text-xs font-semibold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  Confirm & Create DRAFT Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SCHEDULE CLIENT MEETING */}
      {isScheduleMeetingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
              <h3 className="text-sm font-bold text-[#1B2236]">Schedule Client Discovery Meeting</h3>
              <button onClick={() => setIsScheduleMeetingModalOpen(false)}>
                <X className="w-4 h-4 text-[#94A3B8]" />
              </button>
            </div>

            <form onSubmit={handleScheduleMeeting} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#334155] block mb-1">Meeting Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Discovery & Commercial Terms Alignment"
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#334155] block mb-1">Link to Opportunity (Optional)</label>
                <select
                  value={meetingForm.opportunityId}
                  onChange={(e) => {
                    const opp = allOpportunities.find((o: any) => o.id === e.target.value);
                    setMeetingForm({
                      ...meetingForm,
                      opportunityId: e.target.value,
                      contactName: opp?.primaryContact?.name || meetingForm.contactName,
                      contactEmail: opp?.primaryContact?.email || meetingForm.contactEmail,
                    });
                  }}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg bg-white"
                >
                  <option value="">-- None (Ad-hoc Client Meeting) --</option>
                  {allOpportunities.map((o: any) => (
                    <option key={o.id} value={o.id}>
                      {o.companyName} — {o.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#334155] block mb-1">Contact Name *</label>
                  <input
                    type="text"
                    required
                    value={meetingForm.contactName}
                    onChange={(e) => setMeetingForm({ ...meetingForm, contactName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#334155] block mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={meetingForm.contactEmail}
                    onChange={(e) => setMeetingForm({ ...meetingForm, contactEmail: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#334155] block mb-1">Date & Time (IST) *</label>
                  <input
                    type="datetime-local"
                    required
                    value={meetingForm.scheduledAt}
                    onChange={(e) => setMeetingForm({ ...meetingForm, scheduledAt: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#334155] block mb-1">Duration (Mins)</label>
                  <select
                    value={meetingForm.durationMinutes}
                    onChange={(e) => setMeetingForm({ ...meetingForm, durationMinutes: parseInt(e.target.value, 10) || 30 })}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg bg-white"
                  >
                    <option value="15">15 mins</option>
                    <option value="30">30 mins</option>
                    <option value="45">45 mins</option>
                    <option value="60">60 mins</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#334155] block mb-1">Agenda / Meeting Notes</label>
                <textarea
                  rows={2}
                  value={meetingForm.notes}
                  onChange={(e) => setMeetingForm({ ...meetingForm, notes: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6E8F0]">
                <button
                  type="button"
                  onClick={() => setIsScheduleMeetingModalOpen(false)}
                  className="px-3 py-1.5 border border-[#E6E8F0] rounded-lg text-xs font-semibold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 bg-[#5B49D6] text-white rounded-lg text-xs font-bold hover:bg-[#5B49D6]/90 disabled:opacity-50"
                >
                  Schedule Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RECORD MEETING OUTCOME */}
      {isOutcomeModalOpen && selectedMeeting && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
              <h3 className="text-sm font-bold text-[#1B2236]">Record Meeting Outcome</h3>
              <button onClick={() => setIsOutcomeModalOpen(false)}>
                <X className="w-4 h-4 text-[#94A3B8]" />
              </button>
            </div>

            <form onSubmit={handleUpdateOutcome} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#334155] block mb-1">Meeting Status</label>
                <select
                  value={outcomeForm.status}
                  onChange={(e) => setOutcomeForm({ ...outcomeForm, status: e.target.value as any })}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg bg-white"
                >
                  <option value={MeetingStatus.COMPLETED}>Completed</option>
                  <option value={MeetingStatus.CANCELLED}>Cancelled</option>
                  <option value={MeetingStatus.RESCHEDULED}>Rescheduled</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#334155] block mb-1">Outcome Summary *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Client agreed to standard rate card of 15% and approved interview rounds."
                  value={outcomeForm.outcome}
                  onChange={(e) => setOutcomeForm({ ...outcomeForm, outcome: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#334155] block mb-1">Next Action Required</label>
                <input
                  type="text"
                  placeholder="e.g. Draft proposal & share contract via email"
                  value={outcomeForm.nextAction}
                  onChange={(e) => setOutcomeForm({ ...outcomeForm, nextAction: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#334155] block mb-1">Next Follow-up Date (Optional)</label>
                <input
                  type="date"
                  value={outcomeForm.nextFollowUpAt}
                  onChange={(e) => setOutcomeForm({ ...outcomeForm, nextFollowUpAt: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6E8F0]">
                <button
                  type="button"
                  onClick={() => setIsOutcomeModalOpen(false)}
                  className="px-3 py-1.5 border border-[#E6E8F0] rounded-lg text-xs font-semibold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 bg-[#5B49D6] text-white rounded-lg text-xs font-bold hover:bg-[#5B49D6]/90 disabled:opacity-50"
                >
                  Save Outcome
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
