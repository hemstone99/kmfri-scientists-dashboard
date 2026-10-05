import React, { useMemo, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Megaphone,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { NotificationItem, PermissionCode } from '../types/kmfri.ts';

export function NotificationsModule() {
  const { db, user, apiFetch, refreshData, hasPermission, showToast } = useAuth();

  const [catFilter, setCatFilter] = useState('all');
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<NotificationItem['category']>('Announcement');

  const canBroadcast = hasPermission(PermissionCode.SETTINGS_MANAGE);

  const myNotifications = useMemo(() => {
    if (!db) return [];
    return db.notifications.filter((n) => {
      if (n.recipient_user_id && n.recipient_user_id !== user?.id) return false;
      if (catFilter !== 'all' && n.category !== catFilter) return false;
      return true;
    });
  }, [db, user?.id, catFilter]);

  if (!db) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mx-auto" />
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Loading Notifications...
          </div>
        </div>
      </div>
    );
  }

  const handleMarkAllRead = async () => {
    await apiFetch('/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ mark_all: true }),
    });
    await refreshData();
    showToast('Marked all notifications as read', 'info');
  };

  const handleMarkSingleRead = async (id: string) => {
    await apiFetch('/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ notification_id: id }),
    });
    await refreshData();
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) return;
    try {
      await apiFetch('/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify({ title, message, category }),
      });
      await refreshData();
      setBroadcastModalOpen(false);
      setTitle('');
      setMessage('');
      showToast('Broadcast institutional announcement');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Notifications, Alerts &amp; Institutional Announcements
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated alerts for account provisioning, project assignments, approvals, report deadlines, reviews, milestones, and grants
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
          >
            <CheckCheck className="w-4 h-4 text-teal-600" />
            <span>Mark All Read</span>
          </button>

          {canBroadcast && (
            <button
              type="button"
              onClick={() => setBroadcastModalOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Megaphone className="w-4 h-4" />
              <span>Post Announcement</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            'all',
            'Account',
            'Assignment',
            'Project Approval',
            'Report Deadline',
            'Report Submission',
            'Report Review',
            'Milestone',
            'Funding',
            'Announcement',
          ] as const
        ).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCatFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              catFilter === cat
                ? 'bg-[#0A2540] dark:bg-sky-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {cat === 'all' ? 'All Categories' : cat}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {myNotifications.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <Bell className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              No Notifications in This View
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Operational events such as project approvals, team assignments, report submissions, and grant awards automatically generate notifications here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {myNotifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 flex items-start justify-between gap-4 ${
                  !n.is_read ? 'bg-sky-50/50 dark:bg-sky-950/20' : ''
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-sky-700 dark:text-sky-400">
                    <span>[{n.category}]</span>
                    <span>·</span>
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                    {!n.is_read && (
                      <>
                        <span>·</span>
                        <span className="text-teal-600 font-semibold">● UNREAD</span>
                      </>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                    {n.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{n.message}</p>
                </div>
                {!n.is_read && (
                  <button
                    type="button"
                    onClick={() => handleMarkSingleRead(n.id)}
                    className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-medium shrink-0"
                  >
                    Mark Read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Broadcast Modal */}
      {broadcastModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Broadcast Institutional Announcement
              </h3>
              <button type="button" onClick={() => setBroadcastModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleBroadcast} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="Announcement">Announcement</option>
                  <option value="Report Deadline">Report Deadline</option>
                  <option value="Funding">Funding Call</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="FY 2026/27 Quarterly Technical Reports Submission Window"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Message *</label>
                <textarea
                  rows={3}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBroadcastModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white font-semibold"
                >
                  Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
