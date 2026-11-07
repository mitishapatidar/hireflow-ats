'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../../../../components/layout/PageHeader';
import {
  FileSpreadsheet,
  Download,
  RefreshCw,
  Bookmark,
  Shield,
  Search,
  X,
  Layers,
  ArrowUpDown,
  Filter,
  Check,
  AlertCircle,
  Lock,
} from 'lucide-react';
import {
  REPORT_COLUMN_CATALOG,
  ALLOWED_LINKED_ENTITIES,
  SUPPORTED_GROUP_BY_DIMENSIONS,
  ReportEntityType,
  ReportColumnMetadata,
} from '@hireflow/shared';
import {
  previewCustomReport,
  saveReportViewAction,
  exportCustomReportAction,
} from '@/actions/reports';

export default function ReportBuilderPage() {
  const [reportName, setReportName] = useState('Untitled Recruitment Report');
  const [primaryEntity, setPrimaryEntity] = useState<ReportEntityType>('CANDIDATES');
  const [selectedLinked, setSelectedLinked] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(['code', 'name', 'email', 'currentTitle', 'status']);
  const [columnSearch, setColumnSearch] = useState('');
  const [groupBy, setGroupBy] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [period, setPeriod] = useState<string>('LAST_30_DAYS');

  // Preview state
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [asOfTimestamp, setAsOfTimestamp] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Save Modal state
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [reportDesc, setReportDesc] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Available catalog for current entity
  const availableColumns = REPORT_COLUMN_CATALOG[primaryEntity] || [];
  const allowedLinked = ALLOWED_LINKED_ENTITIES[primaryEntity] || [];

  // Filter columns by search
  const filteredAvailableColumns = availableColumns.filter(
    (col) =>
      col.label.toLowerCase().includes(columnSearch.toLowerCase()) ||
      col.key.toLowerCase().includes(columnSearch.toLowerCase())
  );

  // Fetch preview
  const handleRefreshPreview = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await previewCustomReport({
        primaryEntity,
        linkedEntities: selectedLinked,
        selectedColumns,
        groupBy: groupBy || undefined,
        sortBy: sortBy || undefined,
        sortDirection,
        filters: { period },
        limit: 5,
      });

      setPreviewData(res.rows);
      setTotalCount(res.totalCount);
      setAsOfTimestamp(
        new Date(res.asOf).toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' IST'
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate report preview.');
    } finally {
      setLoading(false);
    }
  }, [primaryEntity, selectedLinked, selectedColumns, groupBy, sortBy, sortDirection, period]);

  // Initial load
  useEffect(() => {
    handleRefreshPreview();
  }, [handleRefreshPreview]);

  // Switch entity handler
  const handleSelectEntity = (entity: ReportEntityType) => {
    setPrimaryEntity(entity);
    setSelectedLinked([]);
    const defaultCols = REPORT_COLUMN_CATALOG[entity].filter((c) => c.isDefault).map((c) => c.key);
    setSelectedColumns(defaultCols.length > 0 ? defaultCols : [REPORT_COLUMN_CATALOG[entity][0].key]);
  };

  const handleToggleColumn = (colKey: string) => {
    if (selectedColumns.includes(colKey)) {
      if (selectedColumns.length > 1) {
        setSelectedColumns(selectedColumns.filter((c) => c !== colKey));
      }
    } else {
      setSelectedColumns([...selectedColumns, colKey]);
    }
  };

  const handleToggleLinked = (linked: string) => {
    if (selectedLinked.includes(linked)) {
      setSelectedLinked(selectedLinked.filter((l) => l !== linked));
    } else {
      setSelectedLinked([...selectedLinked, linked]);
    }
  };

  // Export handlers
  const handleExport = async (format: 'CSV' | 'XLSX') => {
    try {
      const exportRes = await exportCustomReportAction(
        {
          primaryEntity,
          linkedEntities: selectedLinked,
          selectedColumns,
          groupBy: groupBy || undefined,
          sortBy: sortBy || undefined,
          sortDirection,
          filters: { period },
          limit: 10000,
        },
        format
      );

      const blob = new Blob([exportRes.content], { type: exportRes.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hireflow_${primaryEntity.toLowerCase()}_${Date.now()}.${exportRes.extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // Save report handler
  const handleSaveReport = async () => {
    try {
      await saveReportViewAction({
        name: reportName,
        description: reportDesc || undefined,
        primaryEntity,
        linkedEntities: selectedLinked,
        selectedColumns,
        groupBy: groupBy || undefined,
        sortBy: sortBy || undefined,
        sortDirection,
        filters: { period },
        isShared,
        sharedWithUserIds: [],
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsSaveModalOpen(false);
      }, 1200);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Custom Report Builder"
        subtitle="Design cross-entity analytical reports, inspect bounded live previews, and export to CSV or Excel."
        breadcrumbs={[{ label: 'Reports', href: '/reports' }, { label: 'Report Builder' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSaveModalOpen(true)}
              className="px-3.5 py-2 bg-white border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#1B2236] rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Bookmark className="w-3.5 h-3.5 text-[#5B49D6]" />
              <span>Save View</span>
            </button>
            <button
              onClick={handleRefreshPreview}
              disabled={loading}
              className="px-3.5 py-2 bg-white border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#1B2236] rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#6B7490] ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Preview</span>
            </button>
            <button
              onClick={() => handleExport('CSV')}
              className="px-3.5 py-2 bg-white border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#1B2236] rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-[#6B7490]" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => handleExport('XLSX')}
              className="px-3.5 py-2 bg-[#5B49D6] hover:bg-[#4a39b8] text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
              <span>Export Excel</span>
            </button>
          </div>
        }
      />

      {/* Top Configuration Bar: Report Name & Primary Entity */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E6E8F0]">
          <div className="flex-1 max-w-md">
            <label className="text-xs font-semibold text-[#6B7490] uppercase tracking-wider block mb-1">Report Name</label>
            <input
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              className="w-full text-base font-bold text-[#1B2236] border border-[#E6E8F0] focus:border-[#5B49D6] rounded-lg px-3 py-1.5 outline-none"
              placeholder="e.g. Q4 Candidate Pipeline Summary"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6B7490] font-medium flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-[#12B76A]" /> Zero-Leak Enforced
            </span>
          </div>
        </div>

        {/* Primary Entity Pills */}
        <div className="mt-4">
          <label className="text-xs font-semibold text-[#6B7490] uppercase tracking-wider block mb-2">1. Select Primary Entity</label>
          <div className="flex flex-wrap gap-2">
            {(['CANDIDATES', 'JOBS', 'APPLICATIONS', 'INTERVIEWS', 'SUBMISSIONS', 'CLIENTS', 'PLACEMENTS'] as ReportEntityType[]).map((ent) => {
              const active = primaryEntity === ent;
              return (
                <button
                  key={ent}
                  onClick={() => handleSelectEntity(ent)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#5B49D6] text-white shadow-xs'
                      : 'bg-[#F6F7FB] text-[#6B7490] hover:bg-[#EEEBFB] hover:text-[#5B49D6]'
                  }`}
                >
                  {ent}
                </button>
              );
            })}
          </div>
        </div>

        {/* Linked Entities */}
        {allowedLinked.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#E6E8F0]">
            <label className="text-xs font-semibold text-[#6B7490] uppercase tracking-wider block mb-2">2. Include Linked Relations</label>
            <div className="flex flex-wrap gap-3">
              {allowedLinked.map((linked) => {
                const checked = selectedLinked.includes(linked);
                return (
                  <label key={linked} className="flex items-center gap-2 text-xs text-[#1B2236] font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleLinked(linked)}
                      className="rounded border-[#E6E8F0] text-[#5B49D6] focus:ring-[#5B49D6]"
                    />
                    <span>{linked}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Column Catalog (Left) + Filters & Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column Catalog Selector (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1B2236] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#5B49D6]" />
              <span>Select Columns ({selectedColumns.length})</span>
            </h3>
          </div>

          {/* Search Columns */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#6B7490] absolute left-3 top-2.5" />
            <input
              type="text"
              value={columnSearch}
              onChange={(e) => setColumnSearch(e.target.value)}
              placeholder="Search available fields..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-[#E6E8F0] focus:border-[#5B49D6] outline-none"
            />
          </div>

          {/* Available Columns List */}
          <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
            {filteredAvailableColumns.map((col: ReportColumnMetadata) => {
              const isSelected = selectedColumns.includes(col.key);
              return (
                <div
                  key={col.key}
                  onClick={() => handleToggleColumn(col.key)}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#EEEBFB] border-[#5B49D6] text-[#5B49D6] font-semibold'
                      : 'bg-white border-[#E6E8F0] text-[#1B2236] hover:bg-[#F6F7FB]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {isSelected ? <Check className="w-3.5 h-3.5 text-[#5B49D6] shrink-0" /> : <div className="w-3.5 h-3.5 border border-[#6B7490] rounded-xs shrink-0" />}
                    <span className="truncate">{col.label}</span>
                    {col.isSensitive && (
                      <span title="Administrator Role Only" className="shrink-0 text-[#6B7490]">
                        <Lock className="w-3 h-3 text-[#DC2626]" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] uppercase font-bold text-[#6B7490] bg-[#F6F7FB] px-1.5 py-0.5 rounded-xs shrink-0 ml-1">
                    {col.dataType}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Selected Columns Chips */}
          <div className="pt-3 border-t border-[#E6E8F0]">
            <label className="text-[11px] font-semibold text-[#6B7490] uppercase block mb-1.5">Active Order</label>
            <div className="flex flex-wrap gap-1.5">
              {selectedColumns.map((colKey) => {
                const meta = availableColumns.find((c) => c.key === colKey);
                return (
                  <span
                    key={colKey}
                    className="inline-flex items-center gap-1 text-[11px] bg-[#EEEBFB] text-[#5B49D6] px-2 py-0.5 rounded-md font-medium"
                  >
                    <span>{meta?.label || colKey}</span>
                    <button
                      onClick={() => handleToggleColumn(colKey)}
                      className="hover:text-[#DC2626] cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filter Controls & Live Preview (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Controls Bar: Group By, Sort, Period */}
          <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Group By */}
            <div>
              <label className="text-[11px] font-bold text-[#6B7490] uppercase block mb-1 flex items-center gap-1">
                <Layers className="w-3 h-3 text-[#5B49D6]" /> Group By
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="w-full text-xs border border-[#E6E8F0] rounded-lg px-2.5 py-1.5 bg-white text-[#1B2236] outline-none"
              >
                <option value="">None (Individual Records)</option>
                {Object.entries(SUPPORTED_GROUP_BY_DIMENSIONS).map(([key, dim]) => (
                  <option key={key} value={dim.field}>
                    {dim.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="text-[11px] font-bold text-[#6B7490] uppercase block mb-1 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-[#5B49D6]" /> Sort Direction
              </label>
              <div className="flex gap-1.5">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="flex-1 text-xs border border-[#E6E8F0] rounded-lg px-2.5 py-1.5 bg-white text-[#1B2236] outline-none"
                >
                  <option value="createdAt">Created Date</option>
                  <option value="code">Tracking Code</option>
                  <option value="name">Name / Title</option>
                </select>
                <button
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  className="px-2.5 py-1.5 border border-[#E6E8F0] hover:bg-[#F6F7FB] rounded-lg text-xs font-semibold text-[#1B2236] cursor-pointer"
                  title="Toggle Ascending / Descending"
                >
                  {sortDirection.toUpperCase()}
                </button>
              </div>
            </div>

            {/* Reporting Period */}
            <div>
              <label className="text-[11px] font-bold text-[#6B7490] uppercase block mb-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-[#5B49D6]" /> Date Period
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full text-xs border border-[#E6E8F0] rounded-lg px-2.5 py-1.5 bg-white text-[#1B2236] outline-none"
              >
                <option value="ALL">All Time</option>
                <option value="LAST_7_DAYS">Last 7 Days</option>
                <option value="LAST_30_DAYS">Last 30 Days</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="LAST_MONTH">Last Month</option>
              </select>
            </div>
          </div>

          {/* Live Preview Table Card */}
          <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E6E8F0] gap-2">
              <div>
                <h4 className="text-sm font-bold text-[#1B2236]">Live Preview (5 Rows)</h4>
                <p className="text-[11px] text-[#6B7490]">
                  Generated As-Of: <span className="font-semibold text-[#1B2236]">{asOfTimestamp || 'Loading...'}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#EEEBFB] text-[#5B49D6]">
                  Total Matching: {totalCount}
                </span>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="my-3 p-3 rounded-lg bg-[#FEF2F2] border border-[#F87171] text-xs text-[#DC2626] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F6F7FB] border-b border-[#E6E8F0] text-[#6B7490]">
                    {selectedColumns.map((colKey) => {
                      const meta = availableColumns.find((c) => c.key === colKey);
                      return (
                        <th key={colKey} className="px-3 py-2 font-semibold whitespace-nowrap">
                          {meta?.label || colKey}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E8F0]">
                  {loading ? (
                    <tr>
                      <td colSpan={selectedColumns.length} className="text-center py-8 text-[#6B7490]">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#5B49D6]" />
                        <span>Querying live records...</span>
                      </td>
                    </tr>
                  ) : previewData.length === 0 ? (
                    <tr>
                      <td colSpan={selectedColumns.length} className="text-center py-8 text-[#6B7490]">
                        No records match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    previewData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#F6F7FB]/50 transition-colors">
                        {selectedColumns.map((colKey) => (
                          <td key={colKey} className="px-3 py-2 text-[#1B2236] whitespace-nowrap font-medium">
                            {row[colKey] !== undefined && row[colKey] !== null ? String(row[colKey]) : '—'}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Permission Boundary Panel */}
          <div className="bg-[#F6F7FB] rounded-xl border border-[#E6E8F0] p-4 text-xs text-[#6B7490] space-y-2">
            <div className="flex items-center gap-2 font-bold text-[#1B2236]">
              <Shield className="w-4 h-4 text-[#5B49D6]" />
              <span>Permission Boundary & Security Guarantee</span>
            </div>
            <p>
              Your current view is scoped strictly to your authorized recruitment permissions.
              Internal candidate salary notes, fee percentages, and recruiter commercial margins are strictly protected.
              Sharing a report view does not expand record permissions for recipients.
            </p>
          </div>
        </div>
      </div>

      {/* Save Report Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E6E8F0]">
              <h3 className="font-bold text-sm text-[#1B2236]">Save Custom Report View</h3>
              <button onClick={() => setIsSaveModalOpen(false)} className="text-[#6B7490] hover:text-[#1B2236]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#6B7490] block mb-1">Report View Name</label>
              <input
                type="text"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                className="w-full text-xs border border-[#E6E8F0] focus:border-[#5B49D6] rounded-lg p-2.5 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#6B7490] block mb-1">Description (Optional)</label>
              <textarea
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
                placeholder="e.g. Monthly quantitative analyst recruitment progress"
                rows={2}
                className="w-full text-xs border border-[#E6E8F0] focus:border-[#5B49D6] rounded-lg p-2.5 outline-none"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-[#1B2236] cursor-pointer">
              <input
                type="checkbox"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="rounded border-[#E6E8F0] text-[#5B49D6]"
              />
              <span>Share with team (viewers only see records in their own permitted scope)</span>
            </label>

            {saveSuccess && (
              <div className="p-2 rounded bg-[#DCFCE7] text-[#15803D] text-xs font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4" /> View saved successfully!
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-[#6B7490] hover:text-[#1B2236] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReport}
                className="px-4 py-2 bg-[#5B49D6] hover:bg-[#4a39b8] text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs"
              >
                Save Report View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
