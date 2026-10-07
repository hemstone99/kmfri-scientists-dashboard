import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FileWarning,
  FolderKanban,
  ShieldAlert,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DatabaseSnapshot,
  FundingGrant,
  NavigationModule,
  Project,
  ProjectStatus,
  ReportStatus,
} from '../types/kmfri.ts';

type HealthStatus = 'On track' | 'At risk' | 'Delayed' | 'Planned';

interface ExecutiveDashboardProps {
  db: DatabaseSnapshot;
  projects: Project[];
  funding: FundingGrant[];
  reports: DatabaseSnapshot['reports'];
  currency: FundingGrant['currency'];
  onSelectDirectorate: (id: string) => void;
  onOpenProject: (id: string) => void;
  onOpenModule: (module: NavigationModule) => void;
}

const HEALTH_STYLES: Record<HealthStatus, string> = {
  'On track': 'text-emerald-700 dark:text-emerald-300',
  'At risk': 'text-amber-700 dark:text-amber-300',
  Delayed: 'text-rose-700 dark:text-rose-300',
  Planned: 'text-sky-700 dark:text-sky-300',
};

const HEALTH_COLORS: Record<HealthStatus, string> = {
  'On track': '#059669',
  'At risk': '#d97706',
  Delayed: '#e11d48',
  Planned: '#0284c7',
};

function projectHealth(
  project: Project,
  milestones: DatabaseSnapshot['project_milestones'],
  today: string
): HealthStatus {
  if (project.status === ProjectStatus.PROPOSED || project.start_date > today) return 'Planned';

  const hasOverdueMilestone = milestones.some(
    (milestone) =>
      milestone.project_id === project.id &&
      milestone.status !== 'Completed' &&
      milestone.due_date < today
  );
  if (project.end_date < today || hasOverdueMilestone) return 'Delayed';

  const start = new Date(`${project.start_date}T00:00:00`).getTime();
  const end = new Date(`${project.end_date}T00:00:00`).getTime();
  const now = new Date(`${today}T00:00:00`).getTime();
  const duration = Math.max(1, end - start);
  const elapsed = Math.min(1, Math.max(0, (now - start) / duration));
  const materiallyBehindSchedule = project.progress_percent < elapsed * 100 - 20;

  return project.risks_issues?.trim() || materiallyBehindSchedule ? 'At risk' : 'On track';
}

function formatMoney(value: number, currency: FundingGrant['currency']): string {
  return `${currency} ${new Intl.NumberFormat('en-KE', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)}`;
}

function percent(numerator: number, denominator: number): string {
  if (!denominator) return '—';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function Panel({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg ${className}`}
    >
      {children}
    </section>
  );
}

export function ExecutiveDashboard({
  db,
  projects,
  funding,
  reports,
  currency,
  onSelectDirectorate,
  onOpenProject,
  onOpenModule,
}: ExecutiveDashboardProps) {
  const today = new Date().toISOString().slice(0, 10);
  const activeProjects = projects.filter(
    (project) =>
      project.status === ProjectStatus.APPROVED ||
      project.status === ProjectStatus.IN_PROGRESS
  );
  const deliveryProjects = projects.filter(
    (project) =>
      project.status === ProjectStatus.APPROVED ||
      project.status === ProjectStatus.IN_PROGRESS ||
      project.status === ProjectStatus.PROPOSED
  );
  const activeProjectIds = new Set(activeProjects.map((project) => project.id));
  const relevantMilestones = db.project_milestones.filter((milestone) =>
    projects.some((project) => project.id === milestone.project_id)
  );
  const completedMilestones = relevantMilestones.filter(
    (milestone) => milestone.status === 'Completed' && milestone.completed_date
  );
  const completedOnTime = completedMilestones.filter(
    (milestone) => milestone.completed_date! <= milestone.due_date
  );
  const overdueMilestones = relevantMilestones.filter(
    (milestone) => milestone.status !== 'Completed' && milestone.due_date < today
  );
  const allocated = funding.reduce((sum, grant) => sum + grant.allocated_amount, 0);
  const spent = funding.reduce((sum, grant) => sum + grant.spent_amount, 0);
  const utilization = allocated > 0 ? Math.round((spent / allocated) * 100) : null;
  const overdueReports = reports.filter(
    (report) =>
      (report.is_overdue || report.due_date < today) &&
      report.status !== ReportStatus.APPROVED
  );

  const healthByProject = useMemo(() => {
    const health = new Map<string, HealthStatus>();
    deliveryProjects.forEach((project) => {
      health.set(project.id, projectHealth(project, db.project_milestones, today));
    });
    return health;
  }, [deliveryProjects, db.project_milestones, today]);

  const healthCounts = (projectSet: Project[]) => {
    const counts: Record<HealthStatus, number> = {
      'On track': 0,
      'At risk': 0,
      Delayed: 0,
      Planned: 0,
    };
    projectSet.forEach((project) => {
      const status = healthByProject.get(project.id);
      if (status) counts[status] += 1;
    });
    return counts;
  };

  const directorateRows = useMemo(() => {
    return db.directorates
      .filter((directorate) => directorate.is_active)
      .map((directorate) => {
        const directorateProjects = projects.filter(
          (project) => project.directorate_id === directorate.id
        );
        const directorateDelivery = deliveryProjects.filter(
          (project) => project.directorate_id === directorate.id
        );
        const statusCounts = healthCounts(directorateDelivery);
        const projectIds = new Set(directorateProjects.map((project) => project.id));
        const milestones = relevantMilestones.filter((milestone) =>
          projectIds.has(milestone.project_id)
        );
        const completed = milestones.filter(
          (milestone) => milestone.status === 'Completed' && milestone.completed_date
        );
        const onTime = completed.filter(
          (milestone) => milestone.completed_date! <= milestone.due_date
        ).length;
        const grants = funding.filter((grant) => projectIds.has(grant.project_id));

        return {
          directorate,
          projects: directorateProjects.length,
          scientists: db.users.filter(
            (user) =>
              user.is_active &&
              user.is_operational_scientist &&
              user.directorate_id === directorate.id
          ).length,
          statusCounts,
          deliveryCount: directorateDelivery.length,
          milestoneRate: completed.length ? Math.round((onTime / completed.length) * 100) : null,
          allocated: grants.reduce((sum, grant) => sum + grant.allocated_amount, 0),
          spent: grants.reduce((sum, grant) => sum + grant.spent_amount, 0),
          riskCount: directorateProjects.filter((project) => project.risks_issues?.trim()).length,
        };
      })
      .sort((a, b) => {
        const aRate = a.deliveryCount ? a.statusCounts['On track'] / a.deliveryCount : 1;
        const bRate = b.deliveryCount ? b.statusCounts['On track'] / b.deliveryCount : 1;
        return aRate - bRate || b.projects - a.projects;
      });
  }, [db, projects, funding, deliveryProjects, relevantMilestones, healthByProject]);

  const healthChartData = useMemo(
    () =>
      directorateRows.map((row) => ({
        code: row.directorate.code,
        directorateId: row.directorate.id,
        ...row.statusCounts,
      })),
    [directorateRows]
  );

  const fundingChartData = useMemo(
    () =>
      directorateRows.map((row) => ({
        code: row.directorate.code,
        directorateId: row.directorate.id,
        allocated: row.allocated,
        spent: row.spent,
      })),
    [directorateRows]
  );

  const riskProjects = projects
    .filter((project) => activeProjectIds.has(project.id) && project.risks_issues?.trim())
    .sort((a, b) => {
      const priority = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return priority[a.priority] - priority[b.priority];
    });

  const activeProjectHealth = healthCounts(activeProjects);
  const onTrackCount = activeProjectHealth['On track'];
  const riskCount = riskProjects.length;
  const portfolioHealthData = [
    { label: 'On track', value: onTrackCount, color: HEALTH_COLORS['On track'] },
    { label: 'At risk', value: activeProjectHealth['At risk'], color: HEALTH_COLORS['At risk'] },
    { label: 'Delayed', value: activeProjectHealth.Delayed, color: HEALTH_COLORS.Delayed },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <div className="text-[11px] font-semibold uppercase text-sky-700 dark:text-sky-400">
            Director General · Institutional oversight
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            Executive Overview
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Portfolio delivery, directorate performance, funding position, and reported exceptions.
          </p>
        </div>
        <span className="text-[11px] text-slate-500">Based on the latest loaded institutional records</span>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => document.getElementById('executive-portfolio')?.scrollIntoView({ behavior: 'smooth' })}
          className="text-left border-l-2 border-sky-600 bg-white dark:bg-slate-900 border-y border-r border-slate-200 dark:border-slate-800 rounded-r-lg px-4 py-3 hover:bg-sky-50/60 dark:hover:bg-slate-800/60"
        >
          <span className="flex items-center gap-2 text-xs text-slate-500"><FolderKanban className="w-4 h-4 text-sky-600" />Active portfolio</span>
          <span className="block mt-2 text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">{activeProjects.length}</span>
          <span className="text-[11px] text-slate-500">{onTrackCount} on track · {activeProjectHealth['At risk']} at risk · {activeProjectHealth.Delayed} delayed</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenModule('funding')}
          className="text-left border-l-2 border-teal-600 bg-white dark:bg-slate-900 border-y border-r border-slate-200 dark:border-slate-800 rounded-r-lg px-4 py-3 hover:bg-teal-50/60 dark:hover:bg-slate-800/60"
        >
          <span className="flex items-center gap-2 text-xs text-slate-500"><CircleDollarSign className="w-4 h-4 text-teal-600" />Allocated · {currency}</span>
          <span className="block mt-2 text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">{formatMoney(allocated, currency)}</span>
          <span className="text-[11px] text-slate-500">Spent {formatMoney(spent, currency)} · {utilization === null ? 'no allocation recorded' : `${utilization}% utilized`}</span>
        </button>
        <button
          type="button"
          onClick={() => document.getElementById('executive-delivery')?.scrollIntoView({ behavior: 'smooth' })}
          className="text-left border-l-2 border-emerald-600 bg-white dark:bg-slate-900 border-y border-r border-slate-200 dark:border-slate-800 rounded-r-lg px-4 py-3 hover:bg-emerald-50/60 dark:hover:bg-slate-800/60"
        >
          <span className="flex items-center gap-2 text-xs text-slate-500"><CheckCircle2 className="w-4 h-4 text-emerald-600" />Milestones on time</span>
          <span className="block mt-2 text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">{percent(completedOnTime.length, completedMilestones.length)}</span>
          <span className="text-[11px] text-slate-500">{overdueMilestones.length} open milestones past due</span>
        </button>
        <button
          type="button"
          onClick={() => document.getElementById('executive-exceptions')?.scrollIntoView({ behavior: 'smooth' })}
          className="text-left border-l-2 border-amber-600 bg-white dark:bg-slate-900 border-y border-r border-slate-200 dark:border-slate-800 rounded-r-lg px-4 py-3 hover:bg-amber-50/60 dark:hover:bg-slate-800/60"
        >
          <span className="flex items-center gap-2 text-xs text-slate-500"><ShieldAlert className="w-4 h-4 text-amber-600" />Projects with risk notes</span>
          <span className="block mt-2 text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">{riskCount}</span>
          <span className="text-[11px] text-slate-500">Severity is not captured in the current register</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenModule('reports')}
          className="text-left border-l-2 border-rose-600 bg-white dark:bg-slate-900 border-y border-r border-slate-200 dark:border-slate-800 rounded-r-lg px-4 py-3 hover:bg-rose-50/60 dark:hover:bg-slate-800/60"
        >
          <span className="flex items-center gap-2 text-xs text-slate-500"><FileWarning className="w-4 h-4 text-rose-600" />Overdue reports</span>
          <span className="block mt-2 text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">{overdueReports.length}</span>
          <span className="text-[11px] text-slate-500">Reporting deadlines only; not full compliance</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Directorate performance</h3>
              <p className="text-[11px] text-slate-500 mt-1">Delivery health across projects in delivery or proposal</p>
            </div>
            <Building2 className="w-4 h-4 text-sky-700 dark:text-sky-400" />
          </div>
          <div className="h-56" role="img" aria-label="Stacked project health by directorate">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={healthChartData} layout="vertical" margin={{ left: 8, right: 12, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="code" width={54} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="On track" stackId="health" fill={HEALTH_COLORS['On track']} />
                <Bar dataKey="At risk" stackId="health" fill={HEALTH_COLORS['At risk']} />
                <Bar dataKey="Delayed" stackId="health" fill={HEALTH_COLORS.Delayed} />
                <Bar dataKey="Planned" stackId="health" fill={HEALTH_COLORS.Planned} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Funding utilization · {currency}</h3>
              <p className="text-[11px] text-slate-500 mt-1">Grant allocations compared with recorded spend</p>
            </div>
            <button type="button" onClick={() => onOpenModule('funding')} className="text-xs text-sky-700 dark:text-sky-400 hover:underline">Open funding <ArrowRight className="inline w-3 h-3 ml-1" /></button>
          </div>
          <div className="h-56" role="img" aria-label={`Grant allocation and spend by directorate in ${currency}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fundingChartData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="code" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(value: number) => new Intl.NumberFormat('en-KE', { notation: 'compact', maximumFractionDigits: 0 }).format(value)} />
                <Tooltip formatter={(value) => formatMoney(Number(value || 0), currency)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="allocated" name="Allocated" fill="#0284c7" radius={[3, 3, 0, 0]} />
                <Bar dataKey="spent" name="Spent" fill="#0d9488" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 border-l-2 border-amber-500 pl-2 text-[10px] leading-relaxed text-slate-500">
            Actual vs planned expenditure is unavailable: the current records contain grant allocations and recorded spend, but no planned monthly expenditure.
          </p>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Directorate scorecard</h3>
            <p className="text-[11px] text-slate-500 mt-1">Select a directorate to apply it to the dashboard filters</p>
          </div>
          <span className="text-[11px] text-slate-500">{directorateRows.length} active directorates</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-medium">Directorate</th>
                <th className="px-3 py-2.5 font-medium text-right">Scientists</th>
                <th className="px-3 py-2.5 font-medium text-right">Projects</th>
                <th className="px-3 py-2.5 font-medium">On track</th>
                <th className="px-3 py-2.5 font-medium">Milestones on time</th>
                <th className="px-3 py-2.5 font-medium text-right">Allocated · {currency}</th>
                <th className="px-3 py-2.5 font-medium text-right">Risk notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {directorateRows.map((row) => (
                <tr key={row.directorate.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-2.5">
                    <button type="button" onClick={() => onSelectDirectorate(row.directorate.id)} className="text-left font-semibold text-sky-800 dark:text-sky-300 hover:underline">
                      {row.directorate.code} · {row.directorate.name}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.scientists}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.projects}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono tabular-nums">{percent(row.statusCounts['On track'], row.deliveryCount)}</span>
                    <span className="ml-1.5 text-[10px] text-slate-500">{row.statusCounts['On track']}/{row.deliveryCount}</span>
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums">{row.milestoneRate === null ? '—' : `${row.milestoneRate}%`}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatMoney(row.allocated, currency)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.riskCount || '—'}</td>
                </tr>
              ))}
              {directorateRows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No active directorates match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div id="executive-portfolio" className="grid grid-cols-1 xl:grid-cols-5 gap-4 scroll-mt-24">
        <Panel className="xl:col-span-3 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Project portfolio exceptions</h3>
              <p className="text-[11px] text-slate-500 mt-1">Calculated from dates, progress, milestones, and recorded issue notes</p>
            </div>
            <button type="button" onClick={() => onOpenModule('projects')} className="text-xs text-sky-700 dark:text-sky-400 hover:underline">All projects</button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {deliveryProjects
              .slice()
              .sort((a, b) => {
                const order: Record<HealthStatus, number> = { Delayed: 0, 'At risk': 1, 'On track': 2, Planned: 3 };
                return order[healthByProject.get(a.id) || 'Planned'] - order[healthByProject.get(b.id) || 'Planned'];
              })
              .slice(0, 7)
              .map((project) => {
                const status = healthByProject.get(project.id) || 'Planned';
                const directorate = db.directorates.find((item) => item.id === project.directorate_id);
                const openMilestones = relevantMilestones.filter(
                  (milestone) => milestone.project_id === project.id && milestone.status !== 'Completed'
                );
                return (
                  <button key={project.id} type="button" onClick={() => onOpenProject(project.id)} className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-slate-500">{project.project_code} · {directorate?.code || 'No directorate'}</span>
                      <span className={`text-[11px] font-semibold ${HEALTH_STYLES[status]}`}>{status}</span>
                    </span>
                    <span className="block mt-1 text-xs font-semibold text-slate-900 dark:text-white">{project.title}</span>
                    <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>{project.progress_percent}% reported progress</span>
                      <span>{openMilestones.length} open milestones</span>
                      {project.risks_issues?.trim() && <span className="text-amber-700 dark:text-amber-300">Risk note recorded</span>}
                    </span>
                  </button>
                );
              })}
            {deliveryProjects.length === 0 && <div className="px-4 py-8 text-center text-xs text-slate-500">No active or proposed projects match the current filters.</div>}
          </div>
        </Panel>

        <Panel id="executive-delivery" className="xl:col-span-2 p-4 scroll-mt-24">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Delivery and reporting</h3>
              <p className="text-[11px] text-slate-500 mt-1">Milestone completion and overdue reporting obligations</p>
            </div>
            <CalendarClock className="w-4 h-4 text-sky-700 dark:text-sky-400" />
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex justify-between text-xs"><span className="text-slate-600 dark:text-slate-300">Milestones completed</span><span className="font-mono">{percent(relevantMilestones.filter((item) => item.status === 'Completed').length, relevantMilestones.length)}</span></div>
              <div className="h-2 mt-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-teal-600 rounded-full" style={{ width: `${relevantMilestones.length ? (relevantMilestones.filter((item) => item.status === 'Completed').length / relevantMilestones.length) * 100 : 0}%` }} /></div>
              <p className="text-[10px] text-slate-500 mt-1">On-time completion among completed milestones: {percent(completedOnTime.length, completedMilestones.length)}</p>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Overdue reports</span>
                <button type="button" onClick={() => onOpenModule('reports')} className="text-[11px] text-sky-700 dark:text-sky-400 hover:underline">Review</button>
              </div>
              {overdueReports.length ? (
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {overdueReports.slice(0, 5).map((report) => (
                    <div key={report.id} className="flex items-start gap-2 text-[11px]">
                      <ClipboardCheck className="w-3.5 h-3.5 mt-0.5 text-rose-600 shrink-0" />
                      <div className="min-w-0"><div className="truncate font-medium text-slate-800 dark:text-slate-200">{report.title}</div><div className="text-slate-500">Due {report.due_date} · {report.status}</div></div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-[11px] text-slate-500">No overdue reports in the current scope.</p>}
            </div>
          </div>
        </Panel>
      </div>

      <div id="executive-exceptions" className="grid grid-cols-1 xl:grid-cols-2 gap-4 scroll-mt-24">
        <Panel className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recorded project risks</h3>
              <p className="text-[11px] text-slate-500 mt-1">Issue notes are shown as recorded; severity and likelihood are not structured</p>
            </div>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          {riskProjects.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {riskProjects.slice(0, 5).map((project) => (
                <button key={project.id} type="button" onClick={() => onOpenProject(project.id)} className="w-full py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <span className="flex items-center justify-between gap-2"><span className="font-mono text-[11px] text-slate-500">{project.project_code} · {project.priority}</span><ArrowRight className="w-3.5 h-3.5 text-slate-400" /></span>
                  <span className="block text-xs font-medium text-slate-800 dark:text-slate-200 mt-1">{project.risks_issues}</span>
                </button>
              ))}
            </div>
          ) : <p className="py-4 text-xs text-slate-500">No risk notes are recorded on active projects in this scope.</p>}
        </Panel>

        <Panel className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Compliance visibility</h3>
              <p className="text-[11px] text-slate-500 mt-1">Current coverage and its limits</p>
            </div>
            <FileWarning className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-4 flex items-start gap-3 border-l-2 border-amber-500 bg-amber-50/70 dark:bg-amber-950/20 px-3 py-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-700 dark:text-amber-300 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">Compliance register not configured</div>
              <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 mt-1">The system currently tracks report due dates and audit activity, but does not contain an obligations register, compliance evidence, or audit findings. Overdue reports above are a reporting indicator, not an overall compliance rating.</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>{overdueReports.length} overdue reporting obligations</span>
            <button type="button" onClick={() => onOpenModule('administration')} className="text-sky-700 dark:text-sky-400 hover:underline">Audit and settings <ArrowRight className="inline w-3 h-3 ml-1" /></button>
          </div>
        </Panel>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <Users className="w-3.5 h-3.5" />
        <span>Staff counts include active operational scientists. Funding is restricted to {currency}; no cross-currency totals are combined.</span>
      </div>
    </div>
  );
}