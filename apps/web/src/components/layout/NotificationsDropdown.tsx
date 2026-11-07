'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, Check, Clock, ExternalLink } from 'lucide-react';
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from '@/actions/notifications';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  createdAt: string | Date;
  readAt: string | Date | null;
  category?: string;
  linkUrl?: string;
}

export function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadNotifications = async () => {
    try {
      const res = await getNotificationsAction('all', undefined, 5);
      if (res.success && res.items) {
        setNotifications(res.items as any);
        setUnreadCount(res.unreadCount);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadNotifications();

    // Setup SSE stream for live notification updates
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/notifications/stream');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NOTIFICATION') {
            loadNotifications();
          }
        } catch {
          // ignore parsing error
        }
      };
    } catch {
      // EventSource fallback
    }

    // Polling fallback every 45 seconds
    const interval = setInterval(loadNotifications, 45000);

    return () => {
      clearInterval(interval);
      if (eventSource) eventSource.close();
    };
  }, []);

  const handleMarkRead = async (id: string, linkUrl?: string) => {
    await markNotificationReadAction(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    if (linkUrl) {
      window.location.href = linkUrl;
    }
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    await markAllNotificationsReadAction();
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date() })));
    setUnreadCount(0);
    setLoading(false);
  };

  const formatTimeAgo = (dateInput: string | Date) => {
    const ms = Date.now() - new Date(dateInput).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
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
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
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
                  onClick={handleMarkAllRead}
                  disabled={loading}
                  className="text-xs text-[#5B49D6] hover:underline font-medium flex items-center gap-1 disabled:opacity-50"
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
                    onClick={() => handleMarkRead(item.id, item.linkUrl)}
                    className={`p-3.5 hover:bg-[#F6F7FB] transition-colors cursor-pointer ${
                      !item.readAt ? 'bg-[#EEEBFB]/30' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-semibold text-[#1B2236]">
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-[#6B7490] flex items-center gap-1 shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7490] mt-1 leading-relaxed line-clamp-2">
                      {item.message}
                    </p>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-[#6B7490]">
                  No notifications yet
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 bg-[#F6F7FB] border-t border-[#E6E8F0] text-center">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-xs font-semibold text-[#5B49D6] hover:underline inline-flex items-center gap-1.5"
              >
                <span>View all in Notification Centre</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
