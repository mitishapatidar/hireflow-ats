'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../../../../components/layout/PageHeader';
import {
  CalendarClock,
  Plus,
  Play,
  Pause,
  History,
  Send,
  Eye,
  X,
  RefreshCw,
  Building2,
  User,
  Shield,
  Clock,
  Check,
} from 'lucide-react';
import {
  getClientSchedulesAction,
  createClientScheduleAction,
  toggleClientScheduleStatusAction,
  getClientScheduleHistoryAction,
} from '@/actions/reports';

export default function ClientSchedulesPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [scheduleName, setScheduleName] = useState('');
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [deliveryDay, setDeliveryDay] = useState('MONDAY');
  const [deliveryTime, setDeliveryTime] = useState('08:30');
  const [period] = useState<'LAST_7_DAYS' | 'LAST_30_DAYS' | 'MONTH_TO_DATE'>('LAST_7_DAYS');
  const [clientContacts, setClientContacts] = useState<any[]>([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [includeSections, setIncludeSections] = useState<string[]>([
    'JOB_PROGRESS',
    'SUBMITTED_PROFILES',
    'NEXT_STEPS',
  ]);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Email Preview Modal
  const [previewSchedule, setPreviewSchedule] = useState<any | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  // History Modal
  const [historySchedule, setHistorySchedule] = useState<any | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load schedules
  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getClientSchedulesAction();
      setSchedules(data);
    } catch {
      // Mock / fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  // Load clients when create modal opens
  const handleOpenCreateModal = async () => {
    setIsCreateModalOpen(true);
    try {
      const res = await fetch('/api/clients?limit=100');
      if (res.ok) {
        const json = await res.json();
        const clientList = json.data?.items || json.data || [];
        setClients(clientList);
        if (clientList.length > 0) {
          handleSelectClient(clientList[0].id, clientList);
        }
      }
    } catch {
      // Safe fallback
    }
  };

  const handleSelectClient = async (clientId: string, clientList = clients) => {
    setSelectedClientId(clientId);
    const chosen = clientList.find((c) => c.id === clientId);
    if (chosen) {
      setScheduleName(`${chosen.legalName} Hiring Status Report`);
      try {
        const res = await fetch(`/api/clients/${clientId}`);
        if (res.ok) {
          const json = await res.json();
          const contacts = json.data?.contacts || [];
          setClientContacts(contacts);
          setSelectedRecipientIds(contacts.slice(0, 1).map((c: any) => c.id));
        }
      } catch {
        setClientContacts([]);
      }
    }
  };

  const handleToggleSection = (section: string) => {
    if (includeSections.includes(section)) {
      if (includeSections.length > 1) {
        setIncludeSections(includeSections.filter((s) => s !== section));
      }
    } else {
      setIncludeSections([...includeSections, section]);
    }
  };

  const handleToggleRecipient = (contactId: string) => {
    if (selectedRecipientIds.includes(contactId)) {
      if (selectedRecipientIds.length > 1) {
        setSelectedRecipientIds(selectedRecipientIds.filter((id) => id !== contactId));
      }
    } else {
      setSelectedRecipientIds([...selectedRecipientIds, contactId]);
    }
  };

  // Submit new schedule
  const handleCreateSchedule = async () => {
    if (!selectedClientId || selectedRecipientIds.length === 0) {
      alert('Please select a client and at least one verified contact.');
      return;
    }

    setCreateSubmitting(true);
    try {
      await createClientScheduleAction({
        clientId: selectedClientId,
        name: scheduleName || 'Weekly Client Hiring Status',
        frequency,
        deliveryDay: frequency === 'WEEKLY' ? deliveryDay : undefined,
        deliveryTime,
        timezone: 'Asia/Kolkata',
        period,
        recipientIds: selectedRecipientIds,
        includeSections: includeSections as any,
      });

      setIsCreateModalOpen(false);
      loadSchedules();
    } catch (err: any) {
      alert(`Creation failed: ${err.message}`);
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Toggle status
  const handleToggleStatus = async (schedule: any) => {
    const action = schedule.status === 'ACTIVE' ? 'pause' : 'activate';
    try {
      await toggleClientScheduleStatusAction(schedule.id, action);
      loadSchedules();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  // Open email preview
  const handleOpenPreview = async (schedule: any) => {
    setPreviewSchedule(schedule);
    setPreviewLoading(true);
    setTestSuccess(false);
    try {
      const res = await fetch(`/api/reports/client-schedules/${schedule.id}/preview`, {
        method: 'POST',
      });
      if (res.ok) {
        const json = await res.json();
        setPreviewHtml(json.data.html);
      }
    } catch {
      setPreviewHtml('<p>Failed to load email preview.</p>');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Send Test Preview
  const handleSendTest = async () => {
    if (!previewSchedule) return;
    setTestSending(true);
    try {
      const res = await fetch(`/api/reports/client-schedules/${previewSchedule.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: previewSchedule.recipients[0]?.id }),
      });
      if (res.ok) {
        setTestSuccess(true);
        setTimeout(() => setTestSuccess(false), 3000);
      } else {
        alert('Failed sending test preview.');
      }
    } catch {
      alert('Error sending test preview.');
    } finally {
      setTestSending(false);
    }
  };

  // Open delivery history
  const handleOpenHistory = async (schedule: any) => {
    setHistorySchedule(schedule);
    setHistoryLoading(true);
    try {
      const data = await getClientScheduleHistoryAction(schedule.id);
      setHistoryList(data);
    } catch {
      setHistoryList([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Retry failed delivery
  const handleRetryDelivery = async () => {
    if (!historySchedule) return;
    try {
      const res = await fetch(`/api/reports/client-schedules/${historySchedule.id}/retry`, {
        method: 'POST',
      });
      if (res.ok) {
        alert('Retry delivery dispatched successfully.');
        const updatedHistory = await getClientScheduleHistoryAction(historySchedule.id);
        setHistoryList(updatedHistory);
      }
    } catch {
      alert('Failed to retry delivery.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Scheduled Client Reports"
        subtitle="Automated cross-account recruitment status reports delivered directly to authorized client stakeholders."
        breadcrumbs={[{ label: 'Reports', href: '/reports' }, { label: 'Client Schedules' }]}
        actions={
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-[#5B49D6] hover:bg-[#4a39b8] text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            <span>New Scheduled Report</span>
          </button>
        }
      />

      {/* Security Banner: Zero-Leak & Delivery-Time Revalidation */}
      <div className="bg-[#EEEBFB] border border-[#C7D2FE] rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-[#5B49D6] shrink-0 mt-0.5" />
        <div className="text-xs text-[#1E2A4A] space-y-1">
          <div className="font-bold">Client Report Security Guarantee</div>
          <p className="text-[#6B7490]">
            Every scheduled dispatch undergoes real-time permission revalidation immediately prior to delivery.
            Reports strictly exclude internal candidate salary notes, recruiter margin figures, and internal reviewer scorecards.
            If a client contact is deactivated or an mandate is paused, report distribution safely skips unpermitted records.
          </p>
        </div>
      </div>

      {/* Schedules Table Card */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E6E8F0] flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#1B2236] flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#5B49D6]" />
            <span>Active Client Schedules ({schedules.length})</span>
          </h3>
          <button
            onClick={loadSchedules}
            disabled={loading}
            className="p-1.5 rounded-lg border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#6B7490] cursor-pointer"
            title="Refresh Schedules"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F6F7FB] border-b border-[#E6E8F0] text-[#6B7490]">
                <th className="px-4 py-3 font-semibold">Client Company</th>
                <th className="px-4 py-3 font-semibold">Report Name</th>
                <th className="px-4 py-3 font-semibold">Recipients</th>
                <th className="px-4 py-3 font-semibold">Cadence (IST)</th>
                <th className="px-4 py-3 font-semibold">Last Delivery</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[#6B7490]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#5B49D6]" />
                    <span>Loading schedules...</span>
                  </td>
                </tr>
              ) : schedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#6B7490]">
                    <CalendarClock className="w-8 h-8 mx-auto mb-2 text-[#6B7490]/50" />
                    <p className="font-semibold text-sm text-[#1B2236]">No client report schedules configured</p>
                    <p className="text-xs text-[#6B7490] mt-1">
                      Create your first automated report schedule to deliver weekly recruitment updates to client contacts.
                    </p>
                  </td>
                </tr>
              ) : (
                schedules.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F6F7FB]/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-[#1B2236]">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#5B49D6]" />
                        <span>{s.client.legalName}</span>
                      </div>
                      <span className="text-[10px] text-[#6B7490] font-normal">{s.client.code}</span>
                    </td>
                    <td className="px-4 py-3 text-[#1B2236] font-medium">
                      <div>{s.name}</div>
                      <span className="text-[10px] text-[#6B7490]">v{s.version} &bull; by {s.creatorName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.recipients.map((r: any) => (
                          <span
                            key={r.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F6F7FB] border border-[#E6E8F0] text-[11px] text-[#1B2236]"
                          >
                            <User className="w-2.5 h-2.5 text-[#6B7490]" />
                            <span>{r.name}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#1B2236]">
                      <div className="font-semibold">{s.frequency}</div>
                      <div className="text-[11px] text-[#6B7490] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {s.deliveryDay ? `${s.deliveryDay} ` : ''}at {s.deliveryTime}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#6B7490]">
                      {s.lastDeliveredAt ? (
                        <span className="text-[#1B2236] font-medium">
                          {new Date(s.lastDeliveredAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </span>
                      ) : (
                        <span>Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          s.status === 'ACTIVE'
                            ? 'bg-[#DCFCE7] text-[#15803D]'
                            : s.status === 'PAUSED'
                            ? 'bg-[#FEF9C3] text-[#A16207]'
                            : s.status === 'FAILED'
                            ? 'bg-[#FEE2E2] text-[#B91C1C]'
                            : 'bg-[#F1F5F9] text-[#475569]'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenPreview(s)}
                          className="p-1.5 rounded-lg border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#6B7490] hover:text-[#5B49D6] cursor-pointer"
                          title="Preview Email"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(s)}
                          className={`p-1.5 rounded-lg border border-[#E6E8F0] hover:bg-[#F6F7FB] cursor-pointer ${
                            s.status === 'ACTIVE' ? 'text-[#A16207]' : 'text-[#15803D]'
                          }`}
                          title={s.status === 'ACTIVE' ? 'Pause Schedule' : 'Activate Schedule'}
                        >
                          {s.status === 'ACTIVE' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleOpenHistory(s)}
                          className="p-1.5 rounded-lg border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#6B7490] hover:text-[#1B2236] cursor-pointer"
                          title="Delivery History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Schedule Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
              <h3 className="font-bold text-base text-[#1B2236] flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-[#5B49D6]" />
                <span>Create Scheduled Client Report</span>
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-[#6B7490] hover:text-[#1B2236]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: Client Selection */}
            <div>
              <label className="text-xs font-semibold text-[#6B7490] block mb-1">Target Client (Locked Scope)</label>
              <select
                value={selectedClientId}
                onChange={(e) => handleSelectClient(e.target.value)}
                className="w-full text-xs border border-[#E6E8F0] focus:border-[#5B49D6] rounded-lg p-2.5 outline-none bg-white font-medium text-[#1B2236]"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.legalName} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Schedule Name */}
            <div>
              <label className="text-xs font-semibold text-[#6B7490] block mb-1">Schedule Name</label>
              <input
                type="text"
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
                className="w-full text-xs border border-[#E6E8F0] focus:border-[#5B49D6] rounded-lg p-2.5 outline-none"
              />
            </div>

            {/* Step 2: Verified Recipients */}
            <div>
              <label className="text-xs font-semibold text-[#6B7490] block mb-1">
                Verified Client Contacts ({selectedRecipientIds.length} selected)
              </label>
              {clientContacts.length === 0 ? (
                <div className="p-3 bg-[#FEF2F2] border border-[#F87171] rounded-lg text-xs text-[#DC2626]">
                  No contacts found for this client. Please add client contacts first.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-32 overflow-y-auto border border-[#E6E8F0] rounded-lg p-2">
                  {clientContacts.map((contact) => {
                    const checked = selectedRecipientIds.includes(contact.id);
                    return (
                      <label
                        key={contact.id}
                        className="flex items-center justify-between p-1.5 rounded hover:bg-[#F6F7FB] text-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleRecipient(contact.id)}
                            className="rounded border-[#E6E8F0] text-[#5B49D6]"
                          />
                          <span className="font-semibold text-[#1B2236]">{contact.name}</span>
                          <span className="text-[#6B7490]">({contact.email})</span>
                        </div>
                        {contact.isPrimary && (
                          <span className="text-[10px] bg-[#EEEBFB] text-[#5B49D6] px-1.5 py-0.5 rounded-xs font-bold">
                            PRIMARY
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 3: Cadence */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#6B7490] block mb-1">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className="w-full text-xs border border-[#E6E8F0] rounded-lg p-2 outline-none bg-white"
                >
                  <option value="DAILY">Daily (Mon-Fri)</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>

              {frequency === 'WEEKLY' && (
                <div>
                  <label className="text-xs font-semibold text-[#6B7490] block mb-1">Day</label>
                  <select
                    value={deliveryDay}
                    onChange={(e) => setDeliveryDay(e.target.value)}
                    className="w-full text-xs border border-[#E6E8F0] rounded-lg p-2 outline-none bg-white"
                  >
                    <option value="MONDAY">Monday</option>
                    <option value="TUESDAY">Tuesday</option>
                    <option value="WEDNESDAY">Wednesday</option>
                    <option value="THURSDAY">Thursday</option>
                    <option value="FRIDAY">Friday</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-[#6B7490] block mb-1">Delivery Time (IST)</label>
                <input
                  type="text"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  placeholder="08:30"
                  className="w-full text-xs border border-[#E6E8F0] rounded-lg p-2 outline-none"
                />
              </div>
            </div>

            {/* Step 4: Content Sections */}
            <div>
              <label className="text-xs font-semibold text-[#6B7490] block mb-1.5">Approved Content Sections</label>
              <div className="space-y-1.5">
                {[
                  { id: 'JOB_PROGRESS', label: '1. Active Job Mandates & Progress' },
                  { id: 'SUBMITTED_PROFILES', label: '2. Submitted Candidate Profiles (Safe Allow-List)' },
                  { id: 'NEXT_STEPS', label: '3. Scheduled Next Steps & Interviews' },
                ].map((sec) => (
                  <label key={sec.id} className="flex items-center gap-2 text-xs text-[#1B2236] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeSections.includes(sec.id)}
                      onChange={() => handleToggleSection(sec.id)}
                      className="rounded border-[#E6E8F0] text-[#5B49D6]"
                    />
                    <span>{sec.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6E8F0]">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-[#6B7490] hover:text-[#1B2236] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSchedule}
                disabled={createSubmitting}
                className="px-4 py-2 bg-[#5B49D6] hover:bg-[#4a39b8] text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {createSubmitting ? 'Creating...' : 'Create Scheduled Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {previewSchedule && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xl max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
              <div>
                <h3 className="font-bold text-base text-[#1B2236]">Scheduled Report Email Preview</h3>
                <p className="text-xs text-[#6B7490]">{previewSchedule.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSendTest}
                  disabled={testSending}
                  className="px-3 py-1.5 bg-[#EEEBFB] hover:bg-[#e0daf9] text-[#5B49D6] rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{testSending ? 'Sending...' : 'Send Test Preview'}</span>
                </button>
                <button onClick={() => setPreviewSchedule(null)} className="text-[#6B7490] hover:text-[#1B2236]">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {testSuccess && (
              <div className="p-3 bg-[#DCFCE7] border border-[#86EFAC] rounded-lg text-xs font-semibold text-[#15803D] flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Test preview sent to {previewSchedule.recipients[0]?.email || 'primary contact'}.</span>
              </div>
            )}

            {previewLoading ? (
              <div className="py-16 text-center text-[#6B7490]">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#5B49D6]" />
                <p>Rendering email template with real-time client data...</p>
              </div>
            ) : (
              <div
                className="border border-[#E6E8F0] rounded-lg p-2 bg-[#F6F7FB] overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}
          </div>
        </div>
      )}

      {/* Delivery History Modal */}
      {historySchedule && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
              <div>
                <h3 className="font-bold text-base text-[#1B2236]">Delivery History & Execution Log</h3>
                <p className="text-xs text-[#6B7490]">{historySchedule.name}</p>
              </div>
              <button onClick={() => setHistorySchedule(null)} className="text-[#6B7490] hover:text-[#1B2236]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F6F7FB] border-b border-[#E6E8F0] text-[#6B7490]">
                    <th className="px-3 py-2 font-semibold">Executed At</th>
                    <th className="px-3 py-2 font-semibold">Recipients</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Notes / Failure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E8F0]">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-[#6B7490]">
                        Loading execution logs...
                      </td>
                    </tr>
                  ) : historyList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-[#6B7490]">
                        No deliveries recorded yet.
                      </td>
                    </tr>
                  ) : (
                    historyList.map((h) => (
                      <tr key={h.id}>
                        <td className="px-3 py-2 font-medium text-[#1B2236]">
                          {new Date(h.executedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </td>
                        <td className="px-3 py-2 text-[#1B2236]">
                          {h.successCount} sent / {h.recipientCount} total
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              h.status === 'SENT'
                                ? 'bg-[#DCFCE7] text-[#15803D]'
                                : h.status === 'SKIPPED'
                                ? 'bg-[#FEF9C3] text-[#A16207]'
                                : 'bg-[#FEE2E2] text-[#B91C1C]'
                            }`}
                          >
                            {h.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[#6B7490] max-w-xs truncate">
                          {h.failureReason || 'Delivered successfully.'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E6E8F0]">
              <button
                onClick={handleRetryDelivery}
                className="px-3 py-1.5 bg-[#5B49D6] hover:bg-[#4a39b8] text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Trigger Manual Retry
              </button>
              <button
                onClick={() => setHistorySchedule(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#6B7490] hover:text-[#1B2236] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
