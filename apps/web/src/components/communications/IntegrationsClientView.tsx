'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  KeyRound,
  ArrowLeft,
  Server,
  RefreshCw,
} from 'lucide-react';

interface IntegrationsClientViewProps {
  initialIntegrations: any[];
}

export function IntegrationsClientView({ initialIntegrations }: IntegrationsClientViewProps) {
  const [integrations, setIntegrations] = useState<any[]>(initialIntegrations);
  const [selectedPermissionModal, setSelectedPermissionModal] = useState<any | null>(null);
  const [testNotification, setTestNotification] = useState<string | null>(null);

  const handleTestConnection = (integration: any) => {
    setTestNotification(
      `Testing connection for ${integration.name}... Result: Active & verified via Mock Provider (Prompt 25 connects live OAuth in production).`
    );
    setTimeout(() => {
      setTestNotification(null);
    }, 5000);
  };

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
              Communication Integrations
            </h1>
            <p className="text-xs text-[#6B7490] mt-0.5">
              Secure third-party channels for candidate outreach, calendar synchronization, and automated alerts.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F4F1FD] border border-[#D8D2FB] text-xs font-semibold text-[#5B49D6]">
            <Lock className="w-3.5 h-3.5 text-[#5B49D6]" />
            <span>AES-256-GCM Encrypted Token Storage</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Security Notification Banner */}
        <div className="mb-8 p-4 rounded-xl bg-white border border-[#E6E8F0] shadow-sm flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#E5E0FA] text-[#5B49D6] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#1B2236]">Enterprise Privacy & Secret Governance</h3>
            <p className="text-xs text-[#6B7490] mt-0.5 leading-relaxed">
              HireFlow ATS never stores plain-text OAuth refresh tokens or external API keys. Every token is encrypted at the application boundary using unique 12-byte initialization vectors and 16-byte authentication tags before persisting to Supabase PostgreSQL.
            </p>
          </div>
        </div>

        {testNotification && (
          <div className="mb-6 p-3 rounded-lg bg-[#DCFCE7] border border-[#86EFAC] text-xs text-[#15803D] flex items-center justify-between">
            <span>{testNotification}</span>
            <button type="button" onClick={() => setTestNotification(null)}>
              ✕
            </button>
          </div>
        )}

        {/* 4 Integrations Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {integrations.map((item) => {
            let badgeBg = 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]';
            if (item.statusBadge === 'Ready') {
              badgeBg = 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]';
            } else if (item.statusBadge === 'Demo mode') {
              badgeBg = 'bg-[#F4F1FD] text-[#5B49D6] border-[#D8D2FB]';
            }

            return (
              <div
                key={item.provider}
                className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#F8F9FC] border border-[#E6E8F0] flex items-center justify-center text-[#1B2236]">
                        {item.provider === 'GMAIL' && <Mail className="w-5 h-5 text-[#EA4335]" />}
                        {item.provider === 'OUTLOOK' && <Mail className="w-5 h-5 text-[#0078D4]" />}
                        {item.provider === 'WHATSAPP' && <MessageSquare className="w-5 h-5 text-[#25D366]" />}
                        {item.provider === 'SMS' && <Phone className="w-5 h-5 text-[#5B49D6]" />}
                      </div>

                      <div>
                        <h2 className="text-sm font-bold text-[#1B2236]">{item.name}</h2>
                        <span className={`inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-bold border ${badgeBg}`}>
                          {item.statusBadge}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#6B7490] mt-3 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="mt-4 pt-4 border-t border-[#E6E8F0] space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[#6B7490]">
                      <span>Account Identifier:</span>
                      <span className="font-semibold text-[#1B2236]">
                        {item.email || item.accountIdentifier || 'Not Connected'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[#6B7490]">
                      <span>Required OAuth Scopes:</span>
                      <span className="font-mono text-[11px] text-[#5B49D6]">
                        {item.requiredScopes.length} Scopes
                      </span>
                    </div>

                    {item.lastRefreshedAt && (
                      <div className="flex items-center justify-between text-[#6B7490]">
                        <span>Last Verified:</span>
                        <span className="text-[11px] text-[#1B2236]">
                          {new Date(item.lastRefreshedAt).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#E6E8F0] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedPermissionModal(item)}
                    className="text-xs font-semibold text-[#5B49D6] hover:underline flex items-center gap-1"
                  >
                    <span>Review Permissions</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTestConnection(item)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-[#1B2236] bg-[#F4F5FA] hover:bg-[#EAEBED] border border-[#E6E8F0] rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3 text-[#6B7490]" />
                    <span>Test Connection</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* REVIEW PERMISSIONS MODAL */}
      {selectedPermissionModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E6E8F0]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#F4F1FD] text-[#5B49D6] flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1B2236]">
                    {selectedPermissionModal.name}
                  </h2>
                  <p className="text-xs text-[#6B7490]">Permissions & Token Security Scope</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPermissionModal(null)}
                className="text-[#6B7490] hover:text-[#1B2236]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-[#1B2236] mb-1.5">Authorized Data Access</h4>
                <ul className="space-y-1.5 text-[#6B7490]">
                  {selectedPermissionModal.reviewPermissions.map((perm: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                      <span>{perm}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-[#1B2236] mb-1.5">OAuth 2.0 Scopes</h4>
                <div className="p-2.5 bg-[#FAFBFD] border border-[#E6E8F0] rounded-lg space-y-1">
                  {selectedPermissionModal.requiredScopes.map((scope: string) => (
                    <p key={scope} className="font-mono text-[10px] text-[#5B49D6]">
                      {scope}
                    </p>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-[#F4F5FA] rounded-lg border border-[#E6E8F0] text-[11px] text-[#6B7490] leading-relaxed">
                Token Security: Credentials are stored with AES-256-GCM symmetric encryption in Supabase PostgreSQL using an isolated environment master key.
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPermissionModal(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#5B49D6] hover:bg-[#4C3BC2] rounded-lg shadow-sm"
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
