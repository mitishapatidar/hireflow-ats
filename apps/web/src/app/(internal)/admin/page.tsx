'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Shield, Users, Key, FileText } from 'lucide-react';

export default function AdminPage() {
  const adminSections = [
    { title: 'User Roles & Permissions', desc: 'Manage access levels for Recruiters, Managers, and Admins.', icon: Shield },
    { title: 'Team Structure & Reporting', desc: 'Define reporting hierarchies and agency client desks.', icon: Users },
    { title: 'API Keys & Integrations', desc: 'Configure Supabase, BullMQ, Google OAuth, and WhatsApp keys.', icon: Key },
    { title: 'Audit Trail & Compliance', desc: 'Inspect immutable state change logs and candidate data exports.', icon: FileText },
  ];

  return (
    <div>
      <PageHeader
        title="Admin & System Settings"
        subtitle="Configure agency master settings, security permissions, and audit logs."
        breadcrumbs={[{ label: 'Admin & Settings' }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {adminSections.map((sec, i) => {
          const Icon = sec.icon;
          return (
            <div
              key={i}
              className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs hover:border-[#5B49D6]/50 transition-all flex items-start gap-4"
            >
              <div className="p-2.5 rounded-xl bg-[#EEEBFB] text-[#5B49D6] shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#1B2236]">{sec.title}</h3>
                <p className="text-xs text-[#6B7490] mt-1 leading-relaxed">{sec.desc}</p>
                <button
                  onClick={() => alert(`${sec.title} settings module arrives in Prompt 5 & Phase 2.`)}
                  className="mt-3 text-xs text-[#5B49D6] font-semibold hover:underline"
                >
                  Configure →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-white rounded-xl border border-[#E6E8F0] text-center text-xs text-[#6B7490]">
        Security policies, team role assignment, and audit logs will be configured in Prompt 5 & Phase 2.
      </div>
    </div>
  );
}
