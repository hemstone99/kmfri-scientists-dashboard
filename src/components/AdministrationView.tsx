import React, { useState } from 'react';
import { BootstrapData, UserRecord } from '../types.ts';
import { canManageUsers, generateCSV } from '../lib/domain.ts';
import {
  Shield,
  Users,
  Building2,
  FileSpreadsheet,
  History,
  Settings,
  CheckSquare,
  RefreshCw,
  UserPlus,
  Download,
  Printer,
  Send,
} from 'lucide-react';

interface AdministrationViewProps {
  data: BootstrapData;
  onRefresh: () => Promise<void>;
  apiFetch: <T = any>(path: string, options?: RequestInit) => Promise<T>;
  onOpenNewUser: () => void;
  onEditUser: (user: UserRecord) => void;
}

export const AdministrationView: React.FC<AdministrationViewProps> = ({
  data,
  onRefresh,
  apiFetch,
  onOpenNewUser,
  onEditUser,
}) => {
  const [subTab, setSubTab] = useState<
    'USERS' | 'RBAC' | 'DIRECTORATES' | 'AUDIT' | 'SETTINGS' | 'EXPORTS'
  >('USERS');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  // Directorate / Research Area forms
  const [dirForm, setDirForm] = useState({
    name: '',
    code: '',
    description: '',
    headUserId: '',
  });
  const [areaForm, setAreaForm] = useState({
    name: '',
    description: '',
    directorateId: data.directorates[0]?.id || '',
  });

  // Broadcast announcement form
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
  });

  // System settings form
  const instProfile =
    data.systemSettings.find((s) => s.settingKey === 'institution_profile')
      ?.settingValue || {
      name: 'Kenya Marine and Fisheries Research Institute',
      acronym: 'KMFRI',
      headquarters: 'Mombasa, Kenya (English Point)',
      ministry: 'Ministry of Mining, Blue Economy and Maritime Affairs',
      defaultCurrency: 'KES',
      fiscalYear: '2026/2027',
    };

  const [settingsState, setSettingsState] = useState(instProfile);

  const isAdmin = canManageUsers(
    data.currentUser.roleName,
    data.currentUser.permissions
  );

  const handleBulkUserStatus = async (status: string, actionLabel: string) => {
    if (selectedUserIds.length === 0) return;
    setBusy(true);
    setFeedback(null);
    try {
      for (const uid of selectedUserIds) {
        await apiFetch(`/api/users/${uid}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status, actionLabel }),
        });
      }
      setSelectedUserIds([]);
      await onRefresh();
      setFeedback(`Updated ${selectedUserIds.length} researcher account(s) to ${status}.`);
    } catch (err: any) {
      setFeedback(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleRolePermission = async (
    roleId: string,
    permId: string,
    currentlyHas: boolean
  ) => {
    setBusy(true);
    try {
      const currentPermIds = data.rolePermissions
        .filter((rp) => rp.roleId === roleId)
        .map((rp) => rp.permissionId);
      const nextPermIds = currentlyHas
        ? currentPermIds.filter((id) => id !== permId)
        : [...currentPermIds, permId];
      await apiFetch(`/api/roles/${roleId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissionIds: nextPermIds }),
      });
      await onRefresh();
    } catch (err: any) {
      setFeedback(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateDirectorate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/api/directorates', {
        method: 'POST',
        body: JSON.stringify(dirForm),
      });
      setDirForm({ name: '', code: '', description: '', headUserId: '' });
      await onRefresh();
      setFeedback('Directorate created.');
    } catch (err: any) {
      setFeedback(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/api/research-areas', {
        method: 'POST',
        body: JSON.stringify(areaForm),
      });
      setAreaForm({
        name: '',
        description: '',
        directorateId: data.directorates[0]?.id || '',
      });
      await onRefresh();
      setFeedback('Research area created.');
    } catch (err: any) {
      setFeedback(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          settingKey: 'institution_profile',
          settingValue: settingsState,
        }),
      });
      await onRefresh();
      setFeedback('Institutional system settings saved.');
    } catch (err: any) {
      setFeedback(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) return;
    setBusy(true);
    try {
      const res = await apiFetch('/api/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify(broadcastForm),
      });
      setBroadcastForm({ title: '', message: '' });
      await onRefresh();
      setFeedback(`Broadcast sent to ${res.recipientCount} researcher accounts.`);
    } catch (err: any) {
      setFeedback(err.message);
    } finally {
      setBusy(false);
    }
  };

  const downloadCsvFile = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredUsers = data.users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.staffNumber || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="text-xs text-slate-500">
            Institutional Governance, RBAC Matrix, Audit Trail & Data Export
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
            KMFRI System Administration
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {[
            { id: 'USERS', label: 'User & Account Control' },
            { id: 'RBAC', label: 'Roles & Permissions' },
            { id: 'DIRECTORATES', label: 'Directorates & Areas' },
            { id: 'AUDIT', label: 'Audit Logs' },
            { id: 'EXPORTS', label: 'Exports & Announcements' },
            { id: 'SETTINGS', label: 'System Settings' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                subTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 text-xs text-sky-900 dark:text-sky-200 flex justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)}>
            ×
          </button>
        </div>
      )}

      {/* TAB 1: USERS & BULK ACCOUNT CONTROL */}
      {subTab === 'USERS' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by scientist name, staff number, or email..."
              className="w-full md:w-80 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                {selectedUserIds.length > 0 && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleBulkUserStatus('Active', 'REACTIVATE_ACCOUNT')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium"
                    >
                      Reactivate ({selectedUserIds.length})
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleBulkUserStatus('Inactive', 'DEACTIVATE_ACCOUNT')}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium"
                    >
                      Deactivate ({selectedUserIds.length})
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        handleBulkUserStatus(
                          'PasswordResetRequired',
                          'RESET_ACCOUNT_CREDENTIALS'
                        )
                      }
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
                    >
                      Reset Account ({selectedUserIds.length})
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={onOpenNewUser}
                  className="px-3.5 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Register Researcher Account</span>
                </button>
              </div>
            )}
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-500">
                  <th className="py-2.5 px-4 w-8">
                    <input
                      type="checkbox"
                      checked={
                        filteredUsers.length > 0 &&
                        selectedUserIds.length === filteredUsers.length
                      }
                      onChange={(e) =>
                        setSelectedUserIds(
                          e.target.checked ? filteredUsers.map((u) => u.id) : []
                        )
                      }
                    />
                  </th>
                  <th className="py-2.5 px-4">Staff No.</th>
                  <th className="py-2.5 px-4">Full Name & Email</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Directorate</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {filteredUsers.map((u) => {
                  const role = data.roles.find((r) => r.id === u.roleId);
                  const dir = data.directorates.find((d) => d.id === u.directorateId);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-4">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u.id)}
                          onChange={(e) =>
                            setSelectedUserIds((prev) =>
                              e.target.checked
                                ? [...prev, u.id]
                                : prev.filter((id) => id !== u.id)
                            )
                          }
                        />
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-sky-700 dark:text-sky-400">
                        {u.staffNumber || 'N/A'}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {u.fullName}
                        </div>
                        <div className="text-slate-500">{u.email}</div>
                      </td>
                      <td className="py-2.5 px-4 font-medium">
                        {role?.name || 'SCIENTIST/RESEARCHER'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                        {dir?.code || 'OCS'} — {dir?.name || 'Oceans & Coastal'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`font-semibold ${
                            u.status === 'Active'
                              ? 'text-emerald-600'
                              : u.status === 'Inactive'
                                ? 'text-rose-600'
                                : 'text-amber-600'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-2">
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => onEditUser(u)}
                              className="text-sky-700 dark:text-sky-400 hover:underline font-medium"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const next =
                                  u.status === 'Active' ? 'Inactive' : 'Active';
                                await apiFetch(`/api/users/${u.id}/status`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({
                                    status: next,
                                    actionLabel:
                                      next === 'Active'
                                        ? 'REACTIVATE_ACCOUNT'
                                        : 'DEACTIVATE_ACCOUNT',
                                  }),
                                });
                                await onRefresh();
                              }}
                              className="text-slate-600 dark:text-slate-400 hover:underline"
                            >
                              {u.status === 'Active' ? 'Deactivate' : 'Reactivate'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/users/${u.id}/status`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({
                                    status: 'PasswordResetRequired',
                                    actionLabel: 'RESET_RESEARCHER_ACCOUNT',
                                  }),
                                });
                                await onRefresh();
                                setFeedback(`Reset initiated for ${u.fullName}.`);
                              }}
                              className="text-amber-700 dark:text-amber-400 hover:underline"
                            >
                              Reset
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: RBAC ROLES & PERMISSIONS MATRIX */}
      {subTab === 'RBAC' && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500">
                <th className="py-3 px-4">Permission Key</th>
                {data.roles.map((r) => (
                  <th key={r.id} className="py-3 px-3 text-center">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {data.permissions.map((perm) => (
                <tr key={perm.id}>
                  <td className="py-2.5 px-4">
                    <div className="font-mono font-semibold text-slate-900 dark:text-white">
                      {perm.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {perm.description}
                    </div>
                  </td>
                  {data.roles.map((role) => {
                    const hasIt = data.rolePermissions.some(
                      (rp) => rp.roleId === role.id && rp.permissionId === perm.id
                    );
                    return (
                      <td key={role.id} className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          disabled={
                            busy ||
                            role.name === 'SUPER ADMIN' ||
                            !isAdmin
                          }
                          checked={role.name === 'SUPER ADMIN' ? true : hasIt}
                          onChange={() =>
                            handleToggleRolePermission(role.id, perm.id, hasIt)
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: DIRECTORATES & RESEARCH AREAS */}
      {subTab === 'DIRECTORATES' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              KMFRI Research Directorates ({data.directorates.length})
            </h3>
            {isAdmin && (
              <form
                onSubmit={handleCreateDirectorate}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
              >
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Code (e.g. MAR)"
                    value={dirForm.code}
                    onChange={(e) => setDirForm({ ...dirForm, code: e.target.value })}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Directorate Name"
                    value={dirForm.name}
                    onChange={(e) => setDirForm({ ...dirForm, name: e.target.value })}
                    className="col-span-2 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg bg-sky-700 text-white text-xs font-medium"
                >
                  + Add Directorate
                </button>
              </form>
            )}
            <div className="space-y-2.5">
              {data.directorates.map((d) => {
                const head = data.users.find((u) => u.id === d.headUserId);
                return (
                  <div
                    key={d.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono font-bold text-sky-700 dark:text-sky-400">
                        {d.code}
                      </span>
                      <span className="text-xs text-slate-500">
                        Head: {head?.fullName || 'Not assigned'}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                      {d.name}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{d.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Thematic Research Areas ({data.researchAreas.length})
            </h3>
            {isAdmin && (
              <form
                onSubmit={handleCreateArea}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={areaForm.directorateId}
                    onChange={(e) =>
                      setAreaForm({ ...areaForm, directorateId: e.target.value })
                    }
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {data.directorates.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Research Area Title"
                    value={areaForm.name}
                    onChange={(e) =>
                      setAreaForm({ ...areaForm, name: e.target.value })
                    }
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-medium"
                >
                  + Add Research Area
                </button>
              </form>
            )}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {data.researchAreas.map((ra) => {
                const dir = data.directorates.find(
                  (d) => d.id === ra.directorateId
                );
                return (
                  <div
                    key={ra.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                  >
                    <div className="font-mono text-teal-700 dark:text-teal-400">
                      {dir?.code} Directorate
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {ra.name}
                    </div>
                    <div className="text-slate-500 mt-0.5">{ra.description}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {subTab === 'AUDIT' && (
        <div className="space-y-4">
          <input
            type="text"
            value={auditSearch}
            onChange={(e) => setAuditSearch(e.target.value)}
            placeholder="Filter audit trail by action, entity type, or user..."
            className="w-full md:w-80 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Actor</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Entity</th>
                  <th className="py-2.5 px-4">Payload Diff (JSONB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.auditLogs
                  .filter((log) => {
                    if (!auditSearch.trim()) return true;
                    const q = auditSearch.toLowerCase();
                    return (
                      log.action.toLowerCase().includes(q) ||
                      log.entityType.toLowerCase().includes(q)
                    );
                  })
                  .map((log) => {
                    const actor = data.users.find((u) => u.id === log.userId);
                    return (
                      <tr key={log.id}>
                        <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                          {actor?.fullName || 'System'}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-semibold text-sky-700 dark:text-sky-400">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-4 font-mono">{log.entityType}</td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 max-w-md truncate">
                          {JSON.stringify(log.newValues || log.oldValues || {})}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: EXPORTS & ANNOUNCEMENTS */}
      {subTab === 'EXPORTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Institutional Data Export Center (CSV, Excel-Compatible & Print/PDF)
            </h3>
            <p className="text-xs text-slate-500">
              Export live PostgreSQL datasets for ministerial reporting, donor audits, or GIS analysis.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  const csv = generateCSV(
                    ['Project Code', 'Title', 'Status', 'Priority', 'Start Date', 'End Date', 'Budget', 'Currency', 'Progress %'],
                    data.projects.map((p) => [
                      p.projectCode,
                      p.title,
                      p.status,
                      p.priority,
                      p.startDate,
                      p.endDate,
                      p.budget,
                      p.currency,
                      p.progressPercent,
                    ])
                  );
                  downloadCsvFile('kmfri_projects_registry.csv', csv);
                }}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 text-left flex items-center justify-between text-xs font-medium"
              >
                <span>Export Projects Registry (CSV/Excel)</span>
                <Download className="w-4 h-4 text-sky-700" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const csv = generateCSV(
                    ['Staff Number', 'Full Name', 'Email', 'Position', 'Status'],
                    data.users.map((u) => [
                      u.staffNumber,
                      u.fullName,
                      u.email,
                      u.position,
                      u.status,
                    ])
                  );
                  downloadCsvFile('kmfri_scientists_directory.csv', csv);
                }}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 text-left flex items-center justify-between text-xs font-medium"
              >
                <span>Export Scientists Directory (CSV/Excel)</span>
                <Download className="w-4 h-4 text-sky-700" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const csv = generateCSV(
                    ['Grant Number', 'Amount', 'Currency', 'Allocated', 'Spent', 'Award Date', 'Status'],
                    data.funding.map((f) => [
                      f.grantNumber,
                      f.amount,
                      f.currency,
                      f.allocatedAmount,
                      f.spentAmount,
                      f.awardDate,
                      f.status,
                    ])
                  );
                  downloadCsvFile('kmfri_grants_funding.csv', csv);
                }}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 text-left flex items-center justify-between text-xs font-medium"
              >
                <span>Export Grants & Funding Ledger (CSV)</span>
                <Download className="w-4 h-4 text-sky-700" />
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-teal-500 text-left flex items-center justify-between text-xs font-medium"
              >
                <span>Print / Save Executive Report (PDF)</span>
                <Printer className="w-4 h-4 text-teal-700" />
              </button>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Broadcast Institutional Announcement
            </h3>
            <form onSubmit={handleBroadcast} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Announcement Title (e.g. FY 2026/2027 Q2 Report Deadline Notice)"
                value={broadcastForm.title}
                onChange={(e) =>
                  setBroadcastForm({ ...broadcastForm, title: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <textarea
                rows={3}
                required
                placeholder="Enter official announcement message for all KMFRI researchers..."
                value={broadcastForm.message}
                onChange={(e) =>
                  setBroadcastForm({ ...broadcastForm, message: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Notification to All Scientists</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 6: SYSTEM SETTINGS */}
      {subTab === 'SETTINGS' && (
        <form
          onSubmit={handleSaveSettings}
          className="max-w-2xl p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4"
        >
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Institutional Configuration (`system_settings` JSONB)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                Institution Name
              </label>
              <input
                type="text"
                value={settingsState.name || ''}
                onChange={(e) =>
                  setSettingsState({ ...settingsState, name: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                Headquarters Station
              </label>
              <input
                type="text"
                value={settingsState.headquarters || ''}
                onChange={(e) =>
                  setSettingsState({
                    ...settingsState,
                    headquarters: e.target.value,
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                Parent Ministry
              </label>
              <input
                type="text"
                value={settingsState.ministry || ''}
                onChange={(e) =>
                  setSettingsState({ ...settingsState, ministry: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                Current Fiscal Year
              </label>
              <input
                type="text"
                value={settingsState.fiscalYear || ''}
                onChange={(e) =>
                  setSettingsState({
                    ...settingsState,
                    fiscalYear: e.target.value,
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy || !isAdmin}
            className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium disabled:opacity-50"
          >
            Save System Settings
          </button>
        </form>
      )}
    </div>
  );
};
