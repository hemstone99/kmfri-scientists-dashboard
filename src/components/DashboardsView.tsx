import React, { useState, useMemo } from 'react';
import {
  BootstrapData,
  ProjectRecord,
  UserRecord,
} from '../types.ts';
import {
  isReportOverdue,
  daysUntilDate,
  normalizeCurrencyToKES,
  calculateUtilizationPercent,
  calculateScientistBalancedScorecard,
} from '../lib/domain.ts';
import { InteractiveMap } from './InteractiveMap.tsx';
import {
  Users,
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  Compass,
  FileText,
  BookOpen,
  Building2,
  Activity,
  ArrowRight,
  Plus,
  Filter,
  Award,
  Layers,
  Camera,
} from 'lucide-react';

interface DashboardsViewProps {
  data: BootstrapData;
  dashboardMode: 'OVERALL' | 'SCIENTIST' | 'OCS_HEAD';
  setDashboardMode: (mode: 'OVERALL' | 'SCIENTIST' | 'OCS_HEAD') => void;
  inspectedScientistId: string | null;
  setInspectedScientistId: (id: string | null) => void;
  onSelectProject: (project: ProjectRecord) => void;
  onNavigateModule: (moduleName: string) => void;
  onOpenNewProject: () => void;
  onOpenNewReport: () => void;
  onOpenNewLocation?: (
    lat: number,
    lng: number,
    suggested?: { county: string; marineArea: string; site: string }
  ) => void;
  onUpdateProfilePhoto?: (
    photoDataUrl: string,
    targetUserId?: string
  ) => Promise<void>;
}

export const DashboardsView: React.FC<DashboardsViewProps> = ({
  data,
  dashboardMode,
  setDashboardMode,
  inspectedScientistId,
  setInspectedScientistId,
  onSelectProject,
  onNavigateModule,
  onOpenNewProject,
  onOpenNewReport,
  onOpenNewLocation,
  onUpdateProfilePhoto,
}) => {
  // Global Dashboard Filters
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [directorateFilter, setDirectorateFilter] = useState<string>('ALL');
  const [scientistFilter, setScientistFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [funderFilter, setFunderFilter] = useState<string>('ALL');
  const [researchAreaFilter, setResearchAreaFilter] = useState<string>('ALL');
  const [drilldownKpi, setDrilldownKpi] = useState<
    'ALL' | 'ACTIVE_PROJECTS' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE_REPORTS' | 'SCIENTISTS'
  >('ALL');

  const years = useMemo(() => {
    const set = new Set<string>();
    data.projects.forEach((p) => {
      if (p.startDate) set.add(p.startDate.slice(0, 4));
    });
    data.funding.forEach((f) => {
      if (f.awardDate) set.add(f.awardDate.slice(0, 4));
    });
    return Array.from(set).sort().reverse();
  }, [data.projects, data.funding]);

  const filteredProjects = useMemo(() => {
    return data.projects.filter((p) => {
      if (yearFilter !== 'ALL' && !p.startDate.startsWith(yearFilter)) return false;
      if (directorateFilter !== 'ALL' && p.directorateId !== directorateFilter)
        return false;
      if (researchAreaFilter !== 'ALL' && p.researchAreaId !== researchAreaFilter)
        return false;
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (scientistFilter !== 'ALL') {
        const isPi = p.principalInvestigatorId === scientistFilter;
        const isMember = data.projectMembers.some(
          (pm) => pm.projectId === p.id && pm.userId === scientistFilter
        );
        if (!isPi && !isMember) return false;
      }
      if (funderFilter !== 'ALL') {
        const hasFunder = data.funding.some(
          (f) => f.projectId === p.id && f.funderId === funderFilter
        );
        if (!hasFunder) return false;
      }
      return true;
    });
  }, [
    data.projects,
    data.projectMembers,
    data.funding,
    yearFilter,
    directorateFilter,
    researchAreaFilter,
    statusFilter,
    scientistFilter,
    funderFilter,
  ]);

  const filteredProjectIds = useMemo(
    () => new Set(filteredProjects.map((p) => p.id)),
    [filteredProjects]
  );

  const filteredFunding = useMemo(
    () => data.funding.filter((f) => filteredProjectIds.has(f.projectId)),
    [data.funding, filteredProjectIds]
  );

  const filteredReports = useMemo(
    () => data.reports.filter((r) => filteredProjectIds.has(r.projectId)),
    [data.reports, filteredProjectIds]
  );

  // KPIs
  const totalScientists = data.users.length;
  const activeProjectsCount = filteredProjects.filter(
    (p) => p.status === 'Approved' || p.status === 'In Progress'
  ).length;
  const inProgressCount = filteredProjects.filter(
    (p) => p.status === 'In Progress'
  ).length;
  const completedProjectsCount = filteredProjects.filter(
    (p) => p.status === 'Completed'
  ).length;
  const pendingOrOverdueReports = filteredReports.filter(
    (r) =>
      r.status === 'Draft' ||
      r.status === 'Submitted' ||
      r.status === 'Under Review' ||
      isReportOverdue(r.dueDate, r.status)
  );
  const overdueReportsCount = filteredReports.filter((r) =>
    isReportOverdue(r.dueDate, r.status)
  ).length;

  const totalFundingKES = filteredFunding.reduce(
    (sum, f) => sum + normalizeCurrencyToKES(f.amount, f.currency),
    0
  );

  // Scientist Dashboard Target User
  const targetScientist: UserRecord = useMemo(() => {
    if (inspectedScientistId) {
      return (
        data.users.find((u) => u.id === inspectedScientistId) || data.currentUser
      );
    }
    return data.currentUser;
  }, [inspectedScientistId, data.users, data.currentUser]);

  // Oceans & Coastal Systems Directorate
  const ocsDirectorate = useMemo(
    () => data.directorates.find((d) => d.code === 'OCS') || data.directorates[0],
    [data.directorates]
  );

  return (
    <div className="space-y-6">
      {/* Top Mode Switcher: Overall Institutional | Personal Scientist | Head of Oceans & Coastal Systems */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Kenya Marine and Fisheries Research Institute · Mombasa Headquarters
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
            {dashboardMode === 'OVERALL'
              ? 'Institutional Research & Analytics Command Center'
              : dashboardMode === 'OCS_HEAD'
                ? 'Oceans & Coastal Systems Directorate Oversight'
                : `Scientist Research Workspace — ${targetScientist.fullName}`}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setDashboardMode('OVERALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                dashboardMode === 'OVERALL'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Overall Dashboard
            </button>
            <button
              type="button"
              onClick={() => {
                setInspectedScientistId(data.currentUser.id);
                setDashboardMode('SCIENTIST');
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                dashboardMode === 'SCIENTIST'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Scientist Dashboard
            </button>
            <button
              type="button"
              onClick={() => setDashboardMode('OCS_HEAD')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                dashboardMode === 'OCS_HEAD'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Oceans & Coastal Systems Head
            </button>
          </div>

          {data.currentUser.roleName !== 'VIEWER' && (
            <button
              type="button"
              onClick={onOpenNewProject}
              className="px-3.5 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          MODE 1: OVERALL INSTITUTIONAL DASHBOARD
      ===================================================================== */}
      {dashboardMode === 'OVERALL' && (
        <div className="space-y-6">
          {/* Multi-Dimensional Filter Bar */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Fiscal / Start Year
              </label>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="ALL">All Years</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Directorate
              </label>
              <select
                value={directorateFilter}
                onChange={(e) => setDirectorateFilter(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="ALL">All Directorates</option>
                {data.directorates.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Research Area
              </label>
              <select
                value={researchAreaFilter}
                onChange={(e) => setResearchAreaFilter(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="ALL">All Research Areas</option>
                {data.researchAreas
                  .filter(
                    (ra) =>
                      directorateFilter === 'ALL' ||
                      ra.directorateId === directorateFilter
                  )
                  .map((ra) => (
                    <option key={ra.id} value={ra.id}>
                      {ra.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Scientist / PI
              </label>
              <select
                value={scientistFilter}
                onChange={(e) => setScientistFilter(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="ALL">All Scientists</option>
                {data.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Project Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="ALL">All Statuses</option>
                {[
                  'Proposed',
                  'Approved',
                  'In Progress',
                  'Suspended',
                  'Completed',
                  'Cancelled',
                ].map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Funding Agency
              </label>
              <select
                value={funderFilter}
                onChange={(e) => setFunderFilter(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="ALL">All Funders</option>
                {data.funders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 6 Interactive KPI Panels with Drill-Down */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <button
              type="button"
              onClick={() =>
                setDrilldownKpi(drilldownKpi === 'SCIENTISTS' ? 'ALL' : 'SCIENTISTS')
              }
              className={`text-left p-4 rounded-xl border transition-colors ${
                drilldownKpi === 'SCIENTISTS'
                  ? 'border-sky-600 bg-sky-50/40 dark:bg-sky-950/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-500/50'
              }`}
            >
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Total Scientists
              </div>
              <div className="text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-white mt-1">
                {totalScientists}
              </div>
              <div className="text-[11px] text-sky-700 dark:text-sky-400 mt-1">
                Click to drill down →
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setDrilldownKpi(
                  drilldownKpi === 'ACTIVE_PROJECTS' ? 'ALL' : 'ACTIVE_PROJECTS'
                )
              }
              className={`text-left p-4 rounded-xl border transition-colors ${
                drilldownKpi === 'ACTIVE_PROJECTS'
                  ? 'border-sky-600 bg-sky-50/40 dark:bg-sky-950/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-500/50'
              }`}
            >
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Active Projects
              </div>
              <div className="text-2xl font-mono font-bold tabular-nums text-sky-700 dark:text-sky-400 mt-1">
                {activeProjectsCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Of {filteredProjects.length} total
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setDrilldownKpi(
                  drilldownKpi === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS'
                )
              }
              className={`text-left p-4 rounded-xl border transition-colors ${
                drilldownKpi === 'IN_PROGRESS'
                  ? 'border-teal-600 bg-teal-50/40 dark:bg-teal-950/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-500/50'
              }`}
            >
              <div className="text-xs text-slate-500 dark:text-slate-400">
                In Progress
              </div>
              <div className="text-2xl font-mono font-bold tabular-nums text-teal-700 dark:text-teal-400 mt-1">
                {inProgressCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Field & lab execution
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setDrilldownKpi(drilldownKpi === 'COMPLETED' ? 'ALL' : 'COMPLETED')
              }
              className={`text-left p-4 rounded-xl border transition-colors ${
                drilldownKpi === 'COMPLETED'
                  ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500/50'
              }`}
            >
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Completed Projects
              </div>
              <div className="text-2xl font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {completedProjectsCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Deliverables closed
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setDrilldownKpi(
                  drilldownKpi === 'OVERDUE_REPORTS' ? 'ALL' : 'OVERDUE_REPORTS'
                )
              }
              className={`text-left p-4 rounded-xl border transition-colors ${
                drilldownKpi === 'OVERDUE_REPORTS'
                  ? 'border-amber-600 bg-amber-50/40 dark:bg-amber-950/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-500/50'
              }`}
            >
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Pending / Overdue Reports
              </div>
              <div className="text-2xl font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-1">
                {pendingOrOverdueReports.length}{' '}
                <span className="text-xs font-normal text-rose-600">
                  ({overdueReportsCount} overdue)
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Click to inspect reports →
              </div>
            </button>

            <div
              onClick={() => onNavigateModule('Funding')}
              className="cursor-pointer text-left p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-500/50 transition-colors"
            >
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Total Grant Funding (KES)
              </div>
              <div className="text-xl font-mono font-bold tabular-nums text-slate-900 dark:text-white mt-1 truncate">
                {totalFundingKES.toLocaleString()}
              </div>
              <div className="text-[11px] text-sky-700 dark:text-sky-400 mt-1">
                {filteredFunding.length} active grant{filteredFunding.length === 1 ? '' : 's'} →
              </div>
            </div>
          </div>

          {/* Interactive Drill-Down Panel (KPI -> Project -> Scientist -> Activity/Report) */}
          {drilldownKpi !== 'ALL' && (
            <div className="p-5 rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50/30 dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  KPI Drill-Down Explorer:{' '}
                  {drilldownKpi === 'SCIENTISTS'
                    ? 'Registered KMFRI Scientists (Select scientist to inspect Projects, Activities & Reports)'
                    : drilldownKpi === 'OVERDUE_REPORTS'
                      ? 'Pending & Overdue Reports Queue'
                      : `Filtered Projects (${drilldownKpi.replace('_', ' ')})`}
                </div>
                <button
                  type="button"
                  onClick={() => setDrilldownKpi('ALL')}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Close Drill-Down ×
                </button>
              </div>

              {drilldownKpi === 'SCIENTISTS' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {data.users.map((u) => {
                    const userProjCount = data.projects.filter(
                      (p) => p.principalInvestigatorId === u.id
                    ).length;
                    const userRepCount = data.reports.filter(
                      (r) => r.scientistId === u.id
                    ).length;
                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          setInspectedScientistId(u.id);
                          setDashboardMode('SCIENTIST');
                        }}
                        className="cursor-pointer p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-sky-500 transition-colors"
                      >
                        <div className="text-xs font-mono text-sky-700 dark:text-sky-400">
                          {u.staffNumber || 'KMFRI Staff'} · {u.status}
                        </div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                          {u.fullName}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {userProjCount} Led Projects · {userRepCount} Reports → Inspect Workspace
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : drilldownKpi === 'OVERDUE_REPORTS' ? (
                <div className="space-y-2">
                  {pendingOrOverdueReports.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No pending or overdue reports found.
                    </p>
                  ) : (
                    pendingOrOverdueReports.map((rep) => {
                      const proj = data.projects.find((p) => p.id === rep.projectId);
                      const sci = data.users.find((u) => u.id === rep.scientistId);
                      const overdue = isReportOverdue(rep.dueDate, rep.status);
                      return (
                        <div
                          key={rep.id}
                          className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {rep.title}
                            </span>
                            <span className="text-slate-400"> · </span>
                            <span>Project: {proj?.projectCode || 'N/A'}</span>
                            <span className="text-slate-400"> · </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (sci) {
                                  setInspectedScientistId(sci.id);
                                  setDashboardMode('SCIENTIST');
                                }
                              }}
                              className="text-sky-700 dark:text-sky-400 hover:underline"
                            >
                              Scientist: {sci?.fullName || 'Unknown'}
                            </button>
                          </div>
                          <div className="font-mono">
                            Due: {rep.dueDate} ·{' '}
                            <span
                              className={
                                overdue
                                  ? 'text-rose-600 font-semibold'
                                  : 'text-amber-600 font-semibold'
                              }
                            >
                              {overdue ? 'OVERDUE' : rep.status}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredProjects
                    .filter((p) =>
                      drilldownKpi === 'ACTIVE_PROJECTS'
                        ? p.status === 'Approved' || p.status === 'In Progress'
                        : drilldownKpi === 'IN_PROGRESS'
                          ? p.status === 'In Progress'
                          : p.status === 'Completed'
                    )
                    .map((proj) => {
                      const pi = data.users.find(
                        (u) => u.id === proj.principalInvestigatorId
                      );
                      return (
                        <div
                          key={proj.id}
                          onClick={() => onSelectProject(proj)}
                          className="cursor-pointer p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-sky-500 transition-colors"
                        >
                          <div className="flex justify-between text-xs">
                            <span className="font-mono font-semibold text-sky-700 dark:text-sky-400">
                              {proj.projectCode}
                            </span>
                            <span className="font-mono">{proj.progressPercent}%</span>
                          </div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                            {proj.title}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            PI: {pi?.fullName || 'Unassigned'} · Status: {proj.status} → Open 11-Tab Workspace
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Analytics Breakdowns: Projects by Directorate, Projects by Status & Funding by Source */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Projects by Directorate */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Projects by Directorate
                </h3>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  {filteredProjects.length} Projects
                </span>
              </div>
              <div className="space-y-3">
                {data.directorates.map((dir) => {
                  const count = filteredProjects.filter(
                    (p) => p.directorateId === dir.id
                  ).length;
                  const pct =
                    filteredProjects.length > 0
                      ? Math.round((count / filteredProjects.length) * 100)
                      : 0;
                  return (
                    <div key={dir.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {dir.code} · {dir.name}
                        </span>
                        <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-600"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Projects by Status & Completion Trend */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Projects by Status & Execution Rate
                </h3>
                <span className="text-xs text-slate-500">Lifecycle Distribution</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'Proposed', color: 'bg-slate-500' },
                  { label: 'Approved', color: 'bg-sky-600' },
                  { label: 'In Progress', color: 'bg-teal-600' },
                  { label: 'Completed', color: 'bg-emerald-600' },
                  { label: 'Suspended', color: 'bg-amber-500' },
                ].map((st) => {
                  const count = filteredProjects.filter(
                    (p) => p.status === st.label
                  ).length;
                  const pct =
                    filteredProjects.length > 0
                      ? Math.round((count / filteredProjects.length) * 100)
                      : 0;
                  return (
                    <div key={st.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-700 dark:text-slate-300">
                          {st.label}
                        </span>
                        <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${st.color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Funding by Funder / Source */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Funding by Source / Partner
                </h3>
                <span className="text-xs font-mono text-teal-700 dark:text-teal-400">
                  KES {totalFundingKES.toLocaleString()}
                </span>
              </div>
              {data.funders.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-slate-500">
                    No funding agencies or grants recorded yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigateModule('Funding')}
                    className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline"
                  >
                    + Register Funder & Grant in Funding Module →
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.funders.slice(0, 5).map((funder) => {
                    const grants = filteredFunding.filter(
                      (f) => f.funderId === funder.id
                    );
                    const sumKES = grants.reduce(
                      (s, g) => s + normalizeCurrencyToKES(g.amount, g.currency),
                      0
                    );
                    const pct =
                      totalFundingKES > 0
                        ? Math.round((sumKES / totalFundingKES) * 100)
                        : 0;
                    return (
                      <div key={funder.id} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {funder.name} ({funder.type})
                          </span>
                          <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                            KES {sumKES.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-600"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Interactive GIS Map of Project Locations */}
          <InteractiveMap
            locations={data.locations}
            projectLocations={data.projectLocations}
            projects={filteredProjects}
            onSelectProject={(pid) => {
              const found = data.projects.find((p) => p.id === pid);
              if (found) onSelectProject(found);
            }}
            onPickCoordinates={
              data.currentUser.roleName !== 'VIEWER' ? onOpenNewLocation : undefined
            }
          />

          {/* Bottom 3-Column Operational Feed: Recent Activities, Deadlines & Reports, Research Outputs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Research Activities */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Recent Field & Lab Activities
                </h3>
                <span className="text-xs font-mono text-slate-500">
                  {data.researchActivities.length} logged
                </span>
              </div>
              {data.researchActivities.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">
                  No field or laboratory activities logged yet. Scientists can log activities inside any Project workspace.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.researchActivities.slice(0, 5).map((act) => {
                    const sci = data.users.find((u) => u.id === act.scientistId);
                    const proj = data.projects.find((p) => p.id === act.projectId);
                    return (
                      <div
                        key={act.id}
                        className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                      >
                        <div className="font-medium text-slate-900 dark:text-white">
                          {act.title}
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          {sci?.fullName} · {proj?.projectCode} · {act.activityDate} ({act.hours}h)
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming Deadlines & Reports */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Report Deadlines & Submissions
                </h3>
                <button
                  type="button"
                  onClick={onOpenNewReport}
                  className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
                >
                  + Submit Report
                </button>
              </div>
              {filteredReports.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">
                  No technical or quarterly reports scheduled yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {filteredReports.slice(0, 5).map((rep) => {
                    const overdue = isReportOverdue(rep.dueDate, rep.status);
                    const days = daysUntilDate(rep.dueDate);
                    return (
                      <div
                        key={rep.id}
                        className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">
                            {rep.title}
                          </div>
                          <div className="text-slate-500">
                            {rep.reportType} · {rep.reportingPeriod}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div
                            className={
                              overdue
                                ? 'text-rose-600 font-semibold'
                                : 'text-slate-700 dark:text-slate-300'
                            }
                          >
                            {overdue ? 'OVERDUE' : rep.status}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {rep.dueDate} ({days >= 0 ? `in ${days}d` : `${Math.abs(days)}d ago`})
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Research Outputs & Collaborators */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Publications, Datasets & Partners
                </h3>
                <span className="text-xs font-mono text-slate-500">
                  {data.researchOutputs.length} outputs · {data.collaborators.length} partners
                </span>
              </div>
              {data.researchOutputs.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">
                  No publications, datasets, or presentations recorded yet. Add entries in Research Outputs.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.researchOutputs.slice(0, 5).map((out) => (
                    <div
                      key={out.id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <div className="font-medium text-slate-900 dark:text-white line-clamp-1">
                        {out.title}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {out.outputType} · {out.publicationDate}{' '}
                        {out.doi ? `· DOI: ${out.doi}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODE 2: PERSONAL / SELECTED SCIENTIST DASHBOARD
      ===================================================================== */}
      {dashboardMode === 'SCIENTIST' && (
        <div className="space-y-6">
          {/* Scientist Selector & Profile Card with Profile Picture Upload */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative group shrink-0">
                {targetScientist.profilePhoto ? (
                  <img
                    src={targetScientist.profilePhoto}
                    alt={targetScientist.fullName}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-full object-cover border-2 border-sky-600 shadow-xs"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-sky-800 text-white flex items-center justify-center text-lg font-bold border-2 border-sky-500/40">
                    {targetScientist.fullName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}

                {onUpdateProfilePhoto && (
                  <label
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-sky-700 hover:bg-sky-800 text-white flex items-center justify-center shadow-md cursor-pointer border-2 border-white dark:border-slate-900"
                    title="Upload / Update Scientist Profile Picture"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            onUpdateProfilePhoto(
                              reader.result,
                              targetScientist.id
                            );
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-sky-700 dark:text-sky-400">
                    {targetScientist.staffNumber || 'KMFRI-SCI'}
                  </span>
                  <span>·</span>
                  <span>{targetScientist.position || 'Research Scientist'}</span>
                  <span>·</span>
                  <span>Status: {targetScientist.status}</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {targetScientist.fullName}
                </h2>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {data.directorates.find((d) => d.id === targetScientist.directorateId)
                    ?.name || 'Oceans and Coastal Systems'}{' '}
                  ·{' '}
                  {data.researchAreas.find((r) => r.id === targetScientist.researchAreaId)
                    ?.name || 'Marine Ecology'}{' '}
                  · {targetScientist.email}
                  {targetScientist.phone ? ` · ${targetScientist.phone}` : ''}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {onUpdateProfilePhoto && (
                <label className="px-3 py-1.5 rounded-lg border border-sky-600/40 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-sky-100 dark:hover:bg-sky-900/60">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Update Profile Picture</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') {
                          onUpdateProfilePhoto(
                            reader.result,
                            targetScientist.id
                          );
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="hidden"
                  />
                </label>
              )}

              <select
                value={targetScientist.id}
                onChange={(e) => setInspectedScientistId(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                {data.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    Inspect Scientist: {u.fullName} ({u.staffNumber || 'Staff'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Scientist Metrics & Portfolio */}
          {(() => {
            const sciProjects = data.projects.filter(
              (p) =>
                p.principalInvestigatorId === targetScientist.id ||
                data.projectMembers.some(
                  (pm) => pm.projectId === p.id && pm.userId === targetScientist.id
                )
            );
            const sciProjectIds = new Set(sciProjects.map((p) => p.id));
            const sciMilestones = data.projectMilestones.filter((m) =>
              sciProjectIds.has(m.projectId)
            );
            const sciReports = data.reports.filter(
              (r) =>
                r.scientistId === targetScientist.id || sciProjectIds.has(r.projectId)
            );
            const sciOutputs = data.researchOutputs.filter(
              (o) =>
                o.leadScientistId === targetScientist.id ||
                data.outputAuthors.some(
                  (oa) => oa.outputId === o.id && oa.userId === targetScientist.id
                )
            );
            const sciActivities = data.researchActivities.filter(
              (a) => a.scientistId === targetScientist.id
            );
            const sciFunding = data.funding.filter((f) =>
              sciProjectIds.has(f.projectId)
            );
            const sciBsc = calculateScientistBalancedScorecard({
              scientistId: targetScientist.id,
              projects: data.projects.map((p) => ({
                id: p.id,
                code: p.projectCode,
                title: p.title,
                principalInvestigatorId: p.principalInvestigatorId,
                memberUserIds: data.projectMembers
                  .filter((pm) => pm.projectId === p.id)
                  .map((pm) => pm.userId),
                progressPercent: p.progressPercent,
                status: p.status,
              })),
              reports: data.reports,
              outputs: data.researchOutputs || [],
              funding: data.funding,
              activities: data.researchActivities || [],
              documents: data.documents || [],
            });

            return (
              <>
                {/* Scientist Balanced Scorecard Summary Strip */}
                <div className="p-5 rounded-2xl border border-teal-500/30 bg-gradient-to-r from-slate-900 via-sky-950 to-teal-950 text-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0">
                        <Award className="w-6 h-6 text-amber-300" />
                      </div>
                      <div>
                        <div className="text-[11px] font-mono uppercase tracking-wider text-teal-300">
                          KMFRI Scientist Balanced Scorecard (BSC)
                        </div>
                        <div className="text-lg font-bold flex flex-wrap items-center gap-2 mt-0.5">
                          <span>
                            Composite Score: {sciBsc.totalScore} / 100 pts
                          </span>
                          <span className="px-2.5 py-0.5 rounded-lg bg-emerald-400/20 border border-emerald-300/30 text-xs font-mono text-emerald-200">
                            {sciBsc.grade}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 mt-0.5">
                          Projects: {sciBsc.projectExecutionScore}/35 · Publications &amp; Docs: {sciBsc.publicationsOutputScore}/25 · Grants: {sciBsc.financialGrantScore}/20 · Cruises &amp; Events: {sciBsc.eventsActivitiesScore}/20
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigateModule('Balanced Scorecard')}
                      className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Award className="w-4 h-4" />
                      <span>Open Full Balanced Scorecard &amp; Events →</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="text-xs text-slate-500">Assigned / Led Projects</div>
                    <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white mt-1">
                      {sciProjects.length}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {
                        sciProjects.filter((p) => p.status === 'In Progress')
                          .length
                      }{' '}
                      active ·{' '}
                      {sciProjects.filter((p) => p.status === 'Completed').length}{' '}
                      completed
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="text-xs text-slate-500">Milestones</div>
                    <div className="text-2xl font-mono font-bold text-sky-700 dark:text-sky-400 mt-1">
                      {sciMilestones.length}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {
                        sciMilestones.filter((m) => m.status === 'Completed')
                          .length
                      }{' '}
                      completed
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="text-xs text-slate-500">Submitted / Pending Reports</div>
                    <div className="text-2xl font-mono font-bold text-teal-700 dark:text-teal-400 mt-1">
                      {sciReports.length}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {sciReports.filter((r) => r.status === 'Approved').length}{' '}
                      approved
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="text-xs text-slate-500">Publications & Outputs</div>
                    <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white mt-1">
                      {sciOutputs.length}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Papers, datasets, talks
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="text-xs text-slate-500">Logged Research Hours</div>
                    <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white mt-1">
                      {sciActivities
                        .reduce((s, a) => s + Number(a.hours || 0), 0)
                        .toLocaleString()}
                      h
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Across {sciActivities.length} activities
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Assigned & Led Projects */}
                  <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Assigned & Led Research Projects
                      </h3>
                      <button
                        type="button"
                        onClick={onOpenNewProject}
                        className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
                      >
                        + Create Project
                      </button>
                    </div>
                    {sciProjects.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4">
                        No projects assigned to {targetScientist.fullName} yet.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {sciProjects.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => onSelectProject(p)}
                            className="cursor-pointer p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 transition-colors"
                          >
                            <div className="flex justify-between text-xs">
                              <span className="font-mono font-semibold text-sky-700 dark:text-sky-400">
                                {p.projectCode} ·{' '}
                                {p.principalInvestigatorId === targetScientist.id
                                  ? 'Principal Investigator'
                                  : 'Co-Investigator'}
                              </span>
                              <span className="font-mono">
                                {p.status} ({p.progressPercent}%)
                              </span>
                            </div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                              {p.title}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Click to update milestones, activities, or documents →
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Scientist Reports, Outputs & Grants */}
                  <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Reports, Research Outputs & Linked Grants ({sciFunding.length} grants)
                      </h3>
                      <button
                        type="button"
                        onClick={onOpenNewReport}
                        className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
                      >
                        + Submit Report
                      </button>
                    </div>

                    <div className="space-y-2">
                      {sciReports.slice(0, 4).map((r) => (
                        <div
                          key={r.id}
                          className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs flex justify-between"
                        >
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white">
                              {r.title}
                            </div>
                            <div className="text-slate-500">
                              {r.reportType} · Due {r.dueDate}
                            </div>
                          </div>
                          <span className="font-mono font-semibold">
                            {r.status}
                          </span>
                        </div>
                      ))}
                      {sciOutputs.slice(0, 4).map((o) => (
                        <div
                          key={o.id}
                          className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                        >
                          <div className="font-medium text-slate-900 dark:text-white">
                            [{o.outputType}] {o.title}
                          </div>
                          <div className="text-slate-500">
                            {o.journalOrEvent || 'KMFRI Repository'} · {o.publicationDate}
                          </div>
                        </div>
                      ))}
                      {sciReports.length === 0 && sciOutputs.length === 0 && (
                        <p className="text-xs text-slate-500 py-4">
                          No reports or research outputs filed yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* =====================================================================
          MODE 3: HEAD OF OCEANS & COASTAL SYSTEMS DEDICATED DASHBOARD
      ===================================================================== */}
      {dashboardMode === 'OCS_HEAD' && (
        <div className="space-y-6">
          {(() => {
            const ocsId = ocsDirectorate?.id;
            const ocsResearchers = data.users.filter(
              (u) => !ocsId || u.directorateId === ocsId
            );
            const ocsProjects = data.projects.filter(
              (p) => !ocsId || p.directorateId === ocsId
            );
            const ocsProjIds = new Set(ocsProjects.map((p) => p.id));
            const ocsFunding = data.funding.filter((f) =>
              ocsProjIds.has(f.projectId)
            );
            const ocsReports = data.reports.filter((r) =>
              ocsProjIds.has(r.projectId)
            );
            const ocsOverdue = ocsReports.filter((r) =>
              isReportOverdue(r.dueDate, r.status)
            );
            const ocsOutputs = data.researchOutputs.filter(
              (o) => !o.projectId || ocsProjIds.has(o.projectId)
            );
            const ocsAreas = data.researchAreas.filter(
              (ra) => !ocsId || ra.directorateId === ocsId
            );

            const totalReceivedKES = ocsFunding.reduce(
              (s, f) => s + normalizeCurrencyToKES(f.amount, f.currency),
              0
            );
            const totalAllocatedKES = ocsFunding.reduce(
              (s, f) => s + normalizeCurrencyToKES(f.allocatedAmount, f.currency),
              0
            );

            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="text-xs text-slate-500">OCS Researchers</div>
                    <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white mt-1">
                      {ocsResearchers.length}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Marine & Coastal Staff
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="text-xs text-slate-500">Directorate Projects</div>
                    <div className="text-2xl font-mono font-bold text-sky-700 dark:text-sky-400 mt-1">
                      {ocsProjects.length}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Avg progress:{' '}
                      {ocsProjects.length > 0
                        ? Math.round(
                            ocsProjects.reduce(
                              (s, p) => s + p.progressPercent,
                              0
                            ) / ocsProjects.length
                          )
                        : 0}
                      %
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="text-xs text-slate-500">Funding Received vs Allocated</div>
                    <div className="text-lg font-mono font-bold text-teal-700 dark:text-teal-400 mt-1">
                      KES {totalReceivedKES.toLocaleString()}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-1">
                      Allocated: KES {totalAllocatedKES.toLocaleString()}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="text-xs text-slate-500">Overdue / Pending Reports</div>
                    <div className="text-2xl font-mono font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {ocsOverdue.length}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        / {ocsReports.length} total
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Directorate review queue
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="text-xs text-slate-500">OCS Research Outputs</div>
                    <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white mt-1">
                      {ocsOutputs.length}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Publications & datasets
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Projects by OCS Research Area */}
                  <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Oceans & Coastal Systems — Projects by Thematic Research Area
                    </h3>
                    <div className="space-y-3">
                      {ocsAreas.map((area) => {
                        const count = ocsProjects.filter(
                          (p) => p.researchAreaId === area.id
                        ).length;
                        const pct =
                          ocsProjects.length > 0
                            ? Math.round((count / ocsProjects.length) * 100)
                            : 0;
                        return (
                          <div key={area.id} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                {area.name}
                              </span>
                              <span className="font-mono tabular-nums text-slate-500">
                                {count} projects ({pct}%)
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-teal-600"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Scientist Workload Distribution */}
                  <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      OCS Researcher Workload & Project Assignments
                    </h3>
                    <div className="space-y-2.5 max-h-64 overflow-y-auto">
                      {ocsResearchers.map((sci) => {
                        const ledCount = ocsProjects.filter(
                          (p) => p.principalInvestigatorId === sci.id
                        ).length;
                        const memberCount = data.projectMembers.filter(
                          (pm) => pm.userId === sci.id
                        ).length;
                        const hours = data.researchActivities
                          .filter((a) => a.scientistId === sci.id)
                          .reduce((s, a) => s + Number(a.hours || 0), 0);
                        return (
                          <div
                            key={sci.id}
                            className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {sci.fullName}
                              </div>
                              <div className="text-slate-500">
                                {sci.staffNumber} · {sci.position || 'Research Scientist'}
                              </div>
                            </div>
                            <div className="text-right font-mono">
                              <div className="text-sky-700 dark:text-sky-400 font-semibold">
                                {ledCount} PI · {memberCount} Team
                              </div>
                              <div className="text-slate-500">{hours} hrs logged</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};
