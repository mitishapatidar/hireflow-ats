'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useTransition } from 'react';
import {
  Download,
  Archive,
  Shield,
  History,
  Search,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Eye,
  Lock,
  Layers,
  X,
  Sliders,
  AlertCircle,
} from 'lucide-react';
import {
  ExportEntityType,
  ColumnDefinition,
  CreateCustomFieldDefinitionInput,
  SetClientCustomFieldRuleInput,
  UpdateDownloadPolicyInput,
} from '@hireflow/shared';
import {
  previewExportAction,
  generateExportAction,
  createCustomFieldAction,
  archiveCustomFieldAction,
  setClientCustomFieldRuleAction,
  restoreArchivedCandidateAction,
  updateDownloadPolicyAction,
  getAuditLogsAction,
  exportAuditLogsCsvAction,
} from '@/actions/governance';

interface DataGovernanceClientViewProps {
  currentUser: any;
  initialTab?: string;
  exportConfig: any;
  initialCustomFields: any[];
  initialArchivedCandidates: any[];
  initialDownloadPolicies: any;
  initialAuditLogs: any[];
  auditLogsMeta: any;
  clients: Array<{ id: string; legalName: string; code: string }>;
  jobs: Array<{ id: string; title: string; code: string; clientId: string }>;
}

export function DataGovernanceClientView({
  currentUser,
  initialTab = 'export',
  exportConfig,
  initialCustomFields,
  initialArchivedCandidates,
  initialDownloadPolicies,
  initialAuditLogs,
  auditLogsMeta,
  clients,
  jobs,
}: DataGovernanceClientViewProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'fields' | 'archive' | 'policy' | 'audit'>(
    (initialTab as any) || 'export'
  );
  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // -------------------------------------------------------------
  // TAB 1: SCOPED EXPORT STATE
  // -------------------------------------------------------------
  const [selectedEntity, setSelectedEntity] = useState<ExportEntityType>('CANDIDATES');
  const [selectedFormat, setSelectedFormat] = useState<'CSV' | 'XLSX'>('CSV');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    exportConfig?.entities?.CANDIDATES?.columns
      ?.filter((c: ColumnDefinition) => c.isDefault)
      ?.map((c: ColumnDefinition) => c.key) || []
  );
  const [exportFilters, setExportFilters] = useState<{
    clientId?: string;
    jobId?: string;
    status?: string;
  }>({});
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [previewCols, setPreviewCols] = useState<ColumnDefinition[] | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastExportResult, setLastExportResult] = useState<any | null>(null);

  // -------------------------------------------------------------
  // TAB 2: CUSTOM FIELDS STATE
  // -------------------------------------------------------------
  const [customFields, setCustomFields] = useState<any[]>(initialCustomFields || []);
  const [fieldEntityFilter, setFieldEntityFilter] = useState<string>('ALL');
  const [fieldSearch, setFieldSearch] = useState<string>('');
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);
  const [isClientRuleModalOpen, setIsClientRuleModalOpen] = useState(false);
  const [fieldFormData, setFieldFormData] = useState<Partial<CreateCustomFieldDefinitionInput>>({
    entityType: 'CANDIDATE',
    fieldName: '',
    fieldKey: '',
    fieldType: 'TEXT',
    description: '',
    options: [],
    isRequired: false,
    visibility: 'INTERNAL_ONLY',
    displayOrder: 0,
  });
  const [optionsInput, setOptionsInput] = useState('');
  const [clientRuleData, setClientRuleData] = useState<Partial<SetClientCustomFieldRuleInput>>({
    clientId: clients[0]?.id || '',
    fieldDefinitionId: initialCustomFields[0]?.id || '',
    isRequired: true,
  });

  // -------------------------------------------------------------
  // TAB 3: ARCHIVE & RESTORE STATE
  // -------------------------------------------------------------
  const [archivedCandidates, setArchivedCandidates] = useState<any[]>(initialArchivedCandidates || []);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [selectedRestoreCandidate, setSelectedRestoreCandidate] = useState<any | null>(null);
  const [restoreReason, setRestoreReason] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // -------------------------------------------------------------
  // TAB 4: DOWNLOAD POLICY STATE
  // -------------------------------------------------------------
  const [downloadPolicies, setDownloadPolicies] = useState<any[]>(
    initialDownloadPolicies?.policies || []
  );
  const [selectedPolicyForEdit, setSelectedPolicyForEdit] = useState<any | null>(null);
  const [policyForm, setPolicyForm] = useState<UpdateDownloadPolicyInput>({
    role: 'RECRUITER',
    dailyCvLimit: 25,
    requireWatermark: true,
    allowOriginalDownload: false,
    isActive: true,
  });

  // -------------------------------------------------------------
  // TAB 5: AUDIT TRAIL STATE
  // -------------------------------------------------------------
  const [auditLogs, setAuditLogs] = useState<any[]>(initialAuditLogs || []);
  const [auditMeta, setAuditMeta] = useState<any>(auditLogsMeta || { total: 0, page: 1, limit: 25, totalPages: 1 });
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [selectedDiffLog, setSelectedDiffLog] = useState<any | null>(null);

  // Helper notification toaster
  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 6000);
  };

  // Switch entity for export
  const handleEntityChange = (entity: ExportEntityType) => {
    setSelectedEntity(entity);
    const cols = exportConfig?.entities?.[entity]?.columns || [];
    setSelectedColumns(cols.filter((c: ColumnDefinition) => c.isDefault).map((c: ColumnDefinition) => c.key));
    setPreviewData(null);
    setPreviewCols(null);
    setLastExportResult(null);
  };

  // Toggle export column
  const toggleColumn = (key: string) => {
    if (selectedColumns.includes(key)) {
      if (selectedColumns.length === 1) {
        notify('error', 'At least one column must remain selected.');
        return;
      }
      setSelectedColumns(selectedColumns.filter((c) => c !== key));
    } else {
      setSelectedColumns([...selectedColumns, key]);
    }
  };

  // Preview Scoped Export
  const handlePreviewExport = async () => {
    setIsPreviewLoading(true);
    try {
      const res = await previewExportAction({
        entityType: selectedEntity,
        format: selectedFormat,
        selectedColumns,
        filters: exportFilters,
      });
      if (res.success && res.data) {
        setPreviewData(res.data.previewRows);
        setPreviewCols(res.data.columns);
        notify('success', `Preview generated with ${res.data.previewRows.length} sample rows.`);
      }
    } catch (err: any) {
      notify('error', err.message || 'Failed to generate preview');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Generate Scoped Export
  const handleGenerateExport = async () => {
    setIsExporting(true);
    try {
      const res = await generateExportAction({
        entityType: selectedEntity,
        format: selectedFormat,
        selectedColumns,
        filters: exportFilters,
      });

      if (res.success && res.data) {
        setLastExportResult(res.data);
        notify('success', `Export generated successfully (${res.data.rowCount} records). Initiating download...`);

        // Trigger browser download via API route
        window.location.href = res.data.downloadUrl;
      }
    } catch (err: any) {
      notify('error', err.message || 'Export generation failed');
    } finally {
      setIsExporting(false);
    }
  };

  // Auto-slugify fieldName to fieldKey
  const handleFieldNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    setFieldFormData((prev) => ({
      ...prev,
      fieldName: name,
      fieldKey: prev.fieldKey ? prev.fieldKey : slug,
    }));
  };

  // Create Custom Field Submit
  const handleCreateCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldFormData.fieldName || !fieldFormData.fieldKey) {
      notify('error', 'Field Name and Key are required.');
      return;
    }

    startTransition(async () => {
      try {
        const options =
          fieldFormData.fieldType === 'SELECT' || fieldFormData.fieldType === 'MULTI_SELECT'
            ? optionsInput.split(',').map((s) => s.trim()).filter(Boolean)
            : [];

        const res = await createCustomFieldAction({
          entityType: fieldFormData.entityType as any,
          fieldName: fieldFormData.fieldName!,
          fieldKey: fieldFormData.fieldKey!,
          fieldType: fieldFormData.fieldType as any,
          description: fieldFormData.description,
          options,
          isRequired: !!fieldFormData.isRequired,
          visibility: fieldFormData.visibility as any,
          displayOrder: Number(fieldFormData.displayOrder) || 0,
        });

        if (res.success) {
          setCustomFields([res.data, ...customFields]);
          setIsAddFieldModalOpen(false);
          setFieldFormData({
            entityType: 'CANDIDATE',
            fieldName: '',
            fieldKey: '',
            fieldType: 'TEXT',
            description: '',
            options: [],
            isRequired: false,
            visibility: 'INTERNAL_ONLY',
            displayOrder: 0,
          });
          setOptionsInput('');
          notify('success', `Custom field '${res.data.fieldName}' created successfully (v1).`);
        }
      } catch (err: any) {
        notify('error', err.message || 'Failed to create custom field');
      }
    });
  };

  // Archive Custom Field
  const handleArchiveCustomField = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to archive custom field '${name}'? Existing values will be retained, but new records will not accept this field.`)) {
      return;
    }

    startTransition(async () => {
      try {
        const res = await archiveCustomFieldAction(id);
        if (res.success) {
          setCustomFields(customFields.map((f) => (f.id === id ? { ...f, isActive: false } : f)));
          notify('success', `Custom field '${name}' soft-archived successfully.`);
        }
      } catch (err: any) {
        notify('error', err.message || 'Failed to archive custom field');
      }
    });
  };

  // Set Client Rule
  const handleSaveClientRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientRuleData.clientId || !clientRuleData.fieldDefinitionId) {
      notify('error', 'Please select both a client and a custom field.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await setClientCustomFieldRuleAction({
          clientId: clientRuleData.clientId!,
          fieldDefinitionId: clientRuleData.fieldDefinitionId!,
          isRequired: !!clientRuleData.isRequired,
          workflowVersion: 1,
        });
        if (res.success) {
          setIsClientRuleModalOpen(false);
          notify('success', 'Client submission custom field rule established successfully.');
        }
      } catch (err: any) {
        notify('error', err.message || 'Failed to set client custom field rule');
      }
    });
  };

  // Restore Candidate Submit
  const handleRestoreCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestoreCandidate) return;
    if (!restoreReason || restoreReason.trim().length < 5) {
      setRestoreError('A clear justification reason (minimum 5 characters) is mandatory to restore an archived record.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await restoreArchivedCandidateAction(selectedRestoreCandidate.id, restoreReason.trim());
        if (res.success) {
          setArchivedCandidates(archivedCandidates.filter((c) => c.id !== selectedRestoreCandidate.id));
          setSelectedRestoreCandidate(null);
          setRestoreReason('');
          setRestoreError(null);
          notify('success', `Candidate ${selectedRestoreCandidate.code} (${selectedRestoreCandidate.name}) restored to active talent pool.`);
        }
      } catch (err: any) {
        setRestoreError(err.message || 'Restoration failed.');
      }
    });
  };

  // Update Download Policy Submit
  const handleUpdatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await updateDownloadPolicyAction(policyForm);
        if (res.success) {
          setDownloadPolicies(
            downloadPolicies.map((p) => (p.role === policyForm.role ? { ...p, ...res.data } : p))
          );
          setSelectedPolicyForEdit(null);
          notify('success', `Daily download policy for ${policyForm.role} updated successfully.`);
        }
      } catch (err: any) {
        notify('error', err.message || 'Failed to update download policy');
      }
    });
  };

  // Export Audit Logs CSV
  const handleExportAuditLogs = async () => {
    startTransition(async () => {
      try {
        const res = await exportAuditLogsCsvAction();
        if (res.success) {
          const blob = new Blob([res.csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', res.fileName);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          notify('success', 'Audit trail exported successfully.');
        }
      } catch (err: any) {
        notify('error', err.message || 'Failed to export audit logs');
      }
    });
  };

  // Filtered fields
  const filteredFields = customFields.filter((f) => {
    const matchesEntity = fieldEntityFilter === 'ALL' || f.entityType === fieldEntityFilter;
    const matchesSearch =
      f.fieldName.toLowerCase().includes(fieldSearch.toLowerCase()) ||
      (f.fieldKey && f.fieldKey.toLowerCase().includes(fieldSearch.toLowerCase()));
    return matchesEntity && matchesSearch;
  });

  // Filtered archived candidates
  const filteredArchived = archivedCandidates.filter((c) => {
    return (
      c.name.toLowerCase().includes(archiveSearch.toLowerCase()) ||
      c.code.toLowerCase().includes(archiveSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(archiveSearch.toLowerCase())
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* HEADER & COMPLIANCE BAR */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">
            <span>Admin</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span>Data Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
            Data Governance & Scoped Exports
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Controlled data exports with formula injection protection, workspace custom fields, candidate archive & safe restore, role-based CV download quotas, and searchable compliance audit trails.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
            <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Aureva Capital · Admin: {currentUser?.name || currentUser?.email || 'Authorized'}</span>
          </div>
        </div>
      </div>

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('export')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'export'
              ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Scoped Export</span>
          <span className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">
            Frame 37
          </span>
        </button>

        <button
          onClick={() => setActiveTab('fields')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'fields'
              ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Custom Fields</span>
          <span className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">
            {customFields.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('archive')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'archive'
              ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Archive & Restore</span>
          <span className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">
            {archivedCandidates.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('policy')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'policy'
              ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Download Policy</span>
          <span className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">
            4 Roles
          </span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Trail</span>
          <span className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">
            {auditMeta.total}
          </span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: SCOPED EXPORT (FIGMA FRAME 37)                     */}
      {/* ========================================================= */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          {/* Security Banner */}
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <span className="font-semibold">Security & Anti-Leak Commandment:</span> Spreadsheet Formula Injection defenses (`=`, `+`, `-`, `@`, `\t`, `\r`) are enforced on every cell. Internal recruiter notes, candidate passwords, authentication hashes, and commercial recruiter margins are strictly forbidden and automatically scrubbed from all exported files.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Entity, Filters & Columns */}
            <div className="lg:col-span-2 space-y-6">
              {/* Entity Catalog Selection */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  1. Select Data Entity to Export
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(Object.keys(exportConfig?.entities || {}) as ExportEntityType[]).map((ent) => {
                    const info = exportConfig.entities[ent];
                    const isSelected = selectedEntity === ent;
                    return (
                      <button
                        key={ent}
                        type="button"
                        onClick={() => handleEntityChange(ent)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-primary-600 bg-primary-50/50 dark:bg-primary-950/30 ring-2 ring-primary-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                          {info.label}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                          {info.columns.length} columns
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scope & Date Filters */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  2. Define Scope Filters (Optional)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Client Company Scope
                    </label>
                    <select
                      value={exportFilters.clientId || ''}
                      onChange={(e) => setExportFilters({ ...exportFilters, clientId: e.target.value || undefined })}
                      className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">All Client Accounts</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.legalName} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Job Mandate Filter
                    </label>
                    <select
                      value={exportFilters.jobId || ''}
                      onChange={(e) => setExportFilters({ ...exportFilters, jobId: e.target.value || undefined })}
                      className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">All Job Mandates</option>
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title} ({j.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Lifecycle Status
                    </label>
                    <select
                      value={exportFilters.status || 'ALL'}
                      onChange={(e) => setExportFilters({ ...exportFilters, status: e.target.value })}
                      className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-900 dark:text-slate-100"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="ACTIVE">Active Records Only</option>
                      <option value="CLOSED">Closed Mandates</option>
                      <option value="SUBMITTED">Submitted</option>
                      <option value="ACCEPTED">Accepted</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Column Selection Checkboxes */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    3. Select Columns ({selectedColumns.length} chosen)
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allKeys = exportConfig.entities[selectedEntity]?.columns?.map((c: any) => c.key) || [];
                        setSelectedColumns(allKeys);
                      }}
                      className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        const defKeys = exportConfig.entities[selectedEntity]?.columns
                          ?.filter((c: any) => c.isDefault)
                          ?.map((c: any) => c.key) || [];
                        setSelectedColumns(defKeys);
                      }}
                      className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:underline"
                    >
                      Default Set
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {(exportConfig?.entities?.[selectedEntity]?.columns || []).map((col: ColumnDefinition) => {
                    const isChecked = selectedColumns.includes(col.key);
                    return (
                      <label
                        key={col.key}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          isChecked
                            ? 'border-primary-300 bg-primary-50/40 dark:border-primary-800 dark:bg-primary-950/20'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleColumn(col.key)}
                          className="mt-0.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        <div className="text-xs">
                          <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <span>{col.label}</span>
                            {col.isSensitive && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-semibold">
                                Sensitive
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">{col.key}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Col: Format, Preview Trigger & Export Action */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  4. Export Format & Execution
                </h3>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Output File Format
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedFormat('CSV')}
                      className={`p-3 rounded-lg border text-center font-medium text-sm ${
                        selectedFormat === 'CSV'
                          ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      RFC-4180 CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFormat('XLSX')}
                      className={`p-3 rounded-lg border text-center font-medium text-sm ${
                        selectedFormat === 'XLSX'
                          ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Excel (XLSX)
                    </button>
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  <button
                    type="button"
                    onClick={handlePreviewExport}
                    disabled={isPreviewLoading || selectedColumns.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    {isPreviewLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-500" />
                    )}
                    <span>Preview Sample (10 Rows)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateExport}
                    disabled={isExporting || selectedColumns.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white font-medium text-sm hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isExporting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>Generate & Download Export</span>
                  </button>
                </div>

                {lastExportResult && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                    <div className="font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Export Created: {lastExportResult.fileName}</span>
                    </div>
                    <div>Total Records: {lastExportResult.rowCount} rows</div>
                    <div>
                      <a
                        href={lastExportResult.downloadUrl}
                        className="text-primary-600 dark:text-primary-400 font-semibold underline flex items-center gap-1 mt-1"
                      >
                        Click here to download again
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Data Retention Notice */}
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 space-y-2">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  24-Hour File Retention
                </div>
                <p>
                  Export artifacts are stored in encrypted workspace storage and automatically deleted after 24 hours. Every download increments the compliance log.
                </p>
              </div>
            </div>
          </div>

          {/* LIVE DATA PREVIEW TABLE */}
          {previewData && previewCols && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Live Sample Preview</span>
                    <span className="px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-950 text-primary-800 dark:text-primary-300 text-xs font-medium">
                      {previewData.length} rows
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sanitized cell values with formula injection protection ready for {selectedFormat} output.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg max-h-96">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 sticky top-0">
                    <tr>
                      {previewCols.map((c) => (
                        <th key={c.key} className="px-3 py-2.5 whitespace-nowrap">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {previewData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        {previewCols.map((c) => (
                          <td
                            key={c.key}
                            className="px-3 py-2 text-slate-800 dark:text-slate-200 whitespace-nowrap font-mono text-[11px]"
                          >
                            {row[c.key] || <span className="text-slate-400 italic">null</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: CUSTOM FIELDS (FIGMA FRAME 33 TAB 2)               */}
      {/* ========================================================= */}
      {activeTab === 'fields' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {['ALL', 'CANDIDATE', 'JOB', 'CLIENT'].map((ent) => (
                <button
                  key={ent}
                  onClick={() => setFieldEntityFilter(ent)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    fieldEntityFilter === ent
                      ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {ent === 'ALL' ? 'All Entities' : `${ent}s`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search field name or key..."
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsClientRuleModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>Client Rule Mapping</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddFieldModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 transition-colors shadow-sm whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Field</span>
              </button>
            </div>
          </div>

          {/* Fields Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Field Name & Key</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Visibility</th>
                    <th className="px-4 py-3">Version</th>
                    <th className="px-4 py-3">Usage</th>
                    <th className="px-4 py-3">Client Rules</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredFields.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        No custom fields found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredFields.map((field) => (
                      <tr key={field.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {field.fieldName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {field.fieldKey || 'no_key'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {field.entityType}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                          {field.fieldType}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              field.visibility === 'CLIENT_PROFILE_INCLUDED'
                                ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {field.visibility === 'CLIENT_PROFILE_INCLUDED'
                              ? 'Client Profile Included'
                              : 'Internal Only'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-mono font-bold">
                            v{field.version}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {field.usageCount ?? 0} records
                        </td>
                        <td className="px-4 py-3">
                          {field.clientRules && field.clientRules.length > 0 ? (
                            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                              Mandatory for {field.clientRules.length} client(s)
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              field.isActive
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {field.isActive ? 'Active' : 'Archived'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {field.isActive && (
                            <button
                              type="button"
                              onClick={() => handleArchiveCustomField(field.id, field.fieldName)}
                              className="text-rose-600 dark:text-rose-400 hover:underline text-xs font-medium"
                            >
                              Archive
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: ARCHIVE & RESTORE (FIGMA FRAME 33 TAB 3)          */}
      {/* ========================================================= */}
      {activeTab === 'archive' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 flex items-start gap-3">
            <Archive className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <span className="font-semibold">Candidate Soft-Deletion & Safe Restoration:</span> Candidate records are never permanently hard-deleted. Restoring an archived talent profile requires a mandatory business justification, automatically logs a compliance audit trail, and validates against active candidate conflicts.
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search archived candidate code, name or email..."
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Candidate</th>
                    <th className="px-4 py-3">Archived Date</th>
                    <th className="px-4 py-3">Archive Reason</th>
                    <th className="px-4 py-3">Applications</th>
                    <th className="px-4 py-3">Recruiter Owner</th>
                    <th className="px-4 py-3">Conflict Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredArchived.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No archived candidates found.
                      </td>
                    </tr>
                  ) : (
                    filteredArchived.map((cand) => (
                      <tr key={cand.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{cand.name}</div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {cand.code} · {cand.email}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {cand.archivedAt?.split('T')[0] || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                          {cand.archiveReason}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {cand.applicationCount} application(s)
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {cand.owner?.name || 'Unassigned'}
                        </td>
                        <td className="px-4 py-3">
                          {cand.hasConflict ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Active Conflict</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Ready to Restore</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRestoreCandidate(cand);
                              setRestoreReason('');
                              setRestoreError(null);
                            }}
                            className="px-2.5 py-1 rounded bg-primary-50 hover:bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300 text-xs font-semibold transition-colors"
                          >
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: DOWNLOAD POLICY (FIGMA FRAME 33 TAB 4)            */}
      {/* ========================================================= */}
      {activeTab === 'policy' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 flex items-start gap-3">
            <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-indigo-800 dark:text-indigo-300">
              <span className="font-semibold">Asia/Kolkata Daily Quota Boundary:</span> All role CV download counters reset at 00:00:00 IST (Indian Standard Time). Watermarking dynamically injects `HIREFLOW / [CLIENT NAME] / [DATE]` to prevent candidate poaching and unvetted profile sharing.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {downloadPolicies.map((p) => {
              const percentage = Math.min(100, Math.round(((p.usedToday || 0) / p.dailyCvLimit) * 100));
              return (
                <div
                  key={p.role}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                      {p.role}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPolicyForEdit(p);
                        setPolicyForm({
                          role: p.role,
                          dailyCvLimit: p.dailyCvLimit,
                          requireWatermark: p.requireWatermark,
                          allowOriginalDownload: p.allowOriginalDownload,
                          isActive: p.isActive,
                        });
                      }}
                      className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Edit Limits
                    </button>
                  </div>

                  <div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {p.usedToday || 0}{' '}
                      <span className="text-xs font-normal text-slate-500">/ {p.dailyCvLimit} CVs today</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                      <div
                        className={`h-full ${
                          percentage >= 90 ? 'bg-rose-500' : percentage >= 70 ? 'bg-amber-500' : 'bg-primary-600'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
                      <span>{p.remainingToday} remaining</span>
                      <span>{percentage}% quota used</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Watermark Enforced:</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {p.requireWatermark ? 'Yes (Branded)' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Original PDF Allowed:</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {p.allowOriginalDownload ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-1">
                      Reset Time: Midnight 00:00:00 IST
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: AUDIT TRAIL (FIGMA FRAME 33 TAB 5)                 */}
      {/* ========================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Filter by action (e.g. DATA_EXPORT)..."
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={async () => {
                  const res = await getAuditLogsAction({ action: auditActionFilter || undefined });
                  if (res.success && res.data) {
                    setAuditLogs(res.data);
                    setAuditMeta(res.meta);
                  }
                }}
                className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200"
              >
                Apply Filter
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportAuditLogs}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit Trail (CSV)</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Timestamp (UTC / IST)</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity Type</th>
                    <th className="px-4 py-3">IP Address</th>
                    <th className="px-4 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No audit logs recorded for this criteria.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                          {new Date(log.createdAt).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{log.actor?.name}</div>
                          <div className="text-[10px] text-slate-500 uppercase">{log.actor?.role}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-primary-700 dark:text-primary-400">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {log.entity} <span className="text-slate-400 font-mono text-[10px]">({log.entityId?.slice(0, 8)}...)</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                          {log.ipAddress || '127.0.0.1'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(log.before || log.after) && (
                            <button
                              type="button"
                              onClick={() => setSelectedDiffLog(log)}
                              className="text-primary-600 dark:text-primary-400 font-semibold hover:underline text-xs"
                            >
                              View Diff
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD CUSTOM FIELD                                   */}
      {/* ========================================================= */}
      {isAddFieldModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Add Custom Field</h3>
              <button onClick={() => setIsAddFieldModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomField} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target Entity
                  </label>
                  <select
                    value={fieldFormData.entityType}
                    onChange={(e) => setFieldFormData({ ...fieldFormData, entityType: e.target.value as any })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
                  >
                    <option value="CANDIDATE">Candidate</option>
                    <option value="JOB">Job Mandate</option>
                    <option value="CLIENT">Client Company</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Data Type
                  </label>
                  <select
                    value={fieldFormData.fieldType}
                    onChange={(e) => setFieldFormData({ ...fieldFormData, fieldType: e.target.value as any })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
                  >
                    <option value="TEXT">Text (Single Line)</option>
                    <option value="NUMBER">Number</option>
                    <option value="DATE">Date (ISO)</option>
                    <option value="URL">URL</option>
                    <option value="SELECT">Select (Single Option)</option>
                    <option value="MULTI_SELECT">Multi Select</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Field Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Notice Period Preference"
                  value={fieldFormData.fieldName}
                  onChange={(e) => handleFieldNameChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Unique Field Key (snake_case) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="notice_period_preference"
                  value={fieldFormData.fieldKey}
                  onChange={(e) => setFieldFormData({ ...fieldFormData, fieldKey: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800 font-mono"
                />
              </div>

              {(fieldFormData.fieldType === 'SELECT' || fieldFormData.fieldType === 'MULTI_SELECT') && (
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Configured Options (Comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="Immediate, 15 Days, 30 Days, 60 Days"
                    value={optionsInput}
                    onChange={(e) => setOptionsInput(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
                  />
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description / Recruiter Hint
                </label>
                <input
                  type="text"
                  placeholder="Explains what should be captured in this custom field"
                  value={fieldFormData.description}
                  onChange={(e) => setFieldFormData({ ...fieldFormData, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Visibility Scope
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      checked={fieldFormData.visibility === 'INTERNAL_ONLY'}
                      onChange={() => setFieldFormData({ ...fieldFormData, visibility: 'INTERNAL_ONLY' })}
                    />
                    <span>Internal Only</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      checked={fieldFormData.visibility === 'CLIENT_PROFILE_INCLUDED'}
                      onChange={() => setFieldFormData({ ...fieldFormData, visibility: 'CLIENT_PROFILE_INCLUDED' })}
                    />
                    <span>Client Profile Included</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddFieldModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold disabled:opacity-50"
                >
                  {isPending ? 'Creating...' : 'Create Field (v1)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CLIENT CUSTOM FIELD RULE                           */}
      {/* ========================================================= */}
      {isClientRuleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Map Client Submission Custom Field
              </h3>
              <button onClick={() => setIsClientRuleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClientRule} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Client Account *
                </label>
                <select
                  value={clientRuleData.clientId}
                  onChange={(e) => setClientRuleData({ ...clientRuleData, clientId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.legalName} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Custom Field Definition *
                </label>
                <select
                  value={clientRuleData.fieldDefinitionId}
                  onChange={(e) => setClientRuleData({ ...clientRuleData, fieldDefinitionId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
                >
                  {customFields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.fieldName} ({f.entityType} · {f.fieldKey})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-800 dark:text-amber-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clientRuleData.isRequired}
                    onChange={(e) => setClientRuleData({ ...clientRuleData, isRequired: e.target.checked })}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="font-semibold">Mandatory for Client Submission Approvals</span>
                </label>
                <p className="text-[11px] mt-1 text-amber-700 dark:text-amber-400">
                  When enabled, Prompt 18 Manager approval will reject submissions for this client if this field is blank.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsClientRuleModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Save Rule Binding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: RESTORE ARCHIVED CANDIDATE                         */}
      {/* ========================================================= */}
      {selectedRestoreCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Restore Candidate Record
              </h3>
              <button onClick={() => setSelectedRestoreCandidate(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {selectedRestoreCandidate.name} ({selectedRestoreCandidate.code})
              </div>
              <div className="text-slate-500 font-mono">{selectedRestoreCandidate.email}</div>
              <div className="text-slate-600 dark:text-slate-400">
                Archived: {selectedRestoreCandidate.archivedAt?.split('T')[0]} · Reason: {selectedRestoreCandidate.archiveReason}
              </div>
            </div>

            {selectedRestoreCandidate.hasConflict && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200 text-xs">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>Restoration Conflict Detected</span>
                </div>
                <p className="mt-1">{selectedRestoreCandidate.conflictDetails}</p>
              </div>
            )}

            {restoreError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {restoreError}
              </div>
            )}

            <form onSubmit={handleRestoreCandidate} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mandatory Justification Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why this archived profile is being reactivated (e.g. Candidate re-approached agency for current job mandate)..."
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedRestoreCandidate(null)}
                  className="px-4 py-2 border rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || selectedRestoreCandidate.hasConflict}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold disabled:opacity-50"
                >
                  {isPending ? 'Restoring...' : 'Confirm Restoration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: EDIT DOWNLOAD POLICY                               */}
      {/* ========================================================= */}
      {selectedPolicyForEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Configure Daily CV Download Limits ({policyForm.role})
              </h3>
              <button onClick={() => setSelectedPolicyForEdit(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdatePolicy} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Daily CV Download Quota (per user) *
                </label>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  required
                  value={policyForm.dailyCvLimit}
                  onChange={(e) => setPolicyForm({ ...policyForm, dailyCvLimit: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800 font-bold text-sm"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Applies per active {policyForm.role.toLowerCase()} user per day, resetting at midnight Asia/Kolkata.
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyForm.requireWatermark}
                    onChange={(e) => setPolicyForm({ ...policyForm, requireWatermark: e.target.checked })}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    Enforce Dynamic CV Watermark (`HIREFLOW / [CLIENT] / [DATE]`)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyForm.allowOriginalDownload}
                    onChange={(e) => setPolicyForm({ ...policyForm, allowOriginalDownload: e.target.checked })}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    Allow Original Unmarked Document Download
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedPolicyForEdit(null)}
                  className="px-4 py-2 border rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold disabled:opacity-50"
                >
                  {isPending ? 'Updating...' : 'Save Policy Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DRAWER: VIEW AUDIT DIFF                                   */}
      {/* ========================================================= */}
      {selectedDiffLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-end">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Audit Event Diff</span>
                    <span className="px-2 py-0.5 rounded text-xs font-mono bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300">
                      {selectedDiffLog.action}
                    </span>
                  </h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Actor: {selectedDiffLog.actor?.name} · Entity: {selectedDiffLog.entity} ({selectedDiffLog.entityId})
                  </div>
                </div>
                <button onClick={() => setSelectedDiffLog(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase text-slate-500">Before State</div>
                  <pre className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-200 overflow-x-auto max-h-96">
                    {JSON.stringify(selectedDiffLog.before || {}, null, 2)}
                  </pre>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase text-slate-500">After State</div>
                  <pre className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-200 overflow-x-auto max-h-96">
                    {JSON.stringify(selectedDiffLog.after || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDiffLog(null)}
                className="px-4 py-2 border rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-semibold"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
