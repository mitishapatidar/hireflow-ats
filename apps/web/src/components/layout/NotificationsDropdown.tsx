'use client';

import React, { useState } from 'react';
import { Bell, Check, Clock } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: 'submission' | 'interview' | 'approval' | 'system';
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    title: 'Candidate Profile Shortlisted',
    description: 'Sarah Jenkins shortlisted Aarav Shah for Senior Frontend Lead.',
    time: '12m ago',
    read: false,
    type: 'submission',
  },
  {
    id: 'n2',
    title: 'Interview Confirmed',
    description: 'David Sterling accepted the Technical round on Nov 10, 2:30 PM.',
    time: '1h ago',
    read: false,
    type: 'interview',
  },
  {
    id: 'n3',
    title: 'New Mandate Assigned',
    description: 'Marcus Vance assigned 3 new requisitions for Acme Corp.',
    time: '3h ago',
    read: false,
    type: 'approval',
  },
];

export function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-[#6B7490] hover:text-[#1B2236] hover:bg-[#F6F7FB] transition-colors"
        title="Notifications"
        aria-label="Open notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#E5484D] text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-[#E6E8F0] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#E6E8F0] flex items-center justify-between bg-[#F6F7FB]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-[#1B2236]">Notifications</span>
                {unreadCount > 0 && (
                  <span className="bg-[#EEEBFB] text-[#5B49D6] text-xs font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-[#5B49D6] hover:underline font-medium flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-[#E6E8F0]">
              {notifications.length > 0 ? (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 hover:bg-[#F6F7FB] transition-colors cursor-pointer ${
                      !item.read ? 'bg-[#EEEBFB]/30' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-semibold text-[#1B2236]">
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-[#6B7490] flex items-center gap-1 shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        {item.time}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7490] mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-[#6B7490]">
                  No new notifications
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 bg-[#F6F7FB] border-t border-[#E6E8F0] text-center">
              <span className="text-[11px] text-[#6B7490]">
                Unified ATS alerts & notifications (Phase 3)
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
