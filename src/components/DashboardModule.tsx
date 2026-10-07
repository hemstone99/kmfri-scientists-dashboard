import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Coins,
  Download,
  Filter,
  FolderKanban,
  MapPin,
  Plus,
  RotateCcw,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  PermissionCode,
  Project,
  ProjectStatus,
  ReportStatus,
  UserProfile,
} from '../types/kmfri.ts';
import { GisMapCanvas } from './GisMapCanvas.tsx';
import { ExecutiveDashboard } from './ExecutiveDashboard.tsx';
import { exportToCSV, exportToExcel, exportToInstitutionalReportHTML } from '../utils/exportUtils.ts';

const OCS_DIRECTORATE_ID = '30000000-0000-4000-8000-000000000001';
const CHART_COLORS = ['#0284c7', '#0d9488', '#0a2540', '#2563eb', '#d97706', '#e11d48'];

export function DashboardModule() {
  const {
    db,
    user,
    dashboardMode,
    setDashboardMode,
    setActiveModule,
    setSelectedProjectId,
    setSelectedScientistId,
    hasPermission,
  } = useAuth();

  // Global Dashboard Filters
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<'KES' | 'USD' | 'EUR' | 'GBP'>('KES');
  const [directorateFilter, setDirectorateFilter] = useState<string>('all');
  const [scientistFilter, setScientistFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [funderFilter, setFunderFilter] = useState<string>('all');
  const [researchAreaFilter, setResearchAreaFilter] = useState<string>('all');

  // Interactive Drill-down State: KPI -> Project -> Scientist -> Activity/Report
  const [drillKpi, setDrillKpi] = useState<string | null>(null);
  const [drillProject, setDrillProject] = useState<Project | null>(null);
  const [drillScientist, setDrillScientist] = useState<UserProfile | null>(null);

  // Determine effective directorate scope if in Head of OCS mode
  const effectiveDirectorateFilter =
    dashboardMode === 'ocs' ? OCS_DIRECTORATE_ID : directorateFilter;

  const operationalScientists = useMemo(() => {
    return db?.users.filter((u) => u.is_operational_scientist) || [];
  }, [db?.users]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    if (db) {
      db.projects.forEach((p) => {
        if (p.start_date) years.add(p.start_date.slice(0, 4));
      });
      db.funding.forEach((f) => {
        if (f.award_date) years.add(f.award_date.slice(0, 4));
      });
    }
    return Array.from(years).sort().reverse();
  }, [db?.projects, db?.funding]);

  const filteredProjects = useMemo(() => {
    if (!db) return [];
    return db.projects.filter((p) => {
      if (p.is_archived) return false;
      if (effectiveDirectorateFilter !== 'all' && p.directorate_id !== effectiveDirectorateFilter)
        return false;
      if (researchAreaFilter !== 'all' && p.research_area_id !== researchAreaFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (funderFilter !== 'all' && p.primary_funder_id !== funderFilter) return false;
      if (yearFilter !== 'all' && !p.start_date.startsWith(yearFilter)) return false;
      if (scientistFilter !== 'all') {
        const isPi = p.principal_investigator_id === scientistFilter;
        const isMember = db.project_members.some(
          (pm) => pm.project_id === p.id && pm.user_id === scientistFilter
        );
        if (!isPi && !isMember) return false;
      }
      return true;
    });
  }, [
    db,
    effectiveDirectorateFilter,
    researchAreaFilter,
    statusFilter,
    funderFilter,
    yearFilter,
    scientistFilter,
  ]);

  const filteredProjectIds = useMemo(
    () => new Set(filteredProjects.map((p) => p.id)),
    [filteredProjects]
  );

  const filteredScientists = useMemo(() => {
    return operationalScientists.filter((s) => {
      if (effectiveDirectorateFilter !== 'all' && s.directorate_id !== effectiveDirectorateFilter)
        return false;
      if (researchAreaFilter !== 'all' && s.research_area_id !== researchAreaFilter) return false;
      if (scientistFilter !== 'all' && s.id !== scientistFilter) return false;
      return true;
    });
  }, [operationalScientists, effectiveDirectorateFilter, researchAreaFilter, scientistFilter]);

  const filteredFunding = useMemo(() => {
    if (!db) return [];
    return db.funding.filter((g) => {
      if (g.currency !== currencyFilter) return false;
      if (funderFilter !== 'all' && g.funder_id !== funderFilter) return false;
      if (yearFilter !== 'all' && !g.award_date.startsWith(yearFilter)) return false;
      if (!filteredProjectIds.has(g.project_id)) return false;
      return true;
    });
  }, [db, currencyFilter, funderFilter, yearFilter, filteredProjectIds]);

  const filteredReports = useMemo(() => {
    if (!db) return [];
    return db.reports.filter((r) => {
      if (scientistFilter !== 'all' && r.scientist_id !== scientistFilter) return false;
      if (effectiveDirectorateFilter !== 'all' && !filteredProjectIds.has(r.project_id)) return false;
      return true;
    });
  }, [db, scientistFilter, effectiveDirectorateFilter, filteredProjectIds]);

  const filteredLocations = useMemo(() => {
    if (!db) return [];
    if (effectiveDirectorateFilter === 'all' && statusFilter === 'all' && scientistFilter === 'all') {
      return db.locations;
    }
    const linkedLocIds = new Set(
      db.project_locations
        .filter((pl) => filteredProjectIds.has(pl.project_id))
        .map((pl) => pl.location_id)
    );
    return db.locations.filter(
      (l) =>
        linkedLocIds.has(l.id) ||
        (dashboardMode === 'ocs' && l.marine_coastal_area !== 'Freshwater Lake')
    );
  }, [db, effectiveDirectorateFilter, statusFilter, scientistFilter, filteredProjectIds, dashboardMode]);

  // Core KPI Calculations
  const totalScientistsCount = filteredScientists.length;
  const activeProjectsCount = filteredProjects.filter(
    (p) => p.status === ProjectStatus.APPROVED || p.status === ProjectStatus.IN_PROGRESS
  ).length;
  const inProgressProjectsCount = filteredProjects.filter(
    (p) => p.status === ProjectStatus.IN_PROGRESS
  ).length;
  const completedProjectsCount = filteredProjects.filter(
    (p) => p.status === ProjectStatus.COMPLETED
  ).length;
  const pendingOrOverdueReportsCount = filteredReports.filter(
    (r) =>
      r.is_overdue ||
      r.status === ReportStatus.SUBMITTED ||
      r.status === ReportStatus.UNDER_REVIEW ||
      r.status === ReportStatus.DRAFT
  ).length;
  const overdueReportsCount = filteredReports.filter((r) => r.is_overdue).length;
  const totalFundingAllocated = filteredFunding.reduce((acc, g) => acc + g.allocated_amount, 0);
  const totalFundingSpent = filteredFunding.reduce((acc, g) => acc + g.spent_amount, 0);

  // Analytics Series
  const projectsByDirectorateData = useMemo(() => {
    if (!db) return [];
    return db.directorates.map((dir) => {
      const count = filteredProjects.filter((p) => p.directorate_id === dir.id).length;
      return {
        code: dir.code,
        name: dir.name,
        projects: count,
      };
    });
  }, [db, filteredProjects]);

  const projectsByStatusData = useMemo(() => {
    const statuses = Object.values(ProjectStatus);
    return statuses.map((st) => ({
      name: st,
      value: filteredProjects.filter((p) => p.status === st).length,
    }));
  }, [filteredProjects]);

  const projectsByResearchAreaData = useMemo(() => {
    if (!db) return [];
    const areas =
      dashboardMode === 'ocs'
        ? db.research_areas.filter((a) => a.directorate_id === OCS_DIRECTORATE_ID)
        : db.research_areas;
    return areas.map((area) => ({
      code: area.code,
      name: area.name,
      projects: filteredProjects.filter((p) => p.research_area_id === area.id).length,
    }));
  }, [db, filteredProjects, dashboardMode]);

  const fundingBySourceData = useMemo(() => {
    if (!db) return [];
    const map = new Map<string, number>();
    filteredFunding.forEach((g) => {
      const funder = db.funders.find((f) => f.id === g.funder_id);
      const label = funder ? funder.name : 'Unassigned Source';
      map.set(label, (map.get(label) || 0) + g.allocated_amount);
    });
    return Array.from(map.entries()).map(([name, amount]) => ({ name, amount }));
  }, [filteredFunding, db]);

  const annualTrendsData = useMemo(() => {
    const years = ['2023', '2024', '2025', '2026'];
    return years.map((yr) => {
      const yrProjects = filteredProjects.filter((p) => p.start_date.startsWith(yr));
      const yrCompleted = filteredProjects.filter(
        (p) => p.status === ProjectStatus.COMPLETED && p.end_date.startsWith(yr)
      );
      const yrFunding = filteredFunding
        .filter((g) => g.award_date.startsWith(yr))
        .reduce((sum, g) => sum + g.allocated_amount, 0);
      return {
        year: yr,
        initiated: yrProjects.length,
        completed: yrCompleted.length,
        fundingKES: yrFunding,
      };
    });
  }, [filteredProjects, filteredFunding]);

  // OCS Scientist Workload Matrix
  const ocsWorkloadData = useMemo(() => {
    if (!db) return [];
    return filteredScientists.map((s) => {
      const ledCount = db.projects.filter((p) => p.principal_investigator_id === s.id).length;
      const memberCount = db.project_members.filter((m) => m.user_id === s.id).length;
      const reportsCount = db.reports.filter((r) => r.scientist_id === s.id).length;
      const outputsCount = db.research_outputs.filter((o) => o.lead_scientist_id === s.id).length;
      return {
        scientist: s,
        ledCount,
        memberCount,
        reportsCount,
        outputsCount,
      };
    });
  }, [filteredScientists, db]);

  if (!db) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mx-auto" />
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Loading KMFRI Intelligence Data...
          </div>
        </div>
      </div>
    );
  }

  const resetFilters = () => {
    setYearFilter('all');
    setCurrencyFilter('KES');
    setDirectorateFilter('all');
    setScientistFilter('all');
    setStatusFilter('all');
    setFunderFilter('all');
    setResearchAreaFilter('all');
    setDrillKpi(null);
    setDrillProject(null);
    setDrillScientist(null);
  };

  const handleExportSummary = (format: 'csv' | 'excel' | 'pdf') => {
    const rows = filteredProjects.map((p) => {
      const dir = db.directorates.find((d) => d.id === p.directorate_id);
      const pi = db.users.find((u) => u.id === p.principal_investigator_id);
      return {
        Project_Code: p.project_code,
        Title: p.title,
        Directorate: dir?.code || '—',
        Principal_Investigator: pi ? `${pi.title} ${pi.full_name}` : '—',
        Status: p.status,
        Priority: p.priority,
        Progress_Percent: `${p.progress_percent}%`,
        Budget: `${p.currency} ${p.budget.toLocaleString()}`,
        Start_Date: p.start_date,
        End_Date: p.end_date,
      };
    });
    if (format === 'csv') exportToCSV('kmfri_dashboard_portfolio', rows);
    if (format === 'excel') exportToExcel('kmfri_dashboard_portfolio', 'Portfolio', rows);
    if (format === 'pdf') {
      exportToInstitutionalReportHTML(
        'kmfri_dashboard_portfolio',
        dashboardMode === 'ocs'
          ? 'Oceans & Coastal Systems Directorate Portfolio Report'
          : 'KMFRI Institution-Wide Research Portfolio Report',
        `Generated by ${user?.full_name} (${user?.role_code})`,
        rows
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Mode Switcher & Export Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Kenya Marine and Fisheries Research Institute</span>
            <span>·</span>
            <span>Executive &amp; Directorate Intelligence</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
            {dashboardMode === 'institution'
              ? 'Director General’s Office — KMFRI CEO Dashboard'
              : dashboardMode === 'ocs'
              ? 'Head of Oceans & Coastal Systems — Directorate Dashboard'
              : 'Scientist Research Operations Workspace'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Interactive Dashboard Mode Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setDashboardMode('institution')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                dashboardMode === 'institution'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              Institution-Wide
            </button>
            <button
              type="button"
              onClick={() => setDashboardMode('ocs')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                dashboardMode === 'ocs'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              Oceans &amp; Coastal Systems (OCS)
            </button>
            <button
              type="button"
              onClick={() => {
                setDashboardMode('scientist');
                setActiveModule('scientists');
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                dashboardMode === 'scientist'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              Scientist Dashboard
            </button>
          </div>

          {hasPermission(PermissionCode.EXPORT_DATA) && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleExportSummary('csv')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportSummary('excel')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportSummary('pdf')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Report</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Filter className="w-3.5 h-3.5 text-sky-600" />
            <span>Portfolio Filters (Year · Directorate · Scientist · Status · Funder · Research Area)</span>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs text-sky-700 dark:text-sky-400 hover:underline flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-3">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Year</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              <option value="all">All Years</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Directorate</label>
            <select
              value={effectiveDirectorateFilter}
              disabled={dashboardMode === 'ocs'}
              onChange={(e) => setDirectorateFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg disabled:opacity-60"
            >
              <option value="all">All Directorates</option>
              {db.directorates.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Research Area</label>
            <select
              value={researchAreaFilter}
              onChange={(e) => setResearchAreaFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              <option value="all">All Research Areas</option>
              {db.research_areas
                .filter(
                  (ra) =>
                    effectiveDirectorateFilter === 'all' ||
                    ra.directorate_id === effectiveDirectorateFilter
                )
                .map((ra) => (
                  <option key={ra.id} value={ra.id}>
                    {ra.code} — {ra.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Scientist</label>
            <select
              value={scientistFilter}
              onChange={(e) => setScientistFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              <option value="all">All Scientists</option>
              {operationalScientists.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} {s.full_name} ({s.staff_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Project Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              <option value="all">All Statuses</option>
              {Object.values(ProjectStatus).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Funder</label>
            <select
              value={funderFilter}
              onChange={(e) => setFunderFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              <option value="all">All Funders</option>
              {db.funders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Funding Currency</label>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value as typeof currencyFilter)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              <option value="KES">KES</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>
      </div>

      {dashboardMode === 'institution' ? (
        <ExecutiveDashboard
          db={db}
          projects={filteredProjects}
          funding={filteredFunding}
          reports={filteredReports}
          currency={currencyFilter}
          onSelectDirectorate={setDirectorateFilter}
          onOpenProject={(projectId) => {
            setSelectedProjectId(projectId);
            setActiveModule('projects');
          }}
          onOpenModule={setActiveModule}
        />
      ) : (
        <>
      {/* 6 Core KPI Cards with Interactive Drill-Down */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <button
          type="button"
          onClick={() => {
            setDrillKpi('scientists');
            setDrillProject(null);
            setDrillScientist(null);
          }}
          className={`text-left p-4 rounded-xl border transition-colors ${
            drillKpi === 'scientists'
              ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-500'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Scientists</span>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {totalScientistsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>Click to drill down</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setDrillKpi('active_projects');
            setDrillProject(null);
            setDrillScientist(null);
          }}
          className={`text-left p-4 rounded-xl border transition-colors ${
            drillKpi === 'active_projects'
              ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-500'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Active Projects</span>
            <FolderKanban className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {activeProjectsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Approved &amp; In Progress
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setDrillKpi('in_progress');
            setDrillProject(null);
            setDrillScientist(null);
          }}
          className={`text-left p-4 rounded-xl border transition-colors ${
            drillKpi === 'in_progress'
              ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-500'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>In Progress</span>
            <CalendarClock className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {inProgressProjectsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Active field &amp; lab execution
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setDrillKpi('completed');
            setDrillProject(null);
            setDrillScientist(null);
          }}
          className={`text-left p-4 rounded-xl border transition-colors ${
            drillKpi === 'completed'
              ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-500'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Completed Projects</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {completedProjectsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Closed &amp; deliverables verified
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setDrillKpi('reports');
            setDrillProject(null);
            setDrillScientist(null);
          }}
          className={`text-left p-4 rounded-xl border transition-colors ${
            drillKpi === 'reports'
              ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-500'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Pending / Overdue Reports</span>
            <AlertTriangle
              className={`w-4 h-4 ${overdueReportsCount > 0 ? 'text-rose-600' : 'text-amber-600'}`}
            />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {pendingOrOverdueReportsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
            {overdueReportsCount} Overdue
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setDrillKpi('funding');
            setDrillProject(null);
            setDrillScientist(null);
          }}
          className={`text-left p-4 rounded-xl border transition-colors ${
            drillKpi === 'funding'
              ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-500'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Funding</span>
            <Coins className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-xl font-mono font-bold text-slate-900 dark:text-white mt-2 tabular-nums truncate">
            {totalFundingAllocated.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
            Spent: {totalFundingSpent.toLocaleString()}
          </div>
        </button>
      </div>

      {/* Interactive Drill-Down Explorer (KPI -> Project -> Scientist -> Activity/Report) */}
      {drillKpi && (
        <div className="bg-white dark:bg-slate-900 border border-sky-500/50 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white flex-wrap">
              <span className="text-sky-700 dark:text-sky-400">Drill-Down Explorer:</span>
              <button
                type="button"
                onClick={() => {
                  setDrillProject(null);
                  setDrillScientist(null);
                }}
                className="hover:underline font-mono"
              >
                KPI [{drillKpi.toUpperCase()}]
              </button>
              {drillProject && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setDrillScientist(null)}
                    className="hover:underline font-mono text-teal-700 dark:text-teal-400"
                  >
                    Project [{drillProject.project_code}]
                  </button>
                </>
              )}
              {drillScientist && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono text-sky-700 dark:text-sky-300">
                    Scientist [{drillScientist.staff_number} — {drillScientist.full_name}]
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setDrillKpi(null);
                setDrillProject(null);
                setDrillScientist(null);
              }}
              className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              Close Drill-Down
            </button>
          </div>

          {/* Step 1: Select Project (or Scientist if KPI === scientists) */}
          {!drillProject && !drillScientist && (
            <div>
              {filteredProjects.length === 0 && filteredScientists.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  No operational records exist yet for this KPI. Use the quick actions below to create your first scientist or project.
                </div>
              ) : drillKpi === 'scientists' ? (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-500">
                    Select a Scientist to inspect their projects, reports, and field activities:
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {filteredScientists.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setDrillScientist(s)}
                        className="text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-sky-500 transition-colors"
                      >
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          {s.title} {s.full_name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {s.staff_number} · {s.position}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-500">
                    Step 1 — Select a Project to drill down into assigned Scientists, Activities, and Reports:
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredProjects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setDrillProject(p)}
                        className="text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-sky-500 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-mono font-semibold text-sky-700 dark:text-sky-400">
                            {p.project_code} · {p.status}
                          </div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5">
                            {p.title}
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Project selected -> Select Scientist */}
          {drillProject && !drillScientist && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    {drillProject.project_code} — {drillProject.title}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Step 2 — Select a Project Team Scientist to inspect their project reports &amp; activities:
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProjectId(drillProject.id);
                    setActiveModule('projects');
                  }}
                  className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
                >
                  Open Full Project Workspace →
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {db.users
                  .filter(
                    (u) =>
                      u.id === drillProject.principal_investigator_id ||
                      db.project_members.some(
                        (pm) => pm.project_id === drillProject.id && pm.user_id === u.id
                      )
                  )
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setDrillScientist(s)}
                      className="text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-teal-500 transition-colors"
                    >
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        {s.title} {s.full_name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {s.staff_number} ·{' '}
                        {s.id === drillProject.principal_investigator_id
                          ? 'Principal Investigator'
                          : 'Team Scientist'}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Step 3: Scientist selected -> Inspect Activities & Reports */}
          {drillScientist && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    Submitted &amp; Pending Reports ({drillScientist.full_name})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedScientistId(drillScientist.id);
                      setActiveModule('scientists');
                    }}
                    className="text-[11px] text-sky-700 dark:text-sky-400 hover:underline"
                  >
                    Open Scientist Profile →
                  </button>
                </div>
                {db.reports.filter((r) => r.scientist_id === drillScientist.id).length === 0 ? (
                  <p className="text-xs text-slate-500">No reports logged for this scientist yet.</p>
                ) : (
                  <div className="space-y-2">
                    {db.reports
                      .filter((r) => r.scientist_id === drillScientist.id)
                      .map((r) => (
                        <div
                          key={r.id}
                          className="text-xs flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                        >
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {r.title}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {r.status} · Due {r.due_date}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="text-xs font-semibold text-slate-900 dark:text-white mb-2">
                  Field &amp; Lab Research Activities ({drillScientist.full_name})
                </div>
                {db.research_activities.filter((a) => a.scientist_id === drillScientist.id).length ===
                0 ? (
                  <p className="text-xs text-slate-500">No research activities logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {db.research_activities
                      .filter((a) => a.scientist_id === drillScientist.id)
                      .map((a) => (
                        <div
                          key={a.id}
                          className="text-xs flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                        >
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {a.title}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {a.activity_type} · {a.activity_date}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty Operational State Banner (When no operational records have been created yet) */}
      {operationalScientists.length === 0 && db.projects.length === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-teal-700 dark:text-teal-400">
              Production Reference Baseline Ready · Zero Fake Operational Data
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
              Operational Registry is Ready for First Entries
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Roles (6), permissions (17), KMFRI directorates (5), research areas (8), and system settings are seeded. Begin by registering operational scientists, creating research projects, recording grant funding, or plotting GIS stations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveModule('scientists')}
              className="px-3.5 py-2 rounded-lg bg-[#0A2540] hover:bg-sky-900 dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Scientist</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModule('projects')}
              className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Project</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModule('locations')}
              className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Add GIS Site</span>
            </button>
          </div>
        </div>
      )}

      {/* Analytics Row 1: Projects by Directorate/Area & Projects by Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {dashboardMode === 'ocs'
                  ? 'OCS Projects by Marine Research Area'
                  : 'Projects Distribution by KMFRI Directorate'}
              </h3>
              <p className="text-xs text-slate-500">
                Active project count across seeded institutional divisions
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {filteredProjects.length} Total Projects
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={
                  dashboardMode === 'ocs'
                    ? projectsByResearchAreaData
                    : projectsByDirectorateData
                }
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="code" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="projects" name="Projects" fill="#0284c7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Projects by Lifecycle Status
            </h3>
            <p className="text-xs text-slate-500">
              Proposed · Approved · In Progress · Completed
            </p>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
              <FolderKanban className="w-6 h-6 text-slate-400 mb-2" />
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                No Projects Created Yet
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Status breakdown will populate once projects are registered.
              </div>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectsByStatusData.filter((d) => d.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    label
                  >
                    {projectsByStatusData.map((_entry, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Row 2: Funding by Source & Annual Funding/Completion Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Funding Allocation by Funder Source
              </h3>
              <p className="text-xs text-slate-500">
                Grant volume grouped by bilateral, multilateral, and government funders
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModule('funding')}
              className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
            >
              Manage Grants →
            </button>
          </div>

          {fundingBySourceData.length === 0 ? (
            <div className="h-60 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
              <Coins className="w-6 h-6 text-slate-400 mb-2" />
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                No Grant Awards Recorded Yet
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Register funders and grants in the Funding module to view source analytics.
              </div>
            </div>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fundingBySourceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="amount" name="Allocated Amount" fill="#0d9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Annual Project Initiation &amp; Completion Trends
            </h3>
            <p className="text-xs text-slate-500">
              Multi-year trajectory of initiated vs completed research projects
            </p>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={annualTrendsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="initiated"
                  name="Projects Initiated"
                  stroke="#0284c7"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  name="Projects Completed"
                  stroke="#0d9488"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Head of Oceans & Coastal Systems Dedicated Workload & Progress Matrix */}
      {dashboardMode === 'ocs' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Oceans &amp; Coastal Systems (OCS) — Scientist Workload &amp; Output Matrix
              </h3>
              <p className="text-xs text-slate-500">
                Dedicated directorate supervision view for Head of Oceans &amp; Coastal Systems
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModule('scientists')}
              className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
            >
              Manage OCS Scientists →
            </button>
          </div>

          {ocsWorkloadData.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
              <p className="text-xs text-slate-500">
                No operational scientists assigned to the Oceans &amp; Coastal Systems directorate yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 px-3 font-medium">Scientist</th>
                    <th className="py-2.5 px-3 font-medium">Staff No.</th>
                    <th className="py-2.5 px-3 font-medium text-right">Projects Led (PI)</th>
                    <th className="py-2.5 px-3 font-medium text-right">Team Assignments</th>
                    <th className="py-2.5 px-3 font-medium text-right">Reports Logged</th>
                    <th className="py-2.5 px-3 font-medium text-right">Research Outputs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ocsWorkloadData.map((row) => (
                    <tr key={row.scientist.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                        {row.scientist.title} {row.scientist.full_name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {row.scientist.staff_number}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums">
                        {row.ledCount}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums">
                        {row.memberCount}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums">
                        {row.reportsCount}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums">
                        {row.outputsCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* GIS Project Locations Map & Deadlines / Overdue Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                GIS Project Sampling Stations &amp; Coastal Sites
              </h3>
              <p className="text-xs text-slate-500">
                Spatial distribution across Kenyan EEZ, inshore reefs, mangrove creeks, and inland lakes
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModule('locations')}
              className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
            >
              Open Full GIS Console →
            </button>
          </div>
          <GisMapCanvas
            locations={filteredLocations}
            projects={filteredProjects}
            heightClass="h-[460px]"
          />
        </div>

        {/* Deadlines & Reports Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Reporting Deadlines &amp; Milestones
              </h3>
              <button
                type="button"
                onClick={() => setActiveModule('reports')}
                className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
              >
                All Reports →
              </button>
            </div>

            {filteredReports.length === 0 && db.project_milestones.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <ClipboardCheck className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  No Pending Deadlines
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Report due dates and project milestones will appear here automatically.
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {filteredReports.slice(0, 6).map((rep) => (
                  <div
                    key={rep.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                        {rep.title}
                      </span>
                      <span
                        className={`font-mono text-[11px] ${
                          rep.is_overdue ? 'text-rose-600 font-semibold' : 'text-slate-500'
                        }`}
                      >
                        {rep.is_overdue ? 'OVERDUE' : rep.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between font-mono">
                      <span>{rep.report_type}</span>
                      <span>Due: {rep.due_date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Activities, Research Outputs & Collaborators */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activities */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Recent Research Activities
            </h3>
            <span className="text-xs font-mono text-slate-500">
              {db.research_activities.length} Logged
            </span>
          </div>
          {db.research_activities.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-500">
                No field cruises or lab activities recorded yet.
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {db.research_activities.slice(0, 5).map((act) => (
                <div
                  key={act.id}
                  className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs"
                >
                  <div className="font-semibold text-slate-900 dark:text-white">{act.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                    {act.activity_type} · {act.activity_date} · {act.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Research Outputs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Recent Research Outputs
            </h3>
            <button
              type="button"
              onClick={() => setActiveModule('outputs')}
              className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
            >
              View Outputs →
            </button>
          </div>
          {db.research_outputs.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <BookOpen className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
              <div className="text-xs text-slate-500">
                No peer-reviewed publications or datasets catalogued yet.
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {db.research_outputs.slice(0, 5).map((out) => (
                <div
                  key={out.id}
                  className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs"
                >
                  <div className="font-semibold text-slate-900 dark:text-white truncate">
                    {out.title}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {out.output_type} · {out.journal_or_event} · {out.publication_date}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Collaborators */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Institutional Collaborators
            </h3>
            <button
              type="button"
              onClick={() => setActiveModule('collaborators')}
              className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
            >
              Manage MOUs →
            </button>
          </div>
          {db.collaborators.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <Building2 className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
              <div className="text-xs text-slate-500">
                No external partner institutions registered yet.
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {db.collaborators.slice(0, 5).map((col) => (
                <div
                  key={col.id}
                  className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs"
                >
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {col.organization_name}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {col.country} · {col.organization_type} · MOU: {col.mou_status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
