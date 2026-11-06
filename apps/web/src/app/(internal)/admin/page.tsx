'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Shield,
  Key,
  Layers,
  Mail,
  FileText,
  ChevronRight,
  ExternalLink,
  History,
  X,
  RefreshCw,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { getAuditLogsAction } from '../../../actions/admin';

interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export default function AdminPage() {
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [activeIntegrationModal, setActiveIntegrationModal] = useState<string | null>(null);

  const adminCards = [
    {
      title: 'Teams & reporting lines',
      desc: 'Manage recruiters, managers, admins and client-facing access.',
      icon: Users,
      href: '/admin/team?tab=team',
      badge: 'Active Roster',
    },
    {
      title: 'Role & client permissions',
      desc: 'Control who can submit, approve, export and manage client records.',
      icon: Shield,
      href: '/admin/team?tab=permissions',
      badge: '5 Roles Configured',
    },
    {
      title: 'Google / email login & OTP',
      desc: 'Configure Google SSO, email login, OTP and session timeout policies.',
      icon: Key,
      href: '/admin/team?tab=team',
      badge: '@aurevacapital.com Enforced',
    },
    {
      title: 'Integrations',
      desc: 'Connect Gmail, Outlook, WhatsApp, calendars and external ATS services.',
      icon: Layers,
      onClick: () => setActiveIntegrationModal('Integrations'),
      badge: 'PostgreSQL Live',
    },
    {
      title: 'Email & WhatsApp templates',
      desc: 'Manage shared email, WhatsApp and offer templates with team signatures.',
      icon: Mail,
      onClick: () => setActiveIntegrationModal('Templates'),
      badge: 'Standardized',
    },
    {
      title: 'Custom fields & exports',
      desc: 'Configure custom fields, exports, archives and audit trails for the workspace.',
      icon: FileText,
      onClick: () => setActiveIntegrationModal('Custom Fields'),
      badge: 'GDPR Compliant',
    },
  ];

  const fetchAuditLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await getAuditLogsAction(25);
      if (res.success && res.data) {
        setAuditLogs(res.data);
      }
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isAuditModalOpen) {
      fetchAuditLogs();
    }
  }, [isAuditModalOpen]);

  return (
    <div className="space-y-6">
      {/* Top Header matching Figma Frame 11 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#1B2236] tracking-tight">Admin & Settings</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EEEBFB] text-[#5B49D6] border border-[#5B49D6]/20">
              Aureva Capital
            </span>
          </div>
          <p className="text-xs text-[#6B7490] mt-1">
            Manage teams, permissions, integrations, workflows and brand controls.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/careers-preview"
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#EEEBFB] text-[#5B49D6] hover:bg-[#5B49D6]/10 transition-colors flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Branded careers preview</span>
          </Link>

          <button
            onClick={() => setIsAuditModalOpen(true)}
            className="px-4 py-2 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-lg text-xs font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>Open audit log</span>
          </button>
        </div>
      </div>

      {/* 6 Settings Cards List matching Figma Frame 11 */}
      <div className="space-y-3">
        {adminCards.map((card, idx) => {
          const Icon = card.icon;
          const CardContent = (
            <div className="flex items-center justify-between p-5 bg-white rounded-xl border border-[#E6E8F0] shadow-xs hover:border-[#5B49D6]/40 hover:shadow-sm transition-all group cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center shrink-0 group-hover:bg-[#5B49D6] group-hover:text-white transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[#1B2236] group-hover:text-[#5B49D6] transition-colors">
                      {card.title}
                    </h3>
                    {card.badge && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F6F7FB] text-[#6B7490] border border-[#E6E8F0]">
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6B7490] mt-0.5 leading-relaxed">{card.desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[#6B7490] group-hover:text-[#5B49D6] transition-colors">
                <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          );

          if (card.href) {
            return (
              <Link key={idx} href={card.href} className="block">
                {CardContent}
              </Link>
            );
          }

          return (
            <div key={idx} onClick={card.onClick}>
              {CardContent}
            </div>
          );
        })}
      </div>

      {/* Quick Organization Summary Footer */}
      <div className="p-4 bg-white rounded-xl border border-[#E6E8F0] flex flex-col sm:flex-row items-center justify-between text-xs text-[#6B7490] gap-3">
        <div className="flex items-center gap-2">
          <Building className="w-4 h-4 text-[#5B49D6]" />
          <span>
            Workspace: <strong className="text-[#1B2236]">Aureva Capital Private Limited</strong> · CIN: U65999MH2024PTC123456
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#12B76A]" />
          <span className="font-medium text-[#12B76A]">Production ATS Schema v1.2 Active</span>
        </div>
      </div>

      {/* Audit Log Modal */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#E6E8F0] flex items-center justify-between bg-[#F6F7FB]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#EEEBFB] text-[#5B49D6]">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1B2236]">Enterprise Audit Trail</h3>
                  <p className="text-[11px] text-[#6B7490]">
                    Immutable log of administrative actions, reporting updates and permissions.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchAuditLogs}
                  disabled={isLoadingLogs}
                  className="p-1.5 rounded-lg border border-[#E6E8F0] hover:bg-white text-[#6B7490] hover:text-[#1B2236] transition-colors"
                  title="Refresh Logs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setIsAuditModalOpen(false)}
                  className="p-1.5 rounded-lg border border-[#E6E8F0] hover:bg-white text-[#6B7490] hover:text-[#1B2236] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 divide-y divide-[#E6E8F0]">
              {isLoadingLogs ? (
                <div className="py-12 text-center text-xs text-[#6B7490] flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#5B49D6]" />
                  <span>Loading recent security audit events...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#6B7490]">
                  No administrative audit records logged yet. Actions like team invites or reporting line updates will appear here.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[#6B7490] font-semibold uppercase text-[10px] tracking-wider border-b border-[#E6E8F0]">
                        <th className="pb-2.5">Timestamp</th>
                        <th className="pb-2.5">Actor</th>
                        <th className="pb-2.5">Action</th>
                        <th className="pb-2.5">Entity</th>
                        <th className="pb-2.5">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E8F0]">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#F6F7FB]/50 transition-colors">
                          <td className="py-2.5 pr-3 text-[#6B7490] font-mono text-[11px] whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString('en-IN', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="font-semibold text-[#1B2236]">{log.actorName}</div>
                            <span className="text-[10px] text-[#5B49D6]">{log.actorRole}</span>
                          </td>
                          <td className="py-2.5 pr-3 font-mono font-medium text-[11px] text-[#1B2236]">
                            <span className="px-1.5 py-0.5 rounded bg-[#EEEBFB] text-[#5B49D6]">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-[#6B7490]">
                            {log.entity} <span className="font-mono text-[10px]">({log.entityId.slice(0, 8)}...)</span>
                          </td>
                          <td className="py-2.5 text-[11px] text-[#6B7490] max-w-xs truncate">
                            {log.after ? JSON.stringify(log.after) : log.before ? JSON.stringify(log.before) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E6E8F0] bg-[#F6F7FB] flex justify-end">
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="px-4 py-2 bg-white border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#1B2236] rounded-lg text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Integration Info Modal */}
      {activeIntegrationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#12B76A]" />
                <h3 className="font-bold text-sm text-[#1B2236]">{activeIntegrationModal} Module</h3>
              </div>
              <button
                onClick={() => setActiveIntegrationModal(null)}
                className="p-1 rounded-md text-[#6B7490] hover:text-[#1B2236]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-4 text-xs text-[#6B7490] space-y-2">
              <p>
                <strong>{activeIntegrationModal}</strong> settings are governed by Aureva Capital enterprise policy.
              </p>
              <p>
                Database connection: <strong className="text-[#1B2236]">Supabase PostgreSQL (Direct Prisma)</strong>
              </p>
              <p>
                Authentication: <strong className="text-[#1B2236]">Google OIDC & Corporate Email Login</strong>
              </p>
              <p>
                Data API: <span className="text-[#12B76A] font-semibold">Disabled (Enforced)</span>
              </p>
            </div>
            <div className="pt-3 border-t border-[#E6E8F0] flex justify-end">
              <button
                onClick={() => setActiveIntegrationModal(null)}
                className="px-4 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
