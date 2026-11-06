'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
import { X, CheckSquare, Loader2 } from 'lucide-react';
import { createFollowUpTaskAction } from '@/actions/interviews';

interface FollowUpTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  interviewId: string;
  candidateName: string;
  users: Array<{ id: string; name: string; email: string }>;
  onCreated: () => void;
}

export const FollowUpTaskModal: React.FC<FollowUpTaskModalProps> = ({
  isOpen,
  onClose,
  interviewId,
  candidateName,
  users,
  onCreated,
}) => {
  const [title, setTitle] = useState<string>(`Follow up with ${candidateName} after interview`);
  const [description, setDescription] = useState<string>('');
  const [assignedToId, setAssignedToId] = useState<string>(users[0]?.id || '');
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignedToId) {
      setError('Please assign the task to a team member');
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await createFollowUpTaskAction(interviewId, {
      title: title.trim(),
      description: description.trim() || undefined,
      assignedToId,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      priority,
    });

    if (res.success) {
      onCreated();
      onClose();
    } else {
      setError(res.error || 'Failed to create task');
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1E2A4A]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E8F0] bg-[#F6F7FB]/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1B2236]">Create Follow-up Task</h2>
              <p className="text-xs text-[#6B7490]">{candidateName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#6B7490] hover:text-[#1B2236] hover:bg-[#E6E8F0]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-[#FFF0F0] border border-[#E5484D]/30 rounded-xl text-xs text-[#E5484D]">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#1B2236] mb-1">Task Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs rounded-xl border border-[#E6E8F0] p-2.5 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1B2236] mb-1">Assignee *</label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className="w-full text-xs rounded-xl border border-[#E6E8F0] p-2.5 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none"
                required
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1B2236] mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full text-xs rounded-xl border border-[#E6E8F0] p-2.5 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1B2236] mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full text-xs rounded-xl border border-[#E6E8F0] p-2.5 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1B2236] mb-1">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Action items, notes for assignee..."
              rows={2}
              className="w-full text-xs rounded-xl border border-[#E6E8F0] p-2.5 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E6E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#6B7490] hover:text-[#1B2236]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-[#5B49D6] text-white rounded-xl text-xs font-bold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                'Create Task'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
