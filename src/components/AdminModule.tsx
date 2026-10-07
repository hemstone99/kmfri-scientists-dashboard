import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  Download,
  Filter,
  KeyRound,
  Plus,
  Power,
  RefreshCw,
  Search,
  Shield,
  Sliders,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { AuditLog, PermissionCode, RoleCode, UserProfile } from '../types/kmfri.ts';
import { exportToCSV, exportToExcel } from '../utils/exportUtils.ts';
import { UserAvatar } from './UserAvatar.tsx';

type AdminTab =
  | 'audit_logs'
  | 'users'
  | 'rbac'
  | 'directorates'
  | 'research_areas'
  | 'settings'
  | 'exports_sql';

type AuditCategoryFilter = 'all' | 'create' | 'update' | 'delete' | 'status' | 'security';

function classifyAuditAction(action: string): {
  category: AuditCategoryFilter;
  label: string;
  badgeClass: string;
} {
  const upper = action.toUpperCase();
  if (
    upper.includes('CREATED') ||
    upper.includes('UPLOADED') ||
    upper.includes('LOGGED') ||
    upper.includes('GRANTED') ||
    upper.includes('SEED')
  ) {
    return {
      category: 'create',
      label: 'CREATE',
      badgeClass:
        'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    };
  }
  if (upper.includes('DELETED') || upper.includes('REVOKED')) {
    return {
      category: 'delete',
      label: 'DELETE',
      badgeClass:
        'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    };
  }
  if (
    upper.includes('STATUS') ||
    upper.includes('WORKFLOW') ||
    upper.includes('APPROVE') ||
    upper.includes('REJECT') ||
    upper.includes('ARCHIVE') ||
    upper.includes('REACTIVATED') ||
    upper.includes('DEACTIVATED')
  ) {
    return {
      category: 'status',
      label: 'STATUS CHANGE',
      badgeClass:
        'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    };
  }
  if (upper.includes('AUTH') || upper.includes('PASSWORD') || upper.includes('UNAUTHORIZED')) {
    return {
      category: 'security',
      label: 'SECURITY / AUTH',
      badgeClass:
        'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    };
  }
  return {
    category: 'update',
    label: 'UPDATE',
    badgeClass:
      'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  };
}

export function AdminModule() {
  const { db, user, apiFetch, refreshData, hasPermission, showToast, setActiveModule, onlineUserIds } =
    useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('audit_logs');

  // Audit Log Filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditCategory, setAuditCategory] = useState<AuditCategoryFilter>('all');
  const [auditEntityFilter, setAuditEntityFilter] = useState<string>('all');
  const [auditRoleFilter, setAuditRoleFilter] = useState<string>('all');
  const [auditDateFrom, setAuditDateFrom] = useState<string>('');
  const [auditDateTo, setAuditDateTo] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Daily Audit Refresh Lifecycle State
  const [dailyAuditStatus, setDailyAuditStatus] = useState<{
    active: boolean;
    today: string;
    lastRefreshDate: string;
    lastRefreshedAt: string;
    isRefreshedToday: boolean;
    todayEventCount: number;
    totalEventCount: number;
    retentionCycle: string;
  } | null>(null);
  const [refreshingDaily, setRefreshingDaily] = useState(false);

  useEffect(() => {
    if (activeTab === 'audit_logs') {
      apiFetch<any>('/audit/daily-status')
        .then(setDailyAuditStatus)
        .catch(() => {});
    }
  }, [activeTab, apiFetch, db?.audit_logs.length]);

  const handleRefreshDailyAudit = async () => {
    setRefreshingDaily(true);
    try {
      const res = await apiFetch<any>('/audit/refresh-daily', { method: 'POST' });
      await refreshData();
      const statusRes = await apiFetch<any>('/audit/daily-status');
      setDailyAuditStatus(statusRes);
      showToast(res.message || 'Daily audit trail synchronized successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to refresh daily audit logs', 'error');
    } finally {
      setRefreshingDaily(false);
    }
  };

  const handleDeleteUser = async (target: UserProfile) => {
    const confirmed = window.confirm(
      `Permanently delete ${target.full_name} (${target.email})? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const result = await apiFetch<{ message: string }>(`/users/${target.id}`, {
        method: 'DELETE',
      });
      await refreshData();
      showToast(result.message || `Deleted account for ${target.full_name}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete account', 'error');
    }
  };

  const setDateFilterShortcut = (type: 'today' | 'yesterday' | 'last7' | 'all') => {
    const today = new Date();
    const toISO = (d: Date) => d.toISOString().slice(0, 10);

    if (type === 'all') {
      setAuditDateFrom('');
      setAuditDateTo('');
    } else if (type === 'today') {
      const dStr = toISO(today);
      setAuditDateFrom(dStr);
      setAuditDateTo(dStr);
    } else if (type === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const dStr = toISO(y);
      setAuditDateFrom(dStr);
      setAuditDateTo(dStr);
    } else if (type === 'last7') {
      const past = new Date(today);
      past.setDate(past.getDate() - 7);
      setAuditDateFrom(toISO(past));
      setAuditDateTo(toISO(today));
    }
  };

  // New Directorate form
  const [dirCode, setDirCode] = useState('');
  const [dirName, setDirName] = useState('');
  const [dirHq, setDirHq] = useState('Mombasa Headquarters');
  const [dirDesc, setDirDesc] = useState('');

  // New Research Area form
  const [areaCode, setAreaCode] = useState('');
  const [areaName, setAreaName] = useState('');
  const [areaDirId, setAreaDirId] = useState('30000000-0000-4000-8000-000000000001');
  const [areaDesc, setAreaDesc] = useState('');

  // SQL Artifacts
  const [sqlArtifacts, setSqlArtifacts] = useState<{ schemaSql: string; seedSql: string } | null>(
    null
  );

  useEffect(() => {
    if (activeTab === 'exports_sql' && !sqlArtifacts) {
      apiFetch<{ schemaSql: string; seedSql: string }>('/sql-artifacts')
        .then(setSqlArtifacts)
        .catch(() => {});
    }
  }, [activeTab, sqlArtifacts, apiFetch]);

  const entityTypes = useMemo(() => {
    if (!db) return [];
    const set = new Set<string>();
    db.audit_logs.forEach((l) => {
      if (l.entity_type) set.add(l.entity_type);
    });
    return Array.from(set).sort();
  }, [db]);

  const filteredAuditLogs = useMemo(() => {
    if (!db) return [];
    return db.audit_logs.filter((log: AuditLog) => {
      const classification = classifyAuditAction(log.action);
      if (auditCategory !== 'all' && classification.category !== auditCategory) {
        return false;
      }
      if (auditEntityFilter !== 'all' && log.entity_type !== auditEntityFilter) {
        return false;
      }
      if (auditRoleFilter !== 'all' && log.actor_role !== auditRoleFilter) {
        return false;
      }
      if (auditDateFrom && log.created_at.slice(0, 10) < auditDateFrom) {
        return false;
      }
      if (auditDateTo && log.created_at.slice(0, 10) > auditDateTo) {
        return false;
      }
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        const match =
          log.summary.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.actor_email.toLowerCase().includes(q) ||
          log.entity_type.toLowerCase().includes(q) ||
          (log.entity_id || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [
    db,
    auditCategory,
    auditEntityFilter,
    auditRoleFilter,
    auditDateFrom,
    auditDateTo,
    auditSearch,
  ]);

  if (!db) return null;

  const canManageUsers = hasPermission(PermissionCode.USERS_MANAGE);
  const canManageRoles = hasPermission(PermissionCode.ROLES_MANAGE);
  const canManageSettings = hasPermission(PermissionCode.SETTINGS_MANAGE);

  const handleTogglePermission = async (roleId: string, permId: string) => {
    if (!canManageRoles) {
      showToast('Only SUPER ADMIN can modify RBAC role permissions', 'error');
      return;
    }
    try {
      await apiFetch('/admin/role-permissions/toggle', {
        method: 'POST',
        body: JSON.stringify({ role_id: roleId, permission_id: permId }),
      });
      await refreshData();
      showToast('Updated RBAC permission mapping');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleAddDirectorate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/admin/directorates', {
        method: 'POST',
        body: JSON.stringify({
          code: dirCode,
          name: dirName,
          headquarters: dirHq,
          description: dirDesc,
        }),
      });
      await refreshData();
      setDirCode('');
      setDirName('');
      setDirDesc('');
      showToast(`Added directorate ${dirCode.toUpperCase()}`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleAddResearchArea = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/admin/research-areas', {
        method: 'POST',
        body: JSON.stringify({
          code: areaCode,
          name: areaName,
          directorate_id: areaDirId,
          description: areaDesc,
        }),
      });
      await refreshData();
      setAreaCode('');
      setAreaName('');
      setAreaDesc('');
      showToast(`Added research area ${areaCode.toUpperCase()}`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const adminTabs: Array<{ id: AdminTab; label: string }> = [
    { id: 'audit_logs', label: `Audit Log (${db.audit_logs.length})` },
    { id: 'users', label: `Users & Accounts (${db.users.length})` },
    { id: 'rbac', label: 'Roles & Permissions Matrix' },
    { id: 'directorates', label: `Directorates (${db.directorates.length})` },
    { id: 'research_areas', label: `Research Areas (${db.research_areas.length})` },
    { id: 'settings', label: 'System Settings' },
    { id: 'exports_sql', label: 'Imports / Exports & SQL Schema' },
  ];

  // Summary counts for Audit Log KPI bar
  const createCount = db.audit_logs.filter(
    (l) => classifyAuditAction(l.action).category === 'create'
  ).length;
  const updateCount = db.audit_logs.filter(
    (l) => classifyAuditAction(l.action).category === 'update'
  ).length;
  const statusCount = db.audit_logs.filter(
    (l) => classifyAuditAction(l.action).category === 'status'
  ).length;
  const deleteCount = db.audit_logs.filter(
    (l) => classifyAuditAction(l.action).category === 'delete'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-sky-600 shrink-0" />
              <span>System Administration, RBAC Governance &amp; Audit Log Console</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Centralized institutional accountability feed, researcher account control, RBAC matrix, and reference registries
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveModule('scientists')}
              className="px-3 py-1.5 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white text-xs font-semibold"
            >
              + Create Researcher Account
            </button>
          </div>
        </div>

        {/* Sub-Navigation */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1 overflow-x-auto pb-1">
          {adminTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? 'bg-[#0A2540] dark:bg-sky-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: CHRONOLOGICAL, FILTERABLE AUDIT LOG */}
      {activeTab === 'audit_logs' && (
        <div className="space-y-4">
          {/* Daily Refresh Cycle Control & Telemetry Banner */}
          <div className="bg-linear-to-r from-sky-900 to-indigo-950 text-white rounded-xl p-4 sm:p-4.5 shadow-sm border border-sky-800/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-sky-200 flex items-center gap-1.5">
                    <span>Audit Trail Daily Refresh Cycle</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Auto-Refreshes Daily
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-slate-300">
                  Daily cycle status:{' '}
                  <strong className="text-white">
                    {dailyAuditStatus?.isRefreshedToday
                      ? `Synchronized for today (${dailyAuditStatus?.today})`
                      : 'Active 24h retention cycle'}
                  </strong>
                  {' · '}
                  <span>
                    Last cycle:{' '}
                    {dailyAuditStatus?.lastRefreshedAt
                      ? new Date(dailyAuditStatus.lastRefreshedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Active today'}
                  </span>
                  {' · '}
                  <span className="text-sky-300">
                    {dailyAuditStatus?.todayEventCount ?? 0} events recorded today
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={refreshingDaily}
                  onClick={handleRefreshDailyAudit}
                  className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition-colors disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingDaily ? 'animate-spin' : ''}`} />
                  <span>{refreshingDaily ? 'Refreshing Cycle...' : 'Refresh Daily Logs Now'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Accountability Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-500">Total Audit Events</div>
              <div className="text-xl font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                {db.audit_logs.length}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-[11px] text-emerald-600 font-semibold">Creates / Additions</div>
              <div className="text-xl font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                {createCount}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-[11px] text-sky-600 font-semibold">Updates / Edits</div>
              <div className="text-xl font-mono font-bold text-sky-700 dark:text-sky-400 mt-0.5">
                {updateCount}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-[11px] text-amber-600 font-semibold">Status &amp; Approvals</div>
              <div className="text-xl font-mono font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                {statusCount}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-[11px] text-rose-600 font-semibold">Deletions / Revocations</div>
              <div className="text-xl font-mono font-bold text-rose-700 dark:text-rose-400 mt-0.5">
                {deleteCount}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Modification Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Modification Type:</span>
                </span>
                {(
                  [
                    { id: 'all', label: 'All Events' },
                    { id: 'create', label: 'Create' },
                    { id: 'update', label: 'Update' },
                    { id: 'status', label: 'Status Changes' },
                    { id: 'delete', label: 'Delete' },
                    { id: 'security', label: 'Auth & Security' },
                  ] as Array<{ id: AuditCategoryFilter; label: string }>
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setAuditCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      auditCategory === cat.id
                        ? 'bg-[#0A2540] dark:bg-sky-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    exportToCSV(
                      'kmfri_audit_logs_filtered',
                      filteredAuditLogs.map((a) => ({
                        Timestamp: a.created_at,
                        Category: classifyAuditAction(a.action).label,
                        Action_Code: a.action,
                        Actor_Email: a.actor_email,
                        Actor_Role: a.actor_role,
                        Entity_Type: a.entity_type,
                        Entity_ID: a.entity_id || '—',
                        Summary: a.summary,
                      }))
                    )
                  }
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportToExcel(
                      'kmfri_audit_logs_filtered',
                      'AuditLogs',
                      filteredAuditLogs.map((a) => ({
                        Timestamp: a.created_at,
                        Category: classifyAuditAction(a.action).label,
                        Action_Code: a.action,
                        Actor_Email: a.actor_email,
                        Actor_Role: a.actor_role,
                        Entity_Type: a.entity_type,
                        Entity_ID: a.entity_id || '—',
                        Summary: a.summary,
                      }))
                    )
                  }
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>

            {/* Search + Module + Role + Date Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <div className="relative sm:col-span-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search audit summary, user email, action, or UUID..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <select
                value={auditEntityFilter}
                onChange={(e) => setAuditEntityFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
              >
                <option value="all">All System Modules / Entities</option>
                {entityTypes.map((et) => (
                  <option key={et} value={et}>
                    Entity: {et}
                  </option>
                ))}
              </select>

              <select
                value={auditRoleFilter}
                onChange={(e) => setAuditRoleFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
              >
                <option value="all">All Actor RBAC Roles</option>
                {Object.values(RoleCode).map((r) => (
                  <option key={r} value={r}>
                    Role: {r}
                  </option>
                ))}
              </select>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={auditDateFrom}
                    onChange={(e) => setAuditDateFrom(e.target.value)}
                    className="w-full px-2 py-1.5 text-[11px] font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                    title="From Date"
                  />
                  <input
                    type="date"
                    value={auditDateTo}
                    onChange={(e) => setAuditDateTo(e.target.value)}
                    className="w-full px-2 py-1.5 text-[11px] font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                    title="To Date"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDateFilterShortcut('today')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      auditDateFrom === new Date().toISOString().slice(0, 10) && auditDateTo === new Date().toISOString().slice(0, 10)
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateFilterShortcut('yesterday')}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateFilterShortcut('last7')}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  >
                    Last 7d
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateFilterShortcut('all')}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  >
                    All
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Chronological Audit Feed Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Chronological Institutional Accountability Feed
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Showing {filteredAuditLogs.length} of {db.audit_logs.length} Events
              </span>
            </div>

            {filteredAuditLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No audit log events match the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500">
                      <th className="py-3 px-4 font-semibold">Timestamp</th>
                      <th className="py-3 px-4 font-semibold">Modification Type</th>
                      <th className="py-3 px-4 font-semibold">Actor &amp; Role</th>
                      <th className="py-3 px-4 font-semibold">Target Module</th>
                      <th className="py-3 px-4 font-semibold">Modification Summary</th>
                      <th className="py-3 px-4 font-semibold text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredAuditLogs.map((log) => {
                      const cls = classifyAuditAction(log.action);
                      const isExpanded = expandedLogId === log.id;
                      const actorUser = db.users.find((u) => u.id === log.actor_user_id);

                      return (
                        <React.Fragment key={log.id}>
                          <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${cls.badgeClass}`}
                              >
                                {cls.label}
                              </span>
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                {log.action}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <UserAvatar
                                  user={actorUser}
                                  name={log.actor_email}
                                  size="xs"
                                />
                                <div>
                                  <div className="font-mono font-medium text-slate-900 dark:text-white">
                                    {log.actor_email}
                                  </div>
                                  <div className="text-[10px] font-mono text-sky-700 dark:text-sky-400">
                                    {log.actor_role}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                              {log.entity_type}
                            </td>
                            <td className="py-3 px-4 text-slate-800 dark:text-slate-200 max-w-md">
                              {log.summary}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedLogId((prev) => (prev === log.id ? null : log.id))
                                }
                                className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-mono inline-flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <span>Inspect</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/90 dark:bg-slate-950/80">
                              <td colSpan={6} className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] font-mono">
                                  <div>
                                    <span className="text-slate-400">Audit Event UUID:</span>{' '}
                                    <span className="text-slate-800 dark:text-slate-200">
                                      {log.id}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Target Entity UUID:</span>{' '}
                                    <span className="text-slate-800 dark:text-slate-200">
                                      {log.entity_id || 'N/A (System Scope)'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Origin IP Address:</span>{' '}
                                    <span className="text-slate-800 dark:text-slate-200">
                                      {log.ip_address}
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <div className="text-[10px] font-mono text-slate-400 mb-1">
                                    Structured Modification Payload (JSONB):
                                  </div>
                                  <pre className="p-2.5 rounded-lg bg-slate-900 text-teal-300 font-mono text-[11px] overflow-x-auto">
                                    {JSON.stringify(log.metadata || {}, null, 2)}
                                  </pre>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: USERS & ACCOUNTS */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              All Institutional User &amp; Scientist Accounts
            </h3>
            <span className="text-xs font-mono text-slate-500">
              {db.users.length} Total Accounts
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500">
                  <th className="py-3 px-4 font-semibold">Scientist / User</th>
                  <th className="py-3 px-4 font-semibold">Staff No.</th>
                  <th className="py-3 px-4 font-semibold">RBAC Role</th>
                  <th className="py-3 px-4 font-semibold">Account Type</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Admin Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {db.users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          user={u}
                          size="sm"
                          isOnline={onlineUserIds.includes(u.id)}
                        />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {u.title} {u.full_name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold">{u.staff_number}</td>
                    <td className="py-3 px-4 font-mono text-sky-700 dark:text-sky-400">
                      {u.role_code}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {u.is_operational_scientist ? 'Operational Scientist' : 'System Role Account'}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {u.is_active ? '● Active' : '✖ Deactivated'}
                    </td>
                    <td className="py-3 px-4">
                      {canManageUsers && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await apiFetch(`/users/${u.id}/toggle-status`, { method: 'POST' });
                                await refreshData();
                                showToast(`Toggled status for ${u.email}`);
                              } catch (err: any) {
                                showToast(err.message, 'error');
                              }
                            }}
                            className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] flex items-center gap-1"
                          >
                            <Power className="w-3 h-3" />
                            <span>{u.is_active ? 'Deactivate' : 'Reactivate'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await apiFetch<{ temporary_password: string }>(
                                  `/users/${u.id}/reset-password`,
                                  { method: 'POST' }
                                );
                                await refreshData();
                                showToast(
                                  `Password reset to ${res.temporary_password} for ${u.email}`
                                );
                              } catch (err: any) {
                                showToast(err.message, 'error');
                              }
                            }}
                            className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] flex items-center gap-1"
                          >
                            <KeyRound className="w-3 h-3" />
                            <span>Reset Password</span>
                          </button>
                          {u.id !== user?.id && u.role_code !== RoleCode.SUPER_ADMIN && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="px-2 py-1 rounded border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1"
                              title="Permanently delete account"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ROLES & PERMISSIONS MATRIX */}
      {activeTab === 'rbac' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 overflow-x-auto">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Role-Based Access Control (RBAC) Permission Matrix
            </h3>
            <p className="text-xs text-slate-500">
              Enforced across both UI components and server API endpoints (`/api/*`)
            </p>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <th className="py-2.5 px-3 font-semibold">Permission Code &amp; Description</th>
                {db.roles.map((r) => (
                  <th key={r.id} className="py-2.5 px-3 font-mono text-center text-[11px]">
                    {r.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {db.permissions.map((perm) => (
                <tr key={perm.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3">
                    <div className="font-mono font-semibold text-sky-700 dark:text-sky-400">
                      {perm.code}
                    </div>
                    <div className="text-[11px] text-slate-500">{perm.description}</div>
                  </td>
                  {db.roles.map((role) => {
                    const granted =
                      role.code === RoleCode.SUPER_ADMIN ||
                      db.role_permissions.some(
                        (rp) => rp.role_id === role.id && rp.permission_id === perm.id
                      );
                    return (
                      <td key={role.id} className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          disabled={!canManageRoles || role.code === RoleCode.SUPER_ADMIN}
                          onClick={() => handleTogglePermission(role.id, perm.id)}
                          className={`w-6 h-6 rounded inline-flex items-center justify-center border transition-colors ${
                            granted
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'border-slate-300 dark:border-slate-700 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: DIRECTORATES */}
      {activeTab === 'directorates' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Seeded KMFRI Directorates ({db.directorates.length})
            </h3>
            {db.directorates.map((d) => (
              <div
                key={d.id}
                className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-bold text-sky-700 dark:text-sky-400">
                    {d.code} — {d.name}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">{d.headquarters}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mt-1">{d.description}</p>
              </div>
            ))}
          </div>

          {canManageSettings && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-sky-600" />
                <span>Add Reference Directorate</span>
              </h3>
              <form onSubmit={handleAddDirectorate} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium mb-1">Directorate Code *</label>
                  <input
                    type="text"
                    required
                    value={dirCode}
                    onChange={(e) => setDirCode(e.target.value)}
                    placeholder="BEP"
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Directorate Name *</label>
                  <input
                    type="text"
                    required
                    value={dirName}
                    onChange={(e) => setDirName(e.target.value)}
                    placeholder="Blue Economy Special Programmes"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Headquarters / Centre *</label>
                  <input
                    type="text"
                    required
                    value={dirHq}
                    onChange={(e) => setDirHq(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Mandate Description</label>
                  <textarea
                    rows={3}
                    value={dirDesc}
                    onChange={(e) => setDirDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white font-semibold"
                >
                  Create Directorate
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: RESEARCH AREAS */}
      {activeTab === 'research_areas' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Seeded KMFRI Research Areas ({db.research_areas.length})
            </h3>
            {db.research_areas.map((a) => {
              const dir = db.directorates.find((d) => d.id === a.directorate_id);
              return (
                <div
                  key={a.id}
                  className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
                      {a.code} — {a.name}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      Directorate: {dir?.code || '—'}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 mt-1">{a.description}</p>
                </div>
              );
            })}
          </div>

          {canManageSettings && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-teal-600" />
                <span>Add Research Area</span>
              </h3>
              <form onSubmit={handleAddResearchArea} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium mb-1">Research Area Code *</label>
                  <input
                    type="text"
                    required
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value)}
                    placeholder="OCS-DEEP"
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={areaName}
                    onChange={(e) => setAreaName(e.target.value)}
                    placeholder="Deep Sea & Benthic Biodiversity"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Parent Directorate *</label>
                  <select
                    value={areaDirId}
                    onChange={(e) => setAreaDirId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    {db.directorates.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={areaDesc}
                    onChange={(e) => setAreaDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white font-semibold"
                >
                  Create Research Area
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: SYSTEM SETTINGS */}
      {activeTab === 'settings' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-600" />
            <span>Seeded Institutional System Settings</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {db.system_settings.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sky-700 dark:text-sky-400">
                    {s.setting_key}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">{s.category}</span>
                </div>
                <p className="text-slate-500">{s.description}</p>
                <pre className="p-2.5 rounded bg-slate-50 dark:bg-slate-950 font-mono text-[11px] overflow-x-auto border border-slate-200 dark:border-slate-800">
                  {JSON.stringify(s.setting_value, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: IMPORTS / EXPORTS & POSTGRESQL / SUPABASE SQL SCHEMA INSPECTOR */}
      {activeTab === 'exports_sql' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-600" />
              <span>Institutional Data Bulk Export Center</span>
            </h3>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() =>
                  exportToExcel(
                    'kmfri_reference_directorates',
                    'Directorates',
                    db.directorates as any
                  )
                }
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Export Directorates (Excel)
              </button>
              <button
                type="button"
                onClick={() =>
                  exportToExcel(
                    'kmfri_reference_research_areas',
                    'ResearchAreas',
                    db.research_areas as any
                  )
                }
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Export Research Areas (Excel)
              </button>
              <button
                type="button"
                onClick={() => exportToExcel('kmfri_roles_permissions', 'Roles', db.roles as any)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Export RBAC Roles (Excel)
              </button>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(db, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'kmfri_full_database_backup.json';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-2 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white text-xs font-semibold"
              >
                Download Full Database Snapshot (JSON)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                  supabase/migrations/0001_kmfri_schema.sql
                </h4>
                <span className="text-[11px] text-teal-600 font-mono">24 Tables · UUID · RLS</span>
              </div>
              <pre className="p-3 rounded-lg bg-slate-950 text-slate-200 font-mono text-[11px] h-80 overflow-y-auto">
                {sqlArtifacts?.schemaSql || 'Loading SQL schema...'}
              </pre>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                  supabase/seed.sql (Reference Data Only)
                </h4>
                <span className="text-[11px] text-sky-600 font-mono">Zero Fake Operational Data</span>
              </div>
              <pre className="p-3 rounded-lg bg-slate-950 text-slate-200 font-mono text-[11px] h-80 overflow-y-auto">
                {sqlArtifacts?.seedSql || 'Loading SQL seed script...'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
