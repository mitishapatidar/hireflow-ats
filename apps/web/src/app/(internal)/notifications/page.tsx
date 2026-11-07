'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useTransition } from 'react';
import {
  Bell,
  CheckCheck,
  Check,
  Clock,
  Calendar,
  AlertTriangle,
  Filter,
  Plus,
  Settings,
  Mail,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  Sparkles,
  UserCheck,
  Layers,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  getNotificationPreferencesAction,
  updateNotificationPreferenceAction,
  getDailyDigestAction,
} from '@/actions/notifications';
import {
  getTasksAction,
  createTaskAction,
  snoozeTaskAction,
  completeTaskAction,
} from '@/actions/tasks';
import {
  NotificationChannelEnum,
  TaskPriorityEnum,
  TaskStatusEnum,
} from '@hireflow/shared';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'tasks' | 'digest'>('all');
  const [isPending, startTransition] = useTransition();

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [groupedNotifications, setGroupedNotifications] = useState<any>({ today: [], yesterday: [], earlier: [] });
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Tasks state
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskFilter, setTaskFilter] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'completed'>('all');
  const [taskCounts, setTaskCounts] = useState({ overdue: 0, dueToday: 0 });
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [snoozeTaskId, setSnoozeTaskId] = useState<string | null>(null);
  const [customSnoozeDate, setCustomSnoozeDate] = useState('');

  // Daily digest state
  const [dailyDigest, setDailyDigest] = useState<any>(null);

  // Preferences drawer state
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [preferences, setPreferences] = useState<any[]>([
    { channel: 'IN_APP', enabled: true },
    { channel: 'EMAIL', enabled: true },
    { channel: 'WHATSAPP', enabled: false },
  ]);

  // Task creation form state
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: TaskPriorityEnum.MEDIUM,
    dueDate: '',
    relatedEntity: 'CANDIDATE',
    relatedEntityId: '',
    creatorNotes: '',
  });

  const loadNotificationsData = async () => {
    try {
      const res = await getNotificationsAction(
        activeTab === 'unread' ? 'unread' : 'all',
        selectedCategory !== 'ALL' ? selectedCategory : undefined
      );
      if (res.success) {
        setNotifications(res.items || []);
        setGroupedNotifications(res.grouped || { today: [], yesterday: [], earlier: [] });
        setUnreadCount(res.unreadCount || 0);
      }
    } catch {
      // ignore
    }
  };

  const loadTasksData = async () => {
    try {
      const res = await getTasksAction(taskFilter);
      if (res.success) {
        setTasks(res.items || []);
        setTaskCounts(res.counts || { overdue: 0, dueToday: 0 });
      }
    } catch {
      // ignore
    }
  };

  const loadDigestData = async () => {
    try {
      const res = await getDailyDigestAction();
      if (res.success) {
        setDailyDigest(res.digest);
      }
    } catch {
      // ignore
    }
  };

  const loadPreferencesData = async () => {
    try {
      const res = await getNotificationPreferencesAction();
      if (res.success) {
        setPreferences(res.preferences || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadPreferencesData();
  }, []);

  useEffect(() => {
    startTransition(() => {
      if (activeTab === 'all' || activeTab === 'unread') {
        loadNotificationsData();
      } else if (activeTab === 'tasks') {
        loadTasksData();
      } else if (activeTab === 'digest') {
        loadDigestData();
      }
    });
  }, [activeTab, selectedCategory, taskFilter]);

  const handleMarkRead = async (id: string) => {
    await markNotificationReadAction(id);
    loadNotificationsData();
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsReadAction();
    loadNotificationsData();
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;

    startTransition(async () => {
      // In dev mode, we pass a fallback user ID if none explicitly chosen
      const res = await createTaskAction({
        title: taskForm.title,
        description: taskForm.description || null,
        assignedToId: 'user-anika-rao', // Seeded Recruiter / Admin ID
        dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : null,
        priority: taskForm.priority,
        relatedEntity: taskForm.relatedEntity as any,
        relatedEntityId: taskForm.relatedEntityId || null,
        creatorNotes: taskForm.creatorNotes || null,
      });

      if (res.success) {
        setIsCreateTaskModalOpen(false);
        setTaskForm({
          title: '',
          description: '',
          priority: TaskPriorityEnum.MEDIUM,
          dueDate: '',
          relatedEntity: 'CANDIDATE',
          relatedEntityId: '',
          creatorNotes: '',
        });
        loadTasksData();
      }
    });
  };

  const handleCompleteTask = async (id: string) => {
    startTransition(async () => {
      await completeTaskAction(id);
      loadTasksData();
    });
  };

  const handleSnooze = async (id: string, presetHours?: number, customIso?: string) => {
    let snoozedUntilDate: Date;
    if (customIso) {
      snoozedUntilDate = new Date(customIso);
    } else {
      snoozedUntilDate = new Date(Date.now() + (presetHours || 24) * 3600 * 1000);
    }

    startTransition(async () => {
      await snoozeTaskAction(id, {
        snoozedUntil: snoozedUntilDate.toISOString(),
        notes: `Snoozed until ${snoozedUntilDate.toLocaleString('en-IN')}`,
      });
      setSnoozeTaskId(null);
      loadTasksData();
    });
  };

  const handleTogglePreference = async (channel: NotificationChannelEnum, enabled: boolean) => {
    await updateNotificationPreferenceAction(channel, enabled);
    loadPreferencesData();
  };

  const formatIST = (dateInput: string | Date) => {
    return new Date(dateInput).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-[#FDECEC] text-[#E5484D] border-[#E5484D]/30';
      case 'HIGH':
        return 'bg-[#FEF3DC] text-[#F59E0B] border-[#F59E0B]/30';
      case 'LOW':
        return 'bg-[#F6F7FB] text-[#6B7490] border-[#E6E8F0]';
      case 'MEDIUM':
      default:
        return 'bg-[#EEEBFB] text-[#5B49D6] border-[#5B49D6]/30';
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] p-6 sm:p-8">
      {/* Header (Figma Frame 35) */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#5B49D6] flex items-center justify-center text-white shadow-md shadow-[#5B49D6]/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1B2236]">Notification Centre & Tasks</h1>
              <p className="text-xs text-[#6B7490]">
                Unified recruitment alerts, follow-up task manager, and daily morning briefings
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              loadPreferencesData();
              setIsPreferencesOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-[#E6E8F0] text-[#1B2236] hover:bg-[#F6F7FB] transition-colors flex items-center gap-2 shadow-sm"
          >
            <Settings className="w-4 h-4 text-[#6B7490]" />
            <span>Channel Preferences</span>
          </button>

          {activeTab === 'tasks' && (
            <button
              onClick={() => setIsCreateTaskModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#5B49D6] text-white hover:bg-[#4C3CBD] transition-colors flex items-center gap-2 shadow-sm shadow-[#5B49D6]/20"
            >
              <Plus className="w-4 h-4" />
              <span>Create Follow-up Task</span>
            </button>
          )}

          {(activeTab === 'all' || activeTab === 'unread') && unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-[#5B49D6] text-[#5B49D6] hover:bg-[#EEEBFB] transition-colors flex items-center gap-2 shadow-sm"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All as Read ({unreadCount})</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Navigation Tabs (Frame 35) */}
        <div className="flex border-b border-[#E6E8F0] mb-6 gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'all'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>All Notifications</span>
          </button>

          <button
            onClick={() => setActiveTab('unread')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'unread'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#E5484D] text-white font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'tasks'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>My Tasks</span>
            {taskCounts.overdue > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#F59E0B] text-white font-bold">
                {taskCounts.overdue} overdue
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('digest')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'digest'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Daily Digest (08:30 IST)</span>
          </button>
        </div>

        {/* TAB 1 & 2: NOTIFICATIONS FEED */}
        {(activeTab === 'all' || activeTab === 'unread') && (
          <div className="space-y-6">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-[#6B7490] mr-2 flex items-center gap-1 font-medium">
                <Filter className="w-3.5 h-3.5" /> Category:
              </span>
              {['ALL', 'INTERVIEW', 'APPROVAL', 'TASK', 'STAGE_CHANGE', 'DIGEST', 'SYSTEM'].map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      selectedCategory === cat
                        ? 'bg-[#5B49D6] text-white shadow-sm'
                        : 'bg-white border border-[#E6E8F0] text-[#6B7490] hover:bg-[#F6F7FB]'
                    }`}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>

            {/* Notification Groups */}
            <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-sm divide-y divide-[#E6E8F0] overflow-hidden">
              {['today', 'yesterday', 'earlier'].map((groupKey) => {
                const groupItems = groupedNotifications[groupKey] || [];
                if (groupItems.length === 0) return null;

                const groupTitle =
                  groupKey === 'today'
                    ? 'Today'
                    : groupKey === 'yesterday'
                    ? 'Yesterday'
                    : 'Earlier';

                return (
                  <div key={groupKey} className="p-4 sm:p-6">
                    <h3 className="text-xs font-bold text-[#6B7490] uppercase tracking-wider mb-4">
                      {groupTitle} ({groupItems.length})
                    </h3>

                    <div className="space-y-3">
                      {groupItems.map((item: any) => (
                        <div
                          key={item.id}
                          className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                            !item.readAt
                              ? 'bg-[#EEEBFB]/25 border-[#5B49D6]/30 shadow-sm'
                              : 'bg-white border-[#E6E8F0] hover:border-[#CBD5E1]'
                          }`}
                        >
                          <div className="flex items-start gap-3.5">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                item.category === 'INTERVIEW'
                                  ? 'bg-[#E5F0FF] text-[#3B82F6]'
                                  : item.category === 'APPROVAL'
                                  ? 'bg-[#FEF3DC] text-[#F59E0B]'
                                  : item.category === 'TASK'
                                  ? 'bg-[#EEEBFB] text-[#5B49D6]'
                                  : 'bg-[#F6F7FB] text-[#6B7490]'
                              }`}
                            >
                              {item.category === 'INTERVIEW' ? (
                                <Calendar className="w-4 h-4" />
                              ) : item.category === 'APPROVAL' ? (
                                <CheckCheck className="w-4 h-4" />
                              ) : item.category === 'TASK' ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                <Bell className="w-4 h-4" />
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs sm:text-sm text-[#1B2236]">
                                  {item.title}
                                </span>
                                {!item.readAt && (
                                  <span className="w-2 h-2 rounded-full bg-[#5B49D6]" />
                                )}
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getPriorityColor(
                                    item.priority || 'NORMAL'
                                  )}`}
                                >
                                  {item.priority || 'NORMAL'}
                                </span>
                              </div>
                              <p className="text-xs text-[#6B7490] mt-1 leading-relaxed">
                                {item.message}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-[11px] text-[#6B7490]">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatIST(item.createdAt)}
                                </span>
                                {item.category && (
                                  <span className="bg-[#F6F7FB] px-2 py-0.5 rounded text-[#1B2236] font-medium border border-[#E6E8F0]">
                                    {item.category}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {!item.readAt && (
                              <button
                                onClick={() => handleMarkRead(item.id)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-[#E6E8F0] text-[#1B2236] hover:bg-[#F6F7FB] transition-colors"
                              >
                                Mark Read
                              </button>
                            )}
                            {item.linkUrl && (
                              <a
                                href={item.linkUrl}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#5B49D6] text-white hover:bg-[#4C3CBD] transition-colors flex items-center gap-1.5"
                              >
                                <span>Open</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {notifications.length === 0 && (
                <div className="py-16 text-center text-xs text-[#6B7490]">
                  <Bell className="w-8 h-8 text-[#6B7490]/40 mx-auto mb-2" />
                  <p className="font-semibold text-sm text-[#1B2236]">No notifications found</p>
                  <p className="mt-1">You are all caught up with candidate updates and alerts.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: MY TASKS (Frame 35) */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            {/* Task Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-5 border border-[#E6E8F0] shadow-sm">
                <span className="text-xs font-semibold text-[#6B7490]">Total Tasks</span>
                <p className="text-2xl font-bold text-[#1B2236] mt-1">{tasks.length}</p>
                <span className="text-[11px] text-[#6B7490]">Active recruitment actions</span>
              </div>
              <div className="bg-white rounded-xl p-5 border border-[#E6E8F0] shadow-sm">
                <span className="text-xs font-semibold text-[#6B7490]">Due Today</span>
                <p className="text-2xl font-bold text-[#5B49D6] mt-1">{taskCounts.dueToday}</p>
                <span className="text-[11px] text-[#6B7490]">Require completion by 23:59 IST</span>
              </div>
              <div className="bg-white rounded-xl p-5 border border-[#E6E8F0] shadow-sm">
                <span className="text-xs font-semibold text-[#E5484D]">Overdue Follow-ups</span>
                <p className="text-2xl font-bold text-[#E5484D] mt-1">{taskCounts.overdue}</p>
                <span className="text-[11px] text-[#E5484D]">Urgent recruiter actions required</span>
              </div>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-2">
                {(['all', 'today', 'overdue', 'upcoming', 'completed'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setTaskFilter(mode)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                      taskFilter === mode
                        ? 'bg-[#5B49D6] text-white shadow-sm'
                        : 'bg-white border border-[#E6E8F0] text-[#6B7490] hover:bg-[#F6F7FB]'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Tasks Table */}
            <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E6E8F0] bg-[#F6F7FB] text-[#6B7490] font-semibold">
                      <th className="py-3.5 px-4">Task Title & Description</th>
                      <th className="py-3.5 px-4">Entity</th>
                      <th className="py-3.5 px-4">Due Date (IST)</th>
                      <th className="py-3.5 px-4">Priority</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E8F0]">
                    {tasks.map((task) => (
                      <tr key={task.id} className="hover:bg-[#F6F7FB]/50 transition-colors">
                        <td className="py-4 px-4 max-w-xs">
                          <p className="font-semibold text-sm text-[#1B2236]">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-[#6B7490] mt-0.5 line-clamp-1">
                              {task.description}
                            </p>
                          )}
                          {task.creatorNotes && (
                            <span className="text-[10px] text-[#5B49D6] bg-[#EEEBFB] px-1.5 py-0.5 rounded mt-1 inline-block">
                              Notes: {task.creatorNotes}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-2 py-1 rounded bg-[#F6F7FB] border border-[#E6E8F0] text-[#1B2236] font-medium text-[11px]">
                            {task.relatedEntity || 'GENERAL'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {task.dueDate ? (
                            <div className="flex items-center gap-1.5 text-[#1B2236]">
                              <Clock className="w-3.5 h-3.5 text-[#6B7490]" />
                              <span>{formatIST(task.dueDate)}</span>
                            </div>
                          ) : (
                            <span className="text-[#6B7490]">No due date</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${getPriorityColor(
                              task.priority
                            )}`}
                          >
                            {task.priority}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              task.status === 'COMPLETED'
                                ? 'bg-[#E3F6EC] text-[#12B76A]'
                                : 'bg-[#FEF3DC] text-[#F59E0B]'
                            }`}
                          >
                            {task.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {task.status !== 'COMPLETED' && (
                              <>
                                <button
                                  onClick={() => handleCompleteTask(task.id)}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#E3F6EC] text-[#12B76A] hover:bg-[#12B76A] hover:text-white transition-colors flex items-center gap-1"
                                  title="Mark as completed"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Done</span>
                                </button>
                                <button
                                  onClick={() =>
                                    setSnoozeTaskId(snoozeTaskId === task.id ? null : task.id)
                                  }
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-[#E6E8F0] text-[#6B7490] hover:bg-[#F6F7FB] transition-colors"
                                >
                                  Snooze
                                </button>
                              </>
                            )}
                          </div>

                          {/* Inline Snooze Popover */}
                          {snoozeTaskId === task.id && (
                            <div className="absolute right-12 mt-2 w-56 bg-white rounded-xl shadow-xl border border-[#E6E8F0] p-3 z-30 text-left">
                              <span className="text-[11px] font-bold text-[#1B2236] block mb-2">
                                Snooze reminder:
                              </span>
                              <div className="space-y-1">
                                <button
                                  onClick={() => handleSnooze(task.id, 1)}
                                  className="w-full text-left px-2 py-1 text-xs text-[#1B2236] hover:bg-[#F6F7FB] rounded"
                                >
                                  1 Hour later
                                </button>
                                <button
                                  onClick={() => handleSnooze(task.id, 24)}
                                  className="w-full text-left px-2 py-1 text-xs text-[#1B2236] hover:bg-[#F6F7FB] rounded"
                                >
                                  Tomorrow 9:00 AM
                                </button>
                                <button
                                  onClick={() => handleSnooze(task.id, 48)}
                                  className="w-full text-left px-2 py-1 text-xs text-[#1B2236] hover:bg-[#F6F7FB] rounded"
                                >
                                  2 Days later
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}

                    {tasks.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-xs text-[#6B7490]">
                          <CheckCircle2 className="w-8 h-8 text-[#12B76A]/40 mx-auto mb-2" />
                          <p className="font-semibold text-[#1B2236]">No tasks in this view</p>
                          <p className="mt-1">All action items are completed or none scheduled.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DAILY DIGEST (08:30 IST) */}
        {activeTab === 'digest' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-[#E6E8F0] shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0]">
                <div>
                  <h3 className="text-base font-bold text-[#1B2236]">
                    Morning Briefing Digest (08:30 Asia/Kolkata)
                  </h3>
                  <p className="text-xs text-[#6B7490] mt-0.5">
                    Automated role-scoped summary of today's interviews, pending reviews, and due tasks
                  </p>
                </div>
                <span className="px-3 py-1 bg-[#E3F6EC] text-[#12B76A] rounded-full text-xs font-bold">
                  Scheduled Mon–Fri
                </span>
              </div>

              {dailyDigest ? (
                <div className="mt-6 space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-[#F6F7FB] border border-[#E6E8F0]">
                      <span className="text-xs text-[#6B7490]">Interviews Today</span>
                      <p className="text-xl font-bold text-[#1B2236] mt-1">
                        {dailyDigest.content?.todaysInterviewsCount || 0}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#F6F7FB] border border-[#E6E8F0]">
                      <span className="text-xs text-[#6B7490]">Tasks Due Today</span>
                      <p className="text-xl font-bold text-[#5B49D6] mt-1">
                        {dailyDigest.content?.tasksDueTodayCount || 0}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#F6F7FB] border border-[#E6E8F0]">
                      <span className="text-xs text-[#6B7490]">Overdue Tasks</span>
                      <p className="text-xl font-bold text-[#E5484D] mt-1">
                        {dailyDigest.content?.overdueTasksCount || 0}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#F6F7FB] border border-[#E6E8F0]">
                      <span className="text-xs text-[#6B7490]">Pending Approvals</span>
                      <p className="text-xl font-bold text-[#F59E0B] mt-1">
                        {dailyDigest.content?.pendingApprovalsCount || 0}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-[#1B2236] uppercase tracking-wider mb-3">
                      Briefing Action Items ({dailyDigest.content?.items?.length || 0})
                    </h4>
                    <div className="space-y-2">
                      {(dailyDigest.content?.items || []).map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-lg border border-[#E6E8F0] hover:bg-[#F6F7FB] flex items-center justify-between transition-colors"
                        >
                          <div>
                            <span className="font-semibold text-xs text-[#1B2236]">
                              {item.title}
                            </span>
                            <p className="text-[11px] text-[#6B7490] mt-0.5">{item.details}</p>
                          </div>
                          {item.linkUrl && (
                            <a
                              href={item.linkUrl}
                              className="text-xs text-[#5B49D6] font-semibold hover:underline flex items-center gap-1"
                            >
                              <span>View</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-[#6B7490]">
                  <Sparkles className="w-8 h-8 text-[#5B49D6]/40 mx-auto mb-2" />
                  <p className="font-semibold text-[#1B2236]">Digest will generate at 08:30 IST</p>
                  <p className="mt-1">
                    Your daily digest will be delivered automatically via In-App and Email.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CREATE TASK MODAL */}
      {isCreateTaskModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E6E8F0] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0]">
              <h3 className="font-bold text-base text-[#1B2236]">Create Follow-up Task</h3>
              <button
                onClick={() => setIsCreateTaskModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#F6F7FB] text-[#6B7490]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="e.g. Follow up on technical round feedback"
                  className="w-full px-3.5 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-none focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Additional context or notes..."
                  className="w-full px-3.5 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-none focus:border-[#5B49D6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                    Priority
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, priority: e.target.value as TaskPriorityEnum })
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-none focus:border-[#5B49D6]"
                  >
                    <option value={TaskPriorityEnum.LOW}>LOW</option>
                    <option value={TaskPriorityEnum.MEDIUM}>MEDIUM</option>
                    <option value={TaskPriorityEnum.HIGH}>HIGH</option>
                    <option value={TaskPriorityEnum.URGENT}>URGENT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                    Related Entity
                  </label>
                  <select
                    value={taskForm.relatedEntity}
                    onChange={(e) => setTaskForm({ ...taskForm, relatedEntity: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-none focus:border-[#5B49D6]"
                  >
                    <option value="CANDIDATE">CANDIDATE</option>
                    <option value="JOB">JOB</option>
                    <option value="CLIENT">CLIENT</option>
                    <option value="INTERVIEW">INTERVIEW</option>
                    <option value="SUBMISSION">SUBMISSION</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Due Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-none focus:border-[#5B49D6]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E6E8F0]">
                <button
                  type="button"
                  onClick={() => setIsCreateTaskModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-[#E6E8F0] text-[#6B7490] hover:bg-[#F6F7FB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#5B49D6] text-white hover:bg-[#4C3CBD] shadow-sm disabled:opacity-50"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANNEL PREFERENCES DRAWER */}
      {isPreferencesOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0]">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#5B49D6]" />
                  <h3 className="font-bold text-base text-[#1B2236]">Notification Preferences</h3>
                </div>
                <button
                  onClick={() => setIsPreferencesOpen(false)}
                  className="p-1 rounded-lg hover:bg-[#F6F7FB] text-[#6B7490]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6 space-y-5">
                <p className="text-xs text-[#6B7490]">
                  Configure which communication channels you receive recruitment alerts and task reminders through:
                </p>

                {preferences.map((pref) => (
                  <div
                    key={pref.channel}
                    className="p-4 rounded-xl border border-[#E6E8F0] bg-[#F6F7FB]/50 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white border border-[#E6E8F0] flex items-center justify-center text-[#5B49D6]">
                        {pref.channel === 'EMAIL' ? (
                          <Mail className="w-4 h-4" />
                        ) : pref.channel === 'WHATSAPP' ? (
                          <MessageSquare className="w-4 h-4" />
                        ) : (
                          <Bell className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-[#1B2236]">{pref.channel}</span>
                        <p className="text-[11px] text-[#6B7490]">
                          {pref.channel === 'IN_APP'
                            ? 'Instant notifications within ATS'
                            : pref.channel === 'EMAIL'
                            ? 'Email briefings & task alerts'
                            : 'WhatsApp updates (opt-in only)'}
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pref.enabled}
                        disabled={pref.channel === 'IN_APP'} // Mandatory in-app alerts cannot be disabled
                        onChange={(e) =>
                          handleTogglePreference(pref.channel, e.target.checked)
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[#E6E8F0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5B49D6]"></div>
                    </label>
                  </div>
                ))}

                <div className="p-3.5 bg-[#EEEBFB]/50 rounded-xl border border-[#5B49D6]/20 text-[11px] text-[#5B49D6] leading-relaxed">
                  💡 <strong>Security Note:</strong> Mandatory organization security alerts (such as password changes and two-step verification) are always delivered and cannot be disabled.
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsPreferencesOpen(false)}
              className="w-full py-2.5 text-xs font-semibold rounded-lg bg-[#5B49D6] text-white hover:bg-[#4C3CBD] shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
