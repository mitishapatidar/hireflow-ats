'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GitBranch,
  ArrowLeft,
  CheckCircle2,
  Clock,
  History,
  AlertCircle,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Edit2,
  Save,
  Send,
  ShieldCheck,
  FileText,
  Sparkles,
  Lock,
  Layers,
  ChevronRight,
  ExternalLink,
  Sliders,
  X,
} from 'lucide-react';
import {
  createWorkflowDraftAction,
  updateWorkflowDraftAction,
  publishWorkflowAction,
  getClientWorkflowAction,
} from '@/actions/client-workflows';

interface Stage {
  id?: string;
  name: string;
  order: number;
  stageType: string;
  colorHex: string;
  isActive: boolean;
}

interface Round {
  id?: string;
  name: string;
  order: number;
  type: string;
  isTechnical: boolean;
  isHiringManager: boolean;
  isRequired: boolean;
  defaultDuration: number;
  isActive: boolean;
}

interface SubmissionRuleData {
  requiredFields: string[];
  requireCompleteProfile: boolean;
  requireCvDocument: boolean;
  requirePortfolioUrl: boolean;
  requireExpectedSalary: boolean;
  requireNoticePeriod: boolean;
  requireCandidateConsent: boolean;
  requiresManagerApproval: boolean;
  profileFormat: string;
}

interface WorkflowData {
  id: string;
  version: number;
  status: string;
  changeSummary: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  stages: Stage[];
  rounds: Round[];
  submissionRule: SubmissionRuleData | null;
}

interface ClientWorkflowClientViewProps {
  clientId: string;
  clientLegalName: string;
  clientCode: string;
  initialWorkflow: WorkflowData;
  hasDraft: boolean;
  draftId: string | null;
  versions: Array<{
    id: string;
    version: number;
    status: string;
    changeSummary: string | null;
    publishedAt: string | null;
    publishedBy: string;
    stageCount: number;
    roundCount: number;
    createdAt: string;
  }>;
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

const STAGE_TYPES = [
  'SOURCING',
  'SCREENING',
  'INTERVIEW',
  'CLIENT_REVIEW',
  'OFFER',
  'HIRED',
  'REJECTED',
  'CUSTOM',
];

const ROUND_TYPES = [
  'SCREENING',
  'TECHNICAL',
  'HIRING_MANAGER',
  'BEHAVIORAL',
  'EXECUTIVE',
  'FINAL',
  'GENERAL',
];

const PRESET_COLORS = [
  '#4A5568',
  '#2B6CB0',
  '#805AD5',
  '#DD6B20',
  '#319795',
  '#38A169',
  '#E53E3E',
  '#D69E2E',
  '#5B49D6',
];

export function ClientWorkflowClientView({
  clientId,
  clientLegalName,
  clientCode,
  initialWorkflow,
  hasDraft: initialHasDraft,
  draftId: initialDraftId,
  versions,
  currentUser,
}: ClientWorkflowClientViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'stages' | 'rounds' | 'rules' | 'history'>('stages');
  const [isPending, startTransition] = useTransition();

  // Workflow state
  const [workflow, setWorkflow] = useState<WorkflowData>(initialWorkflow);
  const [hasDraft, setHasDraft] = useState(initialHasDraft);
  const [activeDraftId, setActiveDraftId] = useState(initialDraftId);
  const [isDraftMode, setIsDraftMode] = useState(initialWorkflow.status === 'DRAFT');

  // Working copy for stages, rounds, rules (editable when in draft mode)
  const [stages, setStages] = useState<Stage[]>(initialWorkflow.stages || []);
  const [rounds, setRounds] = useState<Round[]>(initialWorkflow.rounds || []);
  const [rules, setRules] = useState<SubmissionRuleData>(
    initialWorkflow.submissionRule || {
      requiredFields: [],
      requireCompleteProfile: true,
      requireCvDocument: true,
      requirePortfolioUrl: false,
      requireExpectedSalary: true,
      requireNoticePeriod: true,
      requireCandidateConsent: true,
      requiresManagerApproval: true,
      profileFormat: 'STANDARDIZED_ANONYMIZED',
    }
  );

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishChangeSummary, setPublishChangeSummary] = useState('');
  const [publishSubmitting, setPublishSubmitting] = useState(false);

  const [showStageModal, setShowStageModal] = useState(false);
  const [editingStageIndex, setEditingStageIndex] = useState<number | null>(null);
  const [stageForm, setStageForm] = useState<Stage>({
    name: '',
    order: 1,
    stageType: 'CUSTOM',
    colorHex: '#4A5568',
    isActive: true,
  });

  const [showRoundModal, setShowRoundModal] = useState(false);
  const [editingRoundIndex, setEditingRoundIndex] = useState<number | null>(null);
  const [roundForm, setRoundForm] = useState<Round>({
    name: '',
    order: 1,
    type: 'GENERAL',
    isTechnical: false,
    isHiringManager: false,
    isRequired: true,
    defaultDuration: 45,
    isActive: true,
  });

  function showNotification(type: 'success' | 'error', text: string) {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  }

  // Action: Switch to draft or create new draft
  async function handleStartDraft() {
    startTransition(async () => {
      const res = await createWorkflowDraftAction(clientId);
      if (!res.success || !res.data) {
        showNotification('error', res.error || 'Failed to initialize draft');
        return;
      }

      setHasDraft(true);
      setIsDraftMode(true);
      const draftData = res.data;
      setActiveDraftId(draftData.id);
      setWorkflow({
        id: draftData.id,
        version: draftData.version,
        status: draftData.status,
        changeSummary: draftData.changeSummary,
        publishedAt: null,
        publishedBy: null,
        stages: draftData.stages.map((s: any) => ({
          id: s.id,
          name: s.name,
          order: s.order,
          stageType: s.stageType,
          colorHex: (s.configuration as any)?.colorHex || '#4A5568',
          isActive: s.isActive,
        })),
        rounds: draftData.rounds.map((r: any) => ({
          id: r.id,
          name: r.name,
          order: r.order,
          type: r.type,
          isTechnical: r.isTechnical,
          isHiringManager: r.isHiringManager,
          isRequired: r.isRequired,
          defaultDuration: r.defaultDuration,
          isActive: r.isActive,
        })),
        submissionRule: draftData.submissionRules?.[0] || rules,
      });

      setStages(draftData.stages.map((s: any) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        stageType: s.stageType,
        colorHex: (s.configuration as any)?.colorHex || '#4A5568',
        isActive: s.isActive,
      })));

      setRounds(draftData.rounds.map((r: any) => ({
        id: r.id,
        name: r.name,
        order: r.order,
        type: r.type,
        isTechnical: r.isTechnical,
        isHiringManager: r.isHiringManager,
        isRequired: r.isRequired,
        defaultDuration: r.defaultDuration,
        isActive: r.isActive,
      })));

      if (draftData.submissionRules?.[0]) {
        const sr = draftData.submissionRules[0];
        setRules({
          ...sr,
          requiredFields: (sr.requiredFields as string[]) || [],
        });
      }

      setHasUnsavedChanges(false);
      showNotification('success', `Draft version v${draftData.version} is now active for editing.`);
    });
  }

  // Action: Save Draft
  async function handleSaveDraft() {
    startTransition(async () => {
      const res = await updateWorkflowDraftAction(clientId, {
        clientId,
        stages: stages.map((s, idx) => ({
          name: s.name,
          order: idx + 1,
          stageType: s.stageType,
          colorHex: s.colorHex,
          isActive: s.isActive,
        })),
        rounds: rounds.map((r, idx) => ({
          name: r.name,
          order: idx + 1,
          type: r.type,
          isTechnical: r.isTechnical,
          isHiringManager: r.isHiringManager,
          isRequired: r.isRequired,
          defaultDuration: r.defaultDuration,
          isActive: r.isActive,
        })),
        submissionRule: {
          ...rules,
          requiredFields: rules.requiredFields || [],
        },
      });

      if (!res.success) {
        showNotification('error', res.error || 'Failed to save draft changes');
        return;
      }

      setHasUnsavedChanges(false);
      showNotification('success', 'Workflow draft changes saved successfully.');
    });
  }

  // Action: Publish Changes
  async function handlePublishSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publishChangeSummary.trim()) {
      showNotification('error', 'A change summary is required for version auditing.');
      return;
    }

    setPublishSubmitting(true);
    try {
      // First save latest draft state
      await updateWorkflowDraftAction(clientId, {
        clientId,
        stages: stages.map((s, idx) => ({
          name: s.name,
          order: idx + 1,
          stageType: s.stageType,
          colorHex: s.colorHex,
          isActive: s.isActive,
        })),
        rounds: rounds.map((r, idx) => ({
          name: r.name,
          order: idx + 1,
          type: r.type,
          isTechnical: r.isTechnical,
          isHiringManager: r.isHiringManager,
          isRequired: r.isRequired,
          defaultDuration: r.defaultDuration,
          isActive: r.isActive,
        })),
        submissionRule: {
          ...rules,
          requiredFields: rules.requiredFields || [],
        },
      });

      const res = await publishWorkflowAction(clientId, publishChangeSummary.trim());
      if (!res.success) {
        showNotification('error', res.error || 'Failed to publish workflow');
        setPublishSubmitting(false);
        return;
      }

      setShowPublishModal(false);
      setPublishChangeSummary('');
      setHasDraft(false);
      setIsDraftMode(false);
      setHasUnsavedChanges(false);
      showNotification('success', res.message || 'Workflow published successfully!');

      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'An error occurred during publish');
    } finally {
      setPublishSubmitting(false);
    }
  }

  // Action: View historical version
  async function handleViewVersion(versionNum: number) {
    startTransition(async () => {
      const res = await getClientWorkflowAction(clientId, versionNum);
      if (!res.success || !res.data) {
        showNotification('error', res.error || 'Failed to load version');
        return;
      }

      const wf = res.data.workflow;
      setWorkflow(wf);
      setStages(wf.stages);
      setRounds(wf.rounds);
      if (wf.submissionRule) setRules(wf.submissionRule);
      setIsDraftMode(wf.status === 'DRAFT');
      setHasUnsavedChanges(false);
      showNotification('success', `Viewing version v${wf.version} (${wf.status})`);
    });
  }

  // Stage Helpers
  function handleMoveStage(index: number, direction: 'up' | 'down') {
    if (!isDraftMode) return;
    const newStages = [...stages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newStages.length) return;

    const temp = newStages[index];
    newStages[index] = newStages[targetIndex];
    newStages[targetIndex] = temp;

    // re-index order
    const updated = newStages.map((s, idx) => ({ ...s, order: idx + 1 }));
    setStages(updated);
    setHasUnsavedChanges(true);
  }

  function handleSaveStage(e: React.FormEvent) {
    e.preventDefault();
    if (!stageForm.name.trim()) return;

    const newStages = [...stages];
    if (editingStageIndex !== null) {
      newStages[editingStageIndex] = {
        ...stageForm,
        name: stageForm.name.trim(),
        order: editingStageIndex + 1,
      };
    } else {
      newStages.push({
        ...stageForm,
        name: stageForm.name.trim(),
        order: newStages.length + 1,
      });
    }

    setStages(newStages);
    setHasUnsavedChanges(true);
    setShowStageModal(false);
    setEditingStageIndex(null);
  }

  function handleDeleteStage(index: number) {
    if (!isDraftMode) return;
    if (stages.length <= 1) {
      showNotification('error', 'A client workflow must have at least one pipeline stage.');
      return;
    }
    const filtered = stages.filter((_, idx) => idx !== index).map((s, idx) => ({ ...s, order: idx + 1 }));
    setStages(filtered);
    setHasUnsavedChanges(true);
  }

  // Round Helpers
  function handleMoveRound(index: number, direction: 'up' | 'down') {
    if (!isDraftMode) return;
    const newRounds = [...rounds];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newRounds.length) return;

    const temp = newRounds[index];
    newRounds[index] = newRounds[targetIndex];
    newRounds[targetIndex] = temp;

    const updated = newRounds.map((r, idx) => ({ ...r, order: idx + 1 }));
    setRounds(updated);
    setHasUnsavedChanges(true);
  }

  function handleSaveRound(e: React.FormEvent) {
    e.preventDefault();
    if (!roundForm.name.trim()) return;

    const newRounds = [...rounds];
    if (editingRoundIndex !== null) {
      newRounds[editingRoundIndex] = {
        ...roundForm,
        name: roundForm.name.trim(),
        order: editingRoundIndex + 1,
      };
    } else {
      newRounds.push({
        ...roundForm,
        name: roundForm.name.trim(),
        order: newRounds.length + 1,
      });
    }

    setRounds(newRounds);
    setHasUnsavedChanges(true);
    setShowRoundModal(false);
    setEditingRoundIndex(null);
  }

  function handleDeleteRound(index: number) {
    if (!isDraftMode) return;
    const filtered = rounds.filter((_, idx) => idx !== index).map((r, idx) => ({ ...r, order: idx + 1 }));
    setRounds(filtered);
    setHasUnsavedChanges(true);
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast */}
      {toastMessage && (
        <div
          data-testid="toast-notification"
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2 text-sm font-semibold transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-[#6B7490]">
        <Link href="/clients" className="hover:text-[#5B49D6] transition-colors">
          Clients
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href={`/clients/${clientId}`} className="hover:text-[#5B49D6] transition-colors">
          {clientLegalName}
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-[#1B2236] font-medium">Workflows & Submission Rules</span>
      </div>

      {/* Main Header Card */}
      <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#E6E8F0]">
          <div className="flex items-start gap-4">
            <div className="w-13 h-13 rounded-2xl bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
              <GitBranch className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold text-[#1B2236]">
                  {clientLegalName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-xs font-mono font-semibold text-[#6B7490]">
                  {clientCode}
                </span>

                {/* Workflow Status Badge */}
                {isDraftMode ? (
                  <span
                    data-testid="workflow-status-badge"
                    className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5"
                  >
                    <Clock className="w-3 h-3" />
                    <span>DRAFT v{workflow.version}</span>
                  </span>
                ) : (
                  <span
                    data-testid="workflow-status-badge"
                    className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>ACTIVE v{workflow.version} (PUBLISHED)</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-[#6B7490] mt-1.5">
                Configure standardized pipeline stages, interview rounds, and candidate submission rules for this client.
                Every submission is validated server-side against these published rules before manager sign-off.
              </p>

              {/* Version & Publishing Info */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B7490] mt-3">
                {workflow.publishedAt && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      Published on {new Date(workflow.publishedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}
                {workflow.publishedBy && (
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#5B49D6]" />
                    <span>
                      Signed off by: <strong className="text-[#1B2236]">{workflow.publishedBy}</strong>
                    </span>
                  </div>
                )}
                {workflow.changeSummary && (
                  <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                    <span>Note: {workflow.changeSummary}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {!isDraftMode ? (
              <button
                onClick={handleStartDraft}
                disabled={isPending}
                data-testid="edit-workflow-draft-btn"
                className="px-4 py-2.5 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{hasDraft ? 'Resume Editing Draft' : 'Edit Workflow (Create Draft)'}</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleSaveDraft}
                  disabled={isPending}
                  data-testid="save-draft-btn"
                  className="px-3.5 py-2.5 bg-white border border-[#E6E8F0] hover:bg-slate-50 text-[#1B2236] rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-[#6B7490]" />
                  <span>{hasUnsavedChanges ? 'Save Draft*' : 'Draft Saved'}</span>
                </button>

                <button
                  onClick={() => setShowPublishModal(true)}
                  disabled={isPending}
                  data-testid="publish-workflow-btn"
                  className="px-4 py-2.5 bg-[#12B76A] hover:bg-[#12B76A]/90 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish Version v{workflow.version}</span>
                </button>
              </>
            )}

            <Link
              href={`/clients/${clientId}`}
              className="px-3.5 py-2.5 bg-white border border-[#E6E8F0] hover:bg-slate-50 text-[#6B7490] rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Client</span>
            </Link>
          </div>
        </div>

        {/* Draft Notification Banner */}
        {isDraftMode && (
          <div className="mt-4 p-3.5 bg-amber-50/80 border border-amber-200/70 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Draft Mode Active:</strong> You are editing uncommitted workflow changes for version v{workflow.version} {activeDraftId ? `(${activeDraftId})` : ''}.
                Reviewer: <strong>{currentUser?.name}</strong>.
                Existing submissions and active job pipelines remain bound to their active version until you publish.
              </span>
            </div>
            {hasUnsavedChanges && (
              <span className="font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-[11px]">
                Unsaved changes
              </span>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-6 border-b border-[#E6E8F0] -mb-6">
          <button
            onClick={() => setActiveTab('stages')}
            data-testid="tab-stages"
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'stages'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Pipeline Stages ({stages.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('rounds')}
            data-testid="tab-rounds"
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'rounds'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Interview Rounds ({rounds.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            data-testid="tab-rules"
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'rules'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Submission Rules</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            data-testid="tab-history"
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Version History ({versions.length})</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Pipeline Stages */}
      {activeTab === 'stages' && (
        <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E6E8F0]">
            <div>
              <h2 className="text-sm font-bold text-[#1B2236]">Pipeline Stage Progression</h2>
              <p className="text-xs text-[#6B7490] mt-0.5">
                Define candidate pipeline stages for jobs associated with this client. Order dictates candidate progression.
              </p>
            </div>
            {isDraftMode && (
              <button
                onClick={() => {
                  setEditingStageIndex(null);
                  setStageForm({
                    name: '',
                    order: stages.length + 1,
                    stageType: 'CUSTOM',
                    colorHex: '#4A5568',
                    isActive: true,
                  });
                  setShowStageModal(true);
                }}
                data-testid="add-stage-btn"
                className="px-3 py-1.5 bg-[#EEEBFB] hover:bg-[#E5E0FA] text-[#5B49D6] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Stage</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-[#E6E8F0] border border-[#E6E8F0] rounded-xl overflow-hidden">
            {stages.map((stage, idx) => (
              <div
                key={stage.id || `stage-${idx}`}
                data-testid={`stage-item-${idx}`}
                className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors bg-white"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-[#1B2236] font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div
                    className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: stage.colorHex || '#4A5568' }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#1B2236]">{stage.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-[#6B7490] font-semibold">
                        {stage.stageType}
                      </span>
                      {!stage.isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-50 text-rose-600 font-semibold">
                          Disabled
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isDraftMode && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveStage(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 text-[#6B7490] hover:text-[#1B2236] hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                      title="Move Up"
                    >
                      <MoveUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveStage(idx, 'down')}
                      disabled={idx === stages.length - 1}
                      className="p-1.5 text-[#6B7490] hover:text-[#1B2236] hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                      title="Move Down"
                    >
                      <MoveDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingStageIndex(idx);
                        setStageForm({ ...stage });
                        setShowStageModal(true);
                      }}
                      className="p-1.5 text-[#6B7490] hover:text-[#5B49D6] hover:bg-[#EEEBFB] rounded-lg cursor-pointer"
                      title="Edit Stage"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteStage(idx)}
                      disabled={stages.length <= 1}
                      className="p-1.5 text-[#6B7490] hover:text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-30 cursor-pointer"
                      title="Delete Stage"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Interview Rounds */}
      {activeTab === 'rounds' && (
        <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E6E8F0]">
            <div>
              <h2 className="text-sm font-bold text-[#1B2236]">Interview Rounds & Evaluation Stages</h2>
              <p className="text-xs text-[#6B7490] mt-0.5">
                Define the default interview sequence for client vacancies. These generate interview templates on new mandates.
              </p>
            </div>
            {isDraftMode && (
              <button
                onClick={() => {
                  setEditingRoundIndex(null);
                  setRoundForm({
                    name: '',
                    order: rounds.length + 1,
                    type: 'GENERAL',
                    isTechnical: false,
                    isHiringManager: false,
                    isRequired: true,
                    defaultDuration: 45,
                    isActive: true,
                  });
                  setShowRoundModal(true);
                }}
                data-testid="add-round-btn"
                className="px-3 py-1.5 bg-[#EEEBFB] hover:bg-[#E5E0FA] text-[#5B49D6] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Round</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-[#E6E8F0] border border-[#E6E8F0] rounded-xl overflow-hidden">
            {rounds.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6B7490]">
                No interview rounds configured yet.
              </div>
            ) : (
              rounds.map((round, idx) => (
                <div
                  key={round.id || `round-${idx}`}
                  data-testid={`round-item-${idx}`}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors bg-white"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-[#1B2236] font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#1B2236]">{round.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EEEBFB] text-[#5B49D6] font-semibold">
                          {round.type}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-[#6B7490]">
                          {round.defaultDuration} min
                        </span>
                        {round.isRequired && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                            Required
                          </span>
                        )}
                        {round.isTechnical && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700">
                            Technical
                          </span>
                        )}
                        {round.isHiringManager && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                            Hiring Manager
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isDraftMode && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveRound(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 text-[#6B7490] hover:text-[#1B2236] hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveRound(idx, 'down')}
                        disabled={idx === rounds.length - 1}
                        className="p-1.5 text-[#6B7490] hover:text-[#1B2236] hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingRoundIndex(idx);
                          setRoundForm({ ...round });
                          setShowRoundModal(true);
                        }}
                        className="p-1.5 text-[#6B7490] hover:text-[#5B49D6] hover:bg-[#EEEBFB] rounded-lg cursor-pointer"
                        title="Edit Round"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRound(idx)}
                        className="p-1.5 text-[#6B7490] hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Delete Round"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Submission Rules */}
      {activeTab === 'rules' && (
        <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs space-y-6">
          <div className="pb-4 border-b border-[#E6E8F0]">
            <h2 className="text-sm font-bold text-[#1B2236]">Candidate Submission Compliance Rules</h2>
            <p className="text-xs text-[#6B7490] mt-0.5">
              These rules are enforced before candidate profiles can be approved or sent to the client.
              Non-compliant submissions will be flagged in the Approval Center and blocked from client dispatch.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rule 1: Complete Profile */}
            <div className="p-4 rounded-xl border border-[#E6E8F0] bg-white flex items-start justify-between gap-3 shadow-2xs">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#5B49D6]" />
                  <h3 className="text-xs font-bold text-[#1B2236]">Require Complete Candidate Profile</h3>
                </div>
                <p className="text-[11px] text-[#6B7490] mt-1">
                  Enforces that summary, current role, headline, and at least 3 core skills are populated.
                </p>
              </div>
              <input
                type="checkbox"
                checked={rules.requireCompleteProfile}
                disabled={!isDraftMode}
                onChange={(e) => {
                  setRules({ ...rules, requireCompleteProfile: e.target.checked });
                  setHasUnsavedChanges(true);
                }}
                className="w-4 h-4 rounded text-[#5B49D6] focus:ring-[#5B49D6] cursor-pointer mt-0.5"
              />
            </div>

            {/* Rule 2: CV Document */}
            <div className="p-4 rounded-xl border border-[#E6E8F0] bg-white flex items-start justify-between gap-3 shadow-2xs">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#5B49D6]" />
                  <h3 className="text-xs font-bold text-[#1B2236]">Require Resume / CV Attachment</h3>
                </div>
                <p className="text-[11px] text-[#6B7490] mt-1">
                  Validates that candidate has an uploaded and non-archived resume file in storage.
                </p>
              </div>
              <input
                type="checkbox"
                checked={rules.requireCvDocument}
                disabled={!isDraftMode}
                onChange={(e) => {
                  setRules({ ...rules, requireCvDocument: e.target.checked });
                  setHasUnsavedChanges(true);
                }}
                className="w-4 h-4 rounded text-[#5B49D6] focus:ring-[#5B49D6] cursor-pointer mt-0.5"
              />
            </div>

            {/* Rule 3: Expected Salary */}
            <div className="p-4 rounded-xl border border-[#E6E8F0] bg-white flex items-start justify-between gap-3 shadow-2xs">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#5B49D6]" />
                  <h3 className="text-xs font-bold text-[#1B2236]">Require Expected Salary</h3>
                </div>
                <p className="text-[11px] text-[#6B7490] mt-1">
                  Candidate profile must contain a verified expected salary value.
                </p>
              </div>
              <input
                type="checkbox"
                checked={rules.requireExpectedSalary}
                disabled={!isDraftMode}
                onChange={(e) => {
                  setRules({ ...rules, requireExpectedSalary: e.target.checked });
                  setHasUnsavedChanges(true);
                }}
                className="w-4 h-4 rounded text-[#5B49D6] focus:ring-[#5B49D6] cursor-pointer mt-0.5"
              />
            </div>

            {/* Rule 4: Notice Period */}
            <div className="p-4 rounded-xl border border-[#E6E8F0] bg-white flex items-start justify-between gap-3 shadow-2xs">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#5B49D6]" />
                  <h3 className="text-xs font-bold text-[#1B2236]">Require Notice Period Declaration</h3>
                </div>
                <p className="text-[11px] text-[#6B7490] mt-1">
                  Availability or contractual notice period must be explicitly recorded.
                </p>
              </div>
              <input
                type="checkbox"
                checked={rules.requireNoticePeriod}
                disabled={!isDraftMode}
                onChange={(e) => {
                  setRules({ ...rules, requireNoticePeriod: e.target.checked });
                  setHasUnsavedChanges(true);
                }}
                className="w-4 h-4 rounded text-[#5B49D6] focus:ring-[#5B49D6] cursor-pointer mt-0.5"
              />
            </div>

            {/* Rule 5: Candidate Consent */}
            <div className="p-4 rounded-xl border border-[#E6E8F0] bg-white flex items-start justify-between gap-3 shadow-2xs">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#5B49D6]" />
                  <h3 className="text-xs font-bold text-[#1B2236]">Require Candidate Representation Consent</h3>
                </div>
                <p className="text-[11px] text-[#6B7490] mt-1">
                  Candidate right-to-represent consent timestamp must be recorded prior to submission.
                </p>
              </div>
              <input
                type="checkbox"
                checked={rules.requireCandidateConsent}
                disabled={!isDraftMode}
                onChange={(e) => {
                  setRules({ ...rules, requireCandidateConsent: e.target.checked });
                  setHasUnsavedChanges(true);
                }}
                className="w-4 h-4 rounded text-[#5B49D6] focus:ring-[#5B49D6] cursor-pointer mt-0.5"
              />
            </div>

            {/* Rule 6: Portfolio URL */}
            <div className="p-4 rounded-xl border border-[#E6E8F0] bg-white flex items-start justify-between gap-3 shadow-2xs">
              <div>
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-[#5B49D6]" />
                  <h3 className="text-xs font-bold text-[#1B2236]">Require Portfolio / Work Samples URL</h3>
                </div>
                <p className="text-[11px] text-[#6B7490] mt-1">
                  Useful for design, frontend, and creative mandates. Requires valid web link.
                </p>
              </div>
              <input
                type="checkbox"
                checked={rules.requirePortfolioUrl}
                disabled={!isDraftMode}
                onChange={(e) => {
                  setRules({ ...rules, requirePortfolioUrl: e.target.checked });
                  setHasUnsavedChanges(true);
                }}
                className="w-4 h-4 rounded text-[#5B49D6] focus:ring-[#5B49D6] cursor-pointer mt-0.5"
              />
            </div>
          </div>

          {/* Locked Enforcements & Profile Format */}
          <div className="pt-4 border-t border-[#E6E8F0] space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#5B49D6]" />
                <div>
                  <h4 className="text-xs font-bold text-[#1B2236]">Manager Sign-Off Requirement</h4>
                  <p className="text-[11px] text-[#6B7490]">
                    Mandatory. Submissions to this client must be reviewed and approved by a manager in the Approval Center before client dispatch.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EEEBFB] text-[#5B49D6]">
                ENFORCED
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1B2236] mb-1">
                Standard Candidate Profile Presentation Format
              </label>
              <p className="text-[11px] text-[#6B7490] mb-2">
                Governs how candidate data is formatted and whether direct candidate contact info is anonymized for this client.
              </p>
              <select
                value={rules.profileFormat}
                disabled={!isDraftMode}
                onChange={(e) => {
                  setRules({ ...rules, profileFormat: e.target.value });
                  setHasUnsavedChanges(true);
                }}
                className="w-full max-w-md px-3 py-2 text-xs border border-[#E6E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#5B49D6] bg-white font-medium"
              >
                <option value="STANDARDIZED_ANONYMIZED">
                  Standardized Anonymized (Recommended - Contact info redacted)
                </option>
                <option value="BRANDED_STANDARD">
                  Branded Standard (HireFlow agency banner with direct contact details)
                </option>
                <option value="ORIGINAL_ATTACHED">
                  Original Document (Direct candidate original CV attachment)
                </option>
              </select>
            </div>
          </div>

          {isDraftMode && (
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveDraft}
                disabled={isPending}
                className="px-4 py-2 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Submission Rules</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Version History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs space-y-4">
          <div className="pb-4 border-b border-[#E6E8F0]">
            <h2 className="text-sm font-bold text-[#1B2236]">Client Workflow Version Audit Trail</h2>
            <p className="text-xs text-[#6B7490] mt-0.5">
              Every workflow publication creates an immutable snapshot. Past submissions remain tied to their respective version tag.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[#6B7490] font-semibold border-b border-[#E6E8F0]">
                <tr>
                  <th className="py-2.5 px-3">Version</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Published By</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Stages / Rounds</th>
                  <th className="py-2.5 px-3">Change Summary</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8F0]">
                {versions.map((ver) => (
                  <tr key={ver.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-3 font-bold font-mono text-[#1B2236]">
                      v{ver.version}
                    </td>
                    <td className="py-3 px-3">
                      {ver.status === 'PUBLISHED' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          ACTIVE
                        </span>
                      ) : ver.status === 'DRAFT' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">
                          DRAFT
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-[#6B7490]">
                          ARCHIVED
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[#1B2236] font-medium">
                      {ver.publishedBy}
                    </td>
                    <td className="py-3 px-3 text-[#6B7490]">
                      {ver.publishedAt
                        ? new Date(ver.publishedAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : new Date(ver.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-[#6B7490]">
                      {ver.stageCount} stages, {ver.roundCount} rounds
                    </td>
                    <td className="py-3 px-3 text-slate-700 max-w-xs truncate">
                      {ver.changeSummary || 'Baseline workflow'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleViewVersion(ver.version)}
                        className="text-[#5B49D6] hover:text-[#5B49D6]/80 font-semibold cursor-pointer"
                      >
                        View Snapshot
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Publish Version */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0]">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-[#12B76A]" />
                <h3 className="font-bold text-sm text-[#1B2236]">Publish Workflow Version v{workflow.version}</h3>
              </div>
              <button
                onClick={() => setShowPublishModal(false)}
                className="p-1 text-[#6B7490] hover:text-[#1B2236] rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePublishSubmit} className="mt-4 space-y-4">
              <p className="text-xs text-[#6B7490]">
                Publishing activates version v{workflow.version} for <strong>{clientLegalName}</strong>.
                Future submissions and vacancy setups will immediately use these stages, rounds, and validation rules.
              </p>

              <div>
                <label className="block text-xs font-bold text-[#1B2236] mb-1">
                  Change Summary / Changelog Note <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={publishChangeSummary}
                  onChange={(e) => setPublishChangeSummary(e.target.value)}
                  placeholder="e.g. Added Technical Assessment round, enforced portfolio URL for frontend submissions"
                  required
                  className="w-full p-2.5 text-xs border border-[#E6E8F0] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#5B49D6] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6E8F0]">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="px-3.5 py-2 border border-[#E6E8F0] text-[#6B7490] rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={publishSubmitting || !publishChangeSummary.trim()}
                  className="px-4 py-2 bg-[#12B76A] hover:bg-[#12B76A]/90 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {publishSubmitting ? 'Publishing...' : `Confirm & Publish v${workflow.version}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Pipeline Stage */}
      {showStageModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0]">
              <h3 className="font-bold text-sm text-[#1B2236]">
                {editingStageIndex !== null ? 'Edit Pipeline Stage' : 'Add Pipeline Stage'}
              </h3>
              <button
                onClick={() => setShowStageModal(false)}
                className="p-1 text-[#6B7490] hover:text-[#1B2236] rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStage} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1B2236] mb-1">
                  Stage Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={stageForm.name}
                  onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
                  placeholder="e.g. Client Technical Panel"
                  required
                  className="w-full px-3 py-2 text-xs border border-[#E6E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#5B49D6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1B2236] mb-1">Stage Type</label>
                <select
                  value={stageForm.stageType}
                  onChange={(e) => setStageForm({ ...stageForm, stageType: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#E6E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#5B49D6] bg-white font-medium"
                >
                  {STAGE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1B2236] mb-1">Color Indicator</label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setStageForm({ ...stageForm, colorHex: color })}
                        style={{ backgroundColor: color }}
                        className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                          stageForm.colorHex === color ? 'scale-125 ring-2 ring-offset-1 ring-[#5B49D6]' : ''
                        }`}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={stageForm.colorHex}
                    onChange={(e) => setStageForm({ ...stageForm, colorHex: e.target.value })}
                    className="w-7 h-7 rounded border border-[#E6E8F0] cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6E8F0]">
                <button
                  type="button"
                  onClick={() => setShowStageModal(false)}
                  className="px-3.5 py-2 border border-[#E6E8F0] text-[#6B7490] rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Save Stage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Interview Round */}
      {showRoundModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0]">
              <h3 className="font-bold text-sm text-[#1B2236]">
                {editingRoundIndex !== null ? 'Edit Interview Round' : 'Add Interview Round'}
              </h3>
              <button
                onClick={() => setShowRoundModal(false)}
                className="p-1 text-[#6B7490] hover:text-[#1B2236] rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRound} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1B2236] mb-1">
                  Round Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={roundForm.name}
                  onChange={(e) => setRoundForm({ ...roundForm, name: e.target.value })}
                  placeholder="e.g. System Design Deep Dive"
                  required
                  className="w-full px-3 py-2 text-xs border border-[#E6E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#5B49D6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1B2236] mb-1">Round Type</label>
                  <select
                    value={roundForm.type}
                    onChange={(e) => setRoundForm({ ...roundForm, type: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#E6E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#5B49D6] bg-white font-medium"
                  >
                    {ROUND_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2236] mb-1">Duration (minutes)</label>
                  <select
                    value={roundForm.defaultDuration}
                    onChange={(e) => setRoundForm({ ...roundForm, defaultDuration: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 text-xs border border-[#E6E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#5B49D6] bg-white font-medium"
                  >
                    <option value={30}>30 mins</option>
                    <option value={45}>45 mins</option>
                    <option value={60}>60 mins</option>
                    <option value={90}>90 mins</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#1B2236]">
                  <input
                    type="checkbox"
                    checked={roundForm.isRequired}
                    onChange={(e) => setRoundForm({ ...roundForm, isRequired: e.target.checked })}
                    className="w-4 h-4 rounded text-[#5B49D6] focus:ring-[#5B49D6]"
                  />
                  <span>Mandatory Round (Must pass before next stage)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#1B2236]">
                  <input
                    type="checkbox"
                    checked={roundForm.isTechnical}
                    onChange={(e) => setRoundForm({ ...roundForm, isTechnical: e.target.checked })}
                    className="w-4 h-4 rounded text-[#5B49D6] focus:ring-[#5B49D6]"
                  />
                  <span>Technical Evaluation / Coding Assessment</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#1B2236]">
                  <input
                    type="checkbox"
                    checked={roundForm.isHiringManager}
                    onChange={(e) => setRoundForm({ ...roundForm, isHiringManager: e.target.checked })}
                    className="w-4 h-4 rounded text-[#5B49D6] focus:ring-[#5B49D6]"
                  />
                  <span>Client Hiring Manager Interview</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6E8F0]">
                <button
                  type="button"
                  onClick={() => setShowRoundModal(false)}
                  className="px-3.5 py-2 border border-[#E6E8F0] text-[#6B7490] rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Save Round
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
