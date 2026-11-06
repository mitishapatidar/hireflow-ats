'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Building2, Plus } from 'lucide-react';

export default function ClientsPage() {
  const mockClients = [
    { id: '1', name: 'Acme Corporation', industry: 'SaaS & FinTech', primaryContact: 'David Sterling (VP Eng)', email: 'david.s@acmecorp.com', activeJobs: 6, totalPlacements: 12, feeRate: '8.5%' },
    { id: '2', name: 'Starlight Tech Solutions', industry: 'AI & Cloud Infrastructure', primaryContact: 'Vikram Joshi (CTO)', email: 'vikram.j@starlight.io', activeJobs: 4, totalPlacements: 8, feeRate: '8.0%' },
    { id: '3', name: 'FinServe Global', industry: 'Banking & Wealth Tech', primaryContact: 'Meera Rao (HR Director)', email: 'meera.r@finserve.com', activeJobs: 3, totalPlacements: 5, feeRate: '9.0%' },
  ];

  return (
    <div>
      <PageHeader
        title="Clients CRM & Accounts"
        subtitle="Manage client master records, hiring managers, commercial terms, and active mandates."
        breadcrumbs={[{ label: 'Clients CRM' }]}
        actions={
          <button
            onClick={() => alert('New client onboarding form arrives in Phase 1 (Prompt 7).')}
            className="px-3.5 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Client Record</span>
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {mockClients.map((client) => (
          <div
            key={client.id}
            className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs hover:border-[#5B49D6]/50 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-lg bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1B2236]">{client.name}</h3>
                  <span className="text-[11px] text-[#6B7490]">{client.industry}</span>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-[#6B7490]">
                <div>Primary Contact: <strong className="text-[#1B2236]">{client.primaryContact}</strong></div>
                <div>Email: <span className="text-[#5B49D6]">{client.email}</span></div>
                <div>Agreed Margin: <span className="text-[#12B76A] font-semibold">{client.feeRate}</span></div>
              </div>
            </div>

            <div className="mt-4 pt-3.5 border-t border-[#E6E8F0] flex items-center justify-between text-xs">
              <span className="text-[#6B7490] font-medium">{client.activeJobs} active mandates</span>
              <button
                onClick={() => alert(`Opening client account for ${client.name}. Client CRM details arrive in Phase 1 (Prompt 7).`)}
                className="text-[#5B49D6] font-semibold hover:underline"
              >
                View Account →
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-white rounded-xl border border-[#E6E8F0] text-center text-xs text-[#6B7490]">
        Client contacts, CRM pipelines, and contract fee settings will be connected in Phase 1 (Prompt 7).
      </div>
    </div>
  );
}
