'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useDevUser } from '../../../context/DevUserContext';
import {
  Users,
  Briefcase,
  Calendar,
  Send,
  Plus,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { currentUser, currentRole } = useDevUser();

  const stats = [
    { label: 'Active Candidates', value: '142', change: '+12% this week', icon: Users, color: 'text-[#5B49D6]' },
    { label: 'Open Job Mandates', value: '28', change: '4 urgent priority', icon: Briefcase, color: 'text-[#3B82F6]' },
    { label: 'Interviews Scheduled', value: '18', change: '5 today', icon: Calendar, color: 'text-[#F59E0B]' },
    { label: 'Client Submissions', value: '64', change: '8 pending review', icon: Send, color: 'text-[#12B76A]' },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${currentUser.name}`}
        subtitle={`Role: ${currentRole} • ${currentUser.roleTitle} — Overview of daily recruitment pipeline.`}
        breadcrumbs={[{ label: 'Dashboard' }]}
        actions={
          <div className="flex gap-2">
            <Link
              href="/candidates"
              className="px-3.5 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Candidate</span>
            </Link>
          </div>
        }
      />

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="bg-white rounded-xl p-5 border border-[#E6E8F0] shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#6B7490]">{stat.label}</span>
                <div className="p-2 rounded-lg bg-[#F6F7FB]">
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-[#1B2236]">{stat.value}</div>
                <div className="text-xs text-[#12B76A] mt-1 font-medium flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  <span>{stat.change}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Pipeline Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0] mb-4">
            <div>
              <h2 className="text-base font-bold text-[#1B2236]">Recent Pipeline Activity</h2>
              <p className="text-xs text-[#6B7490]">Latest updates across assigned job orders</p>
            </div>
            <span className="text-xs font-semibold text-[#5B49D6] bg-[#EEEBFB] px-2.5 py-1 rounded-full">
              Live Feed
            </span>
          </div>

          <div className="space-y-4">
            {[
              {
                candidate: 'Aarav Shah',
                role: 'Senior React Engineer',
                action: 'Moved to Client Review by Sarah Jenkins',
                time: '25m ago',
                status: 'Client Review',
                statusColor: 'bg-[#EEEBFB] text-[#5B49D6]',
              },
              {
                candidate: 'Priya Sharma',
                role: 'Engineering Manager',
                action: 'Interview scheduled with Acme Corp',
                time: '1h ago',
                status: 'Interview',
                statusColor: 'bg-[#E5F0FF] text-[#3B82F6]',
              },
              {
                candidate: 'Rohan Mehta',
                role: 'DevOps Architect',
                action: 'Offer letter generated and sent for sign-off',
                time: '3h ago',
                status: 'Offer',
                statusColor: 'bg-[#FEF3DC] text-[#F59E0B]',
              },
            ].map((activity, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 rounded-lg border border-[#E6E8F0] hover:bg-[#F6F7FB] transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#1B2236]">{activity.candidate}</span>
                    <span className="text-xs text-[#6B7490]">• {activity.role}</span>
                  </div>
                  <p className="text-[11px] text-[#6B7490] mt-0.5">{activity.action}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activity.statusColor}`}>
                    {activity.status}
                  </span>
                  <div className="text-[10px] text-[#6B7490] mt-1">{activity.time}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-[#E6E8F0] text-center">
            <span className="text-xs text-[#6B7490]">
              Full database persistence & CRUD logic will be connected in Phase 1 (Prompt 5+).
            </span>
          </div>
        </div>

        {/* Quick Actions & Shortlist */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-[#1B2236] mb-1">Quick Shortcuts</h2>
            <p className="text-xs text-[#6B7490] mb-4">Fast navigation to primary ATS modules</p>

            <div className="space-y-2">
              <Link
                href="/candidates"
                className="block p-3 rounded-lg border border-[#E6E8F0] hover:border-[#5B49D6] hover:bg-[#EEEBFB]/30 transition-all text-xs"
              >
                <div className="font-semibold text-[#1B2236]">Candidate Talent Pool</div>
                <div className="text-[11px] text-[#6B7490] mt-0.5">Filter by skills, tags & resume parser</div>
              </Link>
              <Link
                href="/jobs"
                className="block p-3 rounded-lg border border-[#E6E8F0] hover:border-[#5B49D6] hover:bg-[#EEEBFB]/30 transition-all text-xs"
              >
                <div className="font-semibold text-[#1B2236]">Job Openings</div>
                <div className="text-[11px] text-[#6B7490] mt-0.5">Manage pipeline stages & requirements</div>
              </Link>
              <Link
                href="/interviews"
                className="block p-3 rounded-lg border border-[#E6E8F0] hover:border-[#5B49D6] hover:bg-[#EEEBFB]/30 transition-all text-xs"
              >
                <div className="font-semibold text-[#1B2236]">Interview Calendar</div>
                <div className="text-[11px] text-[#6B7490] mt-0.5">Sync slots and coordinate feedback</div>
              </Link>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#E6E8F0] text-[11px] text-[#6B7490] flex items-center justify-between">
            <span>HireFlow ATS Shell v0.1</span>
            <Link href="/design" className="text-[#5B49D6] font-semibold hover:underline">
              Design System →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
