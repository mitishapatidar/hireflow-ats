'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  FileText,
  MessageSquare,
  Sparkles,
  Plus,
  Eye,
  Edit2,
  Check,
  AlertTriangle,
  Lock,
  ArrowLeft,
  Mail,
  Copy,
  Info,
} from 'lucide-react';
import {
  createTemplateAction,
  updateTemplateAction,
  previewTemplateAction,
  updateTeamSignatureAction,
} from '@/actions/communications';
import { SUPPORTED_MERGE_FIELDS } from '@hireflow/shared';

interface TemplatesClientViewProps {
  initialTemplates: any[];
  initialSignatureData: any;
  currentUserRole: string;
}

export function TemplatesClientView({
  initialTemplates,
  initialSignatureData,
  currentUserRole,
}: TemplatesClientViewProps) {
  const [activeTab, setActiveTab] = useState<'EMAIL' | 'WHATSAPP' | 'SIGNATURE'>('EMAIL');
  const [templates, setTemplates] = useState<any[]>(initialTemplates);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [isPending, startTransition] = useTransition();

  // Create Template Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newChannel, setNewChannel] = useState<'EMAIL' | 'WHATSAPP'>('EMAIL');
  const [newCategory, setNewCategory] = useState<string>('OUTREACH');
  const [newSubject, setNewSubject] = useState<string>('');
  const [newBody, setNewBody] = useState<string>('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [renderedPreview, setRenderedPreview] = useState<any>(null);

  // Corporate Team Signature State
  const [signatureHtml, setSignatureHtml] = useState<string>(
    initialSignatureData?.signatureHtml || ''
  );
  const [designation, setDesignation] = useState<string>(
    initialSignatureData?.designation || ''
  );
  const [companyName, setCompanyName] = useState<string>(
    initialSignatureData?.companyName || ''
  );
  const [phone, setPhone] = useState<string>(initialSignatureData?.phone || '');
  const [logoUrl, setLogoUrl] = useState<string>(initialSignatureData?.logoUrl || '');
  const [signatureSuccess, setSignatureSuccess] = useState<string | null>(null);
  const [signatureError, setSignatureError] = useState<string | null>(null);

  const isAdmin = currentUserRole === 'ADMIN';

  // Open Preview Modal
  const handleOpenPreview = async (template: any) => {
    setPreviewTemplate(template);
    setPreviewModalOpen(true);
    const res = await previewTemplateAction(template.id);
    if (res.success && res.data) {
      setRenderedPreview(res.data);
    }
  };

  // Insert merge field chip into body textarea
  const insertMergeField = (fieldName: string) => {
    setNewBody((prev) => `${prev} {{${fieldName}}}`);
  };

  // Handle Create Template Submit
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newTitle.trim() || !newBody.trim()) {
      setCreateError('Title and body are required.');
      return;
    }
    if (newChannel === 'EMAIL' && !newSubject.trim()) {
      setCreateError('Email templates require a subject line.');
      return;
    }

    startTransition(async () => {
      const res = await createTemplateAction({
        title: newTitle,
        channel: newChannel,
        category: newCategory as any,
        subject: newChannel === 'EMAIL' ? newSubject : null,
        body: newBody,
      });

      if (res.success && res.data) {
        setTemplates((prev) => [res.data, ...prev]);
        setShowCreateModal(false);
        setNewTitle('');
        setNewSubject('');
        setNewBody('');
      } else {
        setCreateError(res.error || 'Failed to create template');
      }
    });
  };

  // Handle Team Signature Update (Admin Only)
  const handleUpdateSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignatureSuccess(null);
    setSignatureError(null);

    startTransition(async () => {
      const res = await updateTeamSignatureAction({
        signatureHtml,
        designation,
        companyName,
        phone,
        logoUrl: logoUrl || null,
      });

      if (res.success) {
        setSignatureSuccess('Shared corporate team signature updated successfully.');
      } else {
        setSignatureError(res.error || 'Failed to update signature');
      }
    });
  };

  const filteredTemplates = templates.filter((t) => {
    if (t.channel !== activeTab) return false;
    if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-12">
      {/* Top Header */}
      <div className="bg-white border-b border-[#E6E8F0] px-6 py-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7490] uppercase tracking-wider mb-1">
          <Link href="/communications" className="hover:text-[#5B49D6] flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Communications Inbox
          </Link>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-2xl font-bold text-[#1B2236] tracking-tight">
              Templates & Team Signature
            </h1>
            <p className="text-xs text-[#6B7490] mt-0.5">
              Standardized outreach templates, Meta-approved WhatsApp flows, and admin-governed corporate signatures.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setNewChannel(activeTab === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL');
                setShowCreateModal(true);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#5B49D6] hover:bg-[#4C3BC2] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Template</span>
            </button>
          </div>
        </div>

        {/* Tab Headers */}
        <div className="flex items-center gap-6 mt-6 border-b border-[#E6E8F0]">
          <button
            type="button"
            onClick={() => setActiveTab('EMAIL')}
            className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'EMAIL'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Email Templates ({templates.filter((t) => t.channel === 'EMAIL').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('WHATSAPP')}
            className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'WHATSAPP'
                ? 'border-[#22C55E] text-[#16A34A]'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>WhatsApp Templates ({templates.filter((t) => t.channel === 'WHATSAPP').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SIGNATURE')}
            className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'SIGNATURE'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#5B49D6]" />
            <span>Shared Corporate Signature {isAdmin ? '(Admin)' : '(Read-Only)'}</span>
          </button>
        </div>
      </div>

      {/* Main Body Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* TAB 1 & 2: Templates Grids */}
        {(activeTab === 'EMAIL' || activeTab === 'WHATSAPP') && (
          <div>
            {/* Category Filter Chips */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
              {['ALL', 'OUTREACH', 'INTERVIEW_INVITE', 'REJECTION', 'OFFER', 'FOLLOW_UP'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    categoryFilter === cat
                      ? 'bg-[#1B2236] text-white font-semibold'
                      : 'bg-white border border-[#E6E8F0] text-[#6B7490] hover:bg-[#F4F5FA]'
                  }`}
                >
                  {cat.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Templates Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-[#F4F1FD] text-[#5B49D6]">
                        {template.category}
                      </span>

                      {template.channel === 'WHATSAPP' && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            template.providerApprovalState === 'APPROVED'
                              ? 'bg-[#DCFCE7] text-[#15803D]'
                              : 'bg-[#FEF3C7] text-[#B45309]'
                          }`}
                        >
                          Meta: {template.providerApprovalState}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-[#1B2236] mt-3">{template.title}</h3>

                    {template.subject && (
                      <p className="text-xs font-semibold text-[#5B49D6] mt-1 truncate">
                        Subject: {template.subject}
                      </p>
                    )}

                    <p className="text-xs text-[#6B7490] mt-2 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                      {template.body.replace(/<[^>]*>?/gm, '')}
                    </p>

                    {/* Detected Variables */}
                    {template.variables && template.variables.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {template.variables.map((v: string) => (
                          <span
                            key={v}
                            className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#F8F9FC] border border-[#E6E8F0] text-[#6B7490]"
                          >
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-[#E6E8F0] flex items-center justify-between">
                    <span className="text-[10px] text-[#8F97B0]">
                      Language: {template.language || 'en'}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenPreview(template)}
                      className="px-3 py-1.5 text-xs font-medium text-[#5B49D6] bg-[#F4F1FD] hover:bg-[#EAE4FB] rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Test Preview</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Shared Corporate Team Signature (Admin-Owned) */}
        {activeTab === 'SIGNATURE' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Signature Settings Form */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-[#1B2236]">Corporate Email Signature</h2>
                  <p className="text-xs text-[#6B7490]">
                    Admin-controlled signature auto-appended to all recruiter outbound emails.
                  </p>
                </div>

                {!isAdmin && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#FEF3C7] text-[#92400E] flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Read-Only for Recruiters
                  </span>
                )}
              </div>

              {!isAdmin && (
                <div className="mb-4 p-3 rounded-lg bg-[#FEF3C7] border border-[#FCD34D] text-xs text-[#92400E] flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Only Administrators can modify the shared corporate signature template. Recruiter personal details (Name, Email, Designation) are dynamically resolved upon send.
                  </span>
                </div>
              )}

              {signatureSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-[#DCFCE7] text-xs text-[#15803D]">
                  {signatureSuccess}
                </div>
              )}
              {signatureError && (
                <div className="mb-4 p-3 rounded-lg bg-[#FEE2E2] text-xs text-[#B91C1C]">
                  {signatureError}
                </div>
              )}

              <form onSubmit={handleUpdateSignature} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1B2236] mb-1">
                      Organization / Company Name
                    </label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#E6E8F0] rounded-lg disabled:bg-[#F8F9FC] text-[#1B2236]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1B2236] mb-1">
                      Default Department / Designation
                    </label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#E6E8F0] rounded-lg disabled:bg-[#F8F9FC] text-[#1B2236]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1B2236] mb-1">
                      Headquarters Phone
                    </label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#E6E8F0] rounded-lg disabled:bg-[#F8F9FC] text-[#1B2236]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1B2236] mb-1">
                      Logo URL
                    </label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#E6E8F0] rounded-lg disabled:bg-[#F8F9FC] text-[#1B2236]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#1B2236]">Signature HTML Template</label>
                    <span className="text-[10px] text-[#5B49D6]">
                      Tokens: {'{{name}}'}, {'{{designation}}'}, {'{{email}}'}, {'{{phone}}'}
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    disabled={!isAdmin}
                    value={signatureHtml}
                    onChange={(e) => setSignatureHtml(e.target.value)}
                    className="w-full p-3 font-mono text-xs border border-[#E6E8F0] rounded-lg disabled:bg-[#F8F9FC] text-[#1B2236]"
                  />
                </div>

                {isAdmin && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="px-5 py-2 text-xs font-semibold text-white bg-[#5B49D6] hover:bg-[#4C3BC2] rounded-lg shadow-sm transition-colors"
                    >
                      {isPending ? 'Saving...' : 'Save Corporate Signature'}
                    </button>
                  </div>
                )}
              </form>
            </div>

            {/* Right: Live Rendered Signature Preview */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-[#5B49D6]" />
                <h3 className="text-sm font-bold text-[#1B2236]">Live Recruiter Preview</h3>
              </div>
              <p className="text-xs text-[#6B7490] mb-4">
                This shows how the signature renders below candidate emails sent by your team:
              </p>

              <div className="flex-1 bg-[#FAFBFD] p-5 rounded-lg border border-[#E6E8F0] flex items-center justify-center">
                <div
                  className="w-full bg-white p-4 rounded border border-[#E6E8F0] shadow-sm text-xs"
                  dangerouslySetInnerHTML={{
                    __html: initialSignatureData?.previewRendered || signatureHtml,
                  }}
                />
              </div>

              <div className="mt-4 p-3 bg-[#F4F5FA] rounded-lg text-[11px] text-[#6B7490]">
                Strict Rule: Corporate signatures are applied strictly to Email messages and never appended to WhatsApp or SMS alerts.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CREATE TEMPLATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E6E8F0]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#1B2236]">Create New Template</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[#6B7490] hover:text-[#1B2236]"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-2.5 rounded-lg bg-[#FEE2E2] text-xs text-[#B91C1C]">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1B2236] mb-1">Template Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Technical Round Confirmation"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E6E8F0] rounded-lg text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1B2236] mb-1">Channel</label>
                  <select
                    value={newChannel}
                    onChange={(e: any) => setNewChannel(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E6E8F0] rounded-lg text-[#1B2236]"
                  >
                    <option value="EMAIL">Email</option>
                    <option value="WHATSAPP">WhatsApp</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1B2236] mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E6E8F0] rounded-lg text-[#1B2236]"
                  >
                    <option value="OUTREACH">Outreach</option>
                    <option value="INTERVIEW_INVITE">Interview Invite</option>
                    <option value="REJECTION">Rejection</option>
                    <option value="OFFER">Offer</option>
                    <option value="FOLLOW_UP">Follow Up</option>
                  </select>
                </div>
              </div>

              {newChannel === 'EMAIL' && (
                <div>
                  <label className="block text-xs font-bold text-[#1B2236] mb-1">
                    Subject Line *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Next Steps with Aureva Capital for {{round}}"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E6E8F0] rounded-lg text-[#1B2236]"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#1B2236]">Template Body *</label>
                  <span className="text-[10px] text-[#6B7490]">Click chips below to insert</span>
                </div>

                {/* Merge Field Selector Chips */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {SUPPORTED_MERGE_FIELDS.map((field) => (
                    <button
                      key={field}
                      type="button"
                      onClick={() => insertMergeField(field)}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#F4F1FD] hover:bg-[#EAE4FB] text-[#5B49D6] border border-[#D8D2FB] transition-colors"
                    >
                      +{`{{${field}}}`}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={5}
                  placeholder="Type your message body..."
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  className="w-full p-3 text-xs border border-[#E6E8F0] rounded-lg text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#1B2236] bg-[#F4F5FA] hover:bg-[#EAEBED] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#5B49D6] hover:bg-[#4C3BC2] rounded-lg shadow-sm"
                >
                  {isPending ? 'Saving...' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW & MERGE TEST MODAL */}
      {previewModalOpen && previewTemplate && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E6E8F0]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#1B2236]">Live Merge-Field Preview</h2>
                <p className="text-xs text-[#6B7490]">{previewTemplate.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="text-[#6B7490] hover:text-[#1B2236]"
              >
                ✕
              </button>
            </div>

            {renderedPreview?.hasWarnings && (
              <div className="mb-4 p-3 rounded-lg bg-[#FEF3C7] border border-[#FCD34D] text-xs text-[#92400E] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#D97706]" />
                <div>
                  <p className="font-bold">Missing Variable Tokens</p>
                  <p className="text-[11px]">
                    The following fields could not be resolved from sample candidate context:{' '}
                    {renderedPreview.missingFields?.join(', ')}
                  </p>
                </div>
              </div>
            )}

            <div className="bg-[#FAFBFD] p-4 rounded-xl border border-[#E6E8F0] space-y-3">
              {renderedPreview?.renderedSubject && (
                <div>
                  <span className="text-[10px] font-bold text-[#6B7490] uppercase tracking-wider block">
                    Rendered Subject
                  </span>
                  <p className="text-xs font-bold text-[#1B2236] mt-0.5">
                    {renderedPreview.renderedSubject}
                  </p>
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold text-[#6B7490] uppercase tracking-wider block">
                  Rendered Body
                </span>
                <div
                  className="text-xs text-[#1B2236] mt-1 leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: renderedPreview?.renderedBody || previewTemplate.body,
                  }}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#1B2236] bg-[#F4F5FA] hover:bg-[#EAEBED] rounded-lg"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
