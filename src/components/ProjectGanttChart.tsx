import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flag,
  Layers,
  ListFilter,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  Directorate,
  Project,
  ProjectMilestone,
  ProjectStatus,
  ResearchActivity,
} from '../types/kmfri.ts';

// =============================================================================
// HELPER TYPES & DATE CALCULATIONS
// =============================================================================

export interface GanttItem {
  id: string;
  type: 'milestone' | 'activity' | 'project';
  title: string;
  shortLabel: string;
  startDateStr: string;
  dueDateStr: string;
  startOffset: number;
  duration: number;
  status: string;
  progress_percent: number;
  color: string;
  deliverable?: string;
  description?: string;
  ownerName?: string;
  daysRemaining: number;
  isOverdue: boolean;
  raw: ProjectMilestone | ResearchActivity | Project;
}

function parseDateOnly(dateStr: string | null | undefined, fallback: Date = new Date()): Date {
  if (!dateStr) return fallback;
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day));
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? fallback : d;
}

function formatTickDate(minDate: Date, offsetDays: number): string {
  const d = new Date(minDate.getTime() + offsetDays * 86400000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(-2)}`;
}

function getStatusColor(status: string, isOverdue: boolean): string {
  if (status === 'Completed') return '#0d9488'; // Teal 600
  if (isOverdue || status === 'Delayed') return '#e11d48'; // Rose 600
  if (status === 'In Progress') return '#0284c7'; // Sky 600
  return '#64748b'; // Slate 500 (Pending / Planned)
}

function getDirectorateColor(code?: string): string {
  switch (code) {
    case 'OCS':
    case 'DIR-OCS':
      return '#0284c7'; // Sky blue
    case 'MCF':
    case 'DIR-MCF':
      return '#0d9488'; // Teal
    case 'FWS':
    case 'DIR-FWS':
      return '#059669'; // Emerald
    case 'AQU':
    case 'DIR-AQU':
      return '#10b981'; // Mint
    case 'SEC':
    case 'DIR-SEC':
      return '#d97706'; // Amber
    default:
      return '#6366f1'; // Indigo
  }
}

// =============================================================================
// CUSTOM RECHARTS TOOLTIPS
// =============================================================================

interface TooltipProps {
  active?: boolean;
  payload?: any[];
  minDate: Date;
}

function MilestoneGanttTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const item: GanttItem = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xl text-xs max-w-sm z-50">
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
          <Flag className="w-3 h-3 text-sky-600" />
          {item.type === 'milestone' ? 'Milestone Checkpoint' : 'Research Field Activity'}
        </span>
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider"
          style={{ backgroundColor: item.color }}
        >
          {item.status}
        </span>
      </div>

      <h4 className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
        {item.title}
      </h4>

      <div className="mt-2.5 space-y-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
        <div className="flex justify-between">
          <span className="text-slate-400">Timeline Window:</span>
          <span>{item.startDateStr} → {item.dueDateStr}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Duration:</span>
          <span>{Math.round(item.duration)} days</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Completion:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-14 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full"
                style={{ width: `${item.progress_percent}%` }}
              />
            </div>
            <span>{item.progress_percent}%</span>
          </div>
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="text-slate-400">Deadline Status:</span>
          {item.status === 'Completed' ? (
            <span className="text-teal-600 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Completed
            </span>
          ) : item.isOverdue ? (
            <span className="text-rose-600 font-bold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Overdue by {Math.abs(item.daysRemaining)} days
            </span>
          ) : (
            <span className="text-sky-600 font-bold flex items-center gap-1">
              <Clock className="w-3 h-3" /> {item.daysRemaining} days remaining
            </span>
          )}
        </div>
      </div>

      {item.deliverable && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Deliverable: </span>
          {item.deliverable}
        </div>
      )}
    </div>
  );
}

function PortfolioGanttTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const item: GanttItem = payload[0]?.payload;
  if (!item) return null;
  const proj = item.raw as Project;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xl text-xs max-w-sm z-50">
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
        <span className="font-mono text-xs font-bold text-sky-700 dark:text-sky-400">
          {proj.project_code}
        </span>
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider"
          style={{ backgroundColor: item.color }}
        >
          {proj.status}
        </span>
      </div>

      <h4 className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
        {proj.title}
      </h4>

      <div className="mt-2.5 space-y-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
        <div className="flex justify-between">
          <span className="text-slate-400">Project Period:</span>
          <span>{proj.start_date} → {proj.end_date}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Total Duration:</span>
          <span>{Math.round(item.duration)} days</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Approved Budget:</span>
          <span>{proj.currency} {proj.budget.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Overall Progress:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full"
                style={{ width: `${proj.progress_percent}%` }}
              />
            </div>
            <span>{proj.progress_percent}%</span>
          </div>
        </div>
      </div>
      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 text-center font-mono">
        Click to open full project workspace & tabs
      </div>
    </div>
  );
}

// =============================================================================
// COMPONENT 1: PROJECT MILESTONES GANTT (SINGLE PROJECT VIEW)
// =============================================================================

interface ProjectMilestonesGanttProps {
  project: Project;
  milestones: ProjectMilestone[];
  activities?: ResearchActivity[];
  canEdit?: boolean;
  onMarkMilestoneComplete?: (milestoneId: string, title: string) => Promise<void>;
  onOpenAddMilestone?: () => void;
  onSeedSampleMilestones?: () => Promise<void>;
}

export function ProjectMilestonesGantt({
  project,
  milestones,
  activities = [],
  canEdit = false,
  onMarkMilestoneComplete,
  onOpenAddMilestone,
  onSeedSampleMilestones,
}: ProjectMilestonesGanttProps) {
  const [includeActivities, setIncludeActivities] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'chart' | 'cards' | 'combined'>('combined');
  const [seeding, setSeeding] = useState(false);

  // Today reference
  const today = useMemo(() => {
    const t = new Date();
    return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
  }, []);

  // Compute bounding dates for timeline
  const { minDate, maxDate, totalSpanDays, todayOffset, tickDays, chartData } = useMemo(() => {
    const projStart = parseDateOnly(project.start_date);
    const projEnd = parseDateOnly(project.end_date);

    let earliest = new Date(projStart);
    let latest = new Date(projEnd);

    // Look at milestones
    for (const m of milestones) {
      const d = parseDateOnly(m.due_date);
      if (d < earliest) earliest = new Date(d);
      if (d > latest) latest = new Date(d);
    }
    // Look at activities
    if (includeActivities) {
      for (const a of activities) {
        const d = parseDateOnly(a.activity_date);
        if (d < earliest) earliest = new Date(d);
        if (d > latest) latest = new Date(d);
      }
    }

    // Add 10 days padding on left, 20 days on right
    const minD = new Date(earliest.getTime() - 10 * 86400000);
    const maxD = new Date(latest.getTime() + 20 * 86400000);
    const totalDays = Math.max(30, Math.ceil((maxD.getTime() - minD.getTime()) / 86400000));
    const todayOff = Math.round((today.getTime() - minD.getTime()) / 86400000);

    // Generate regular tick intervals
    const intervalDays = totalDays > 730 ? 90 : totalDays > 365 ? 60 : totalDays > 120 ? 30 : 15;
    const ticks: number[] = [];
    for (let day = 0; day <= totalDays; day += intervalDays) {
      ticks.push(day);
    }

    // Filter milestones
    const filteredMilestones = milestones.filter((m) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'overdue') {
        const d = parseDateOnly(m.due_date);
        return d < today && m.status !== 'Completed';
      }
      return m.status.toLowerCase() === statusFilter.toLowerCase();
    });

    // Build chart data
    const items: GanttItem[] = [];

    filteredMilestones.forEach((m) => {
      const dueD = parseDateOnly(m.due_date);
      // Determine logical start window for milestone
      let startD = m.created_at ? parseDateOnly(m.created_at) : new Date(projStart);
      // If start >= due, set start to 30 days before due or projStart
      if (startD >= dueD) {
        startD = new Date(Math.max(projStart.getTime(), dueD.getTime() - 30 * 86400000));
      }
      // If start still >= due, pad by at least 14 days
      if (startD >= dueD) {
        startD = new Date(dueD.getTime() - 14 * 86400000);
      }

      const startOff = Math.max(0, Math.round((startD.getTime() - minD.getTime()) / 86400000));
      const endOff = Math.round((dueD.getTime() - minD.getTime()) / 86400000);
      const duration = Math.max(7, endOff - startOff); // minimum 7 days width for clear clickability

      const daysRem = Math.round((dueD.getTime() - today.getTime()) / 86400000);
      const isOverdue = dueD < today && m.status !== 'Completed';

      const shortLabel =
        m.title.length > 22 ? `${m.title.slice(0, 20)}…` : m.title;

      items.push({
        id: m.id,
        type: 'milestone',
        title: m.title,
        shortLabel,
        startDateStr: startD.toISOString().split('T')[0],
        dueDateStr: m.due_date,
        startOffset: startOff,
        duration,
        status: isOverdue && m.status !== 'Completed' ? 'Delayed' : m.status,
        progress_percent: m.progress_percent,
        color: getStatusColor(m.status, isOverdue),
        deliverable: m.deliverable_summary,
        description: m.description,
        daysRemaining: daysRem,
        isOverdue,
        raw: m,
      });
    });

    // If activities included, add them
    if (includeActivities) {
      activities.forEach((act) => {
        const actD = parseDateOnly(act.activity_date);
        const startD = new Date(actD.getTime() - 3 * 86400000);
        const startOff = Math.max(0, Math.round((startD.getTime() - minD.getTime()) / 86400000));
        const duration = 7;
        const daysRem = Math.round((actD.getTime() - today.getTime()) / 86400000);

        items.push({
          id: act.id,
          type: 'activity',
          title: `[Field] ${act.title}`,
          shortLabel: act.title.length > 20 ? `${act.title.slice(0, 18)}…` : act.title,
          startDateStr: startD.toISOString().split('T')[0],
          dueDateStr: act.activity_date,
          startOffset: startOff,
          duration,
          status: act.status,
          progress_percent: act.status === 'Completed' ? 100 : 50,
          color: '#8b5cf6', // Violet
          description: act.description,
          daysRemaining: daysRem,
          isOverdue: false,
          raw: act,
        });
      });
    }

    // Sort by due date offset
    items.sort((a, b) => a.startOffset + a.duration - (b.startOffset + b.duration));

    return {
      minDate: minD,
      maxDate: maxD,
      totalSpanDays: totalDays,
      todayOffset: todayOff,
      tickDays: ticks,
      chartData: items,
    };
  }, [project, milestones, activities, includeActivities, statusFilter, today]);

  // Overall milestone statistics
  const stats = useMemo(() => {
    const total = milestones.length;
    const completed = milestones.filter((m) => m.status === 'Completed').length;
    const inProgress = milestones.filter((m) => m.status === 'In Progress').length;
    const pending = milestones.filter((m) => m.status === 'Pending').length;
    const overdue = milestones.filter((m) => {
      const d = parseDateOnly(m.due_date);
      return d < today && m.status !== 'Completed';
    }).length;

    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Find next upcoming milestone
    const upcoming = milestones
      .filter((m) => m.status !== 'Completed')
      .sort((a, b) => parseDateOnly(a.due_date).getTime() - parseDateOnly(b.due_date).getTime())[0];

    return { total, completed, inProgress, pending, overdue, rate, upcoming };
  }, [milestones, today]);

  const handleSeed = async () => {
    if (!onSeedSampleMilestones) return;
    setSeeding(true);
    try {
      await onSeedSampleMilestones();
    } finally {
      setSeeding(false);
    }
  };

  const chartHeight = Math.max(260, chartData.length * 44 + 90);

  return (
    <div className="space-y-5">
      {/* Header & Controls Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                <Layers className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Project Milestones &amp; Deadlines Gantt Timeline
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Visualizing research milestone delivery windows, critical deadlines, and completion schedules from{' '}
              <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                {project.start_date}
              </span>{' '}
              to{' '}
              <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                {project.end_date}
              </span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewMode('combined')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  viewMode === 'combined'
                    ? 'bg-white dark:bg-slate-800 shadow-xs text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Combined
              </button>
              <button
                type="button"
                onClick={() => setViewMode('chart')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  viewMode === 'chart'
                    ? 'bg-white dark:bg-slate-800 shadow-xs text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Gantt Chart
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-slate-800 shadow-xs text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Milestone Cards
              </button>
            </div>

            {canEdit && onOpenAddMilestone && (
              <button
                type="button"
                onClick={onOpenAddMilestone}
                className="px-3 py-1.5 rounded-lg bg-[#0A2540] hover:bg-sky-900 dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Milestone</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-4">
          <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
            <div className="text-[11px] font-medium text-slate-500">Total Milestones</div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
              {stats.total}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">In Project Portfolio</div>
          </div>

          <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
            <div className="text-[11px] font-medium text-slate-500">Completed</div>
            <div className="text-xl font-bold font-mono text-teal-600 mt-0.5">
              {stats.completed}
            </div>
            <div className="text-[10px] text-teal-600 font-semibold mt-0.5">
              {stats.rate}% Target Rate
            </div>
          </div>

          <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
            <div className="text-[11px] font-medium text-slate-500">In Progress / Pending</div>
            <div className="text-xl font-bold font-mono text-sky-600 mt-0.5">
              {stats.inProgress + stats.pending}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {stats.inProgress} active · {stats.pending} scheduled
            </div>
          </div>

          <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
            <div className="text-[11px] font-medium text-slate-500">Overdue Milestones</div>
            <div className={`text-xl font-bold font-mono mt-0.5 ${stats.overdue > 0 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}`}>
              {stats.overdue}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {stats.overdue > 0 ? 'Requires attention' : 'All deadlines on track'}
            </div>
          </div>

          <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 col-span-2 sm:col-span-1">
            <div className="text-[11px] font-medium text-slate-500">Next Upcoming Deadline</div>
            {stats.upcoming ? (
              <div className="mt-0.5">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {stats.upcoming.title}
                </div>
                <div className="text-[10px] font-mono text-sky-700 dark:text-sky-400 font-semibold mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Due {stats.upcoming.due_date}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 mt-1 font-mono">No active deadlines</div>
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-500 font-medium flex items-center gap-1 mr-1">
              <ListFilter className="w-3.5 h-3.5" /> Filter Status:
            </span>
            {[
              { id: 'all', label: 'All Statuses' },
              { id: 'in progress', label: 'In Progress' },
              { id: 'pending', label: 'Pending' },
              { id: 'completed', label: 'Completed' },
              { id: 'overdue', label: `Overdue (${stats.overdue})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  statusFilter === f.id
                    ? 'bg-sky-600 text-white font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {activities.length > 0 && (
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={includeActivities}
                  onChange={(e) => setIncludeActivities(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <span>Include Research Field Activities ({activities.length})</span>
              </label>
            )}

            {/* Visual Legend */}
            <div className="hidden sm:flex items-center gap-3 font-mono text-[11px] text-slate-500">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-teal-600 inline-block" />
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-600 inline-block" />
                <span>In Progress</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" />
                <span>Overdue</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-rose-500 border border-rose-500 border-dashed inline-block" />
                <span>Today</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Gantt Chart View */}
      {(viewMode === 'chart' || viewMode === 'combined') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          {chartData.length === 0 ? (
            <div className="py-12 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                No Milestones to Display
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                {statusFilter !== 'all'
                  ? `No milestones matching "${statusFilter}" status.`
                  : 'Start tracking project milestones, survey deliverables, and research checkpoints by creating your first milestone.'}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                {canEdit && onOpenAddMilestone && (
                  <button
                    type="button"
                    onClick={onOpenAddMilestone}
                    className="px-3.5 py-2 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Milestone</span>
                  </button>
                )}
                {canEdit && onSeedSampleMilestones && (
                  <button
                    type="button"
                    onClick={handleSeed}
                    disabled={seeding}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>{seeding ? 'Generating Milestones...' : 'Populate Standard KMFRI Milestones'}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: 680, height: chartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={chartData}
                    margin={{ top: 20, right: 35, left: 160, bottom: 25 }}
                    barSize={20}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={true}
                      vertical={true}
                      opacity={0.15}
                    />
                    <XAxis
                      type="number"
                      domain={[0, totalSpanDays]}
                      ticks={tickDays}
                      tickFormatter={(days) => formatTickDate(minDate, days)}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#94a3b8' }}
                    />
                    <YAxis
                      type="category"
                      dataKey="shortLabel"
                      width={150}
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={{ stroke: '#94a3b8' }}
                    />
                    {/* Transparent spacer bar to shift the floating bar */}
                    <Bar
                      dataKey="startOffset"
                      stackId="gantt"
                      fill="transparent"
                      isAnimationActive={false}
                    />
                    {/* The colored duration bar */}
                    <Bar
                      dataKey="duration"
                      stackId="gantt"
                      radius={[4, 4, 4, 4]}
                      isAnimationActive={true}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                    {/* Reference Line for TODAY */}
                    {todayOffset >= 0 && todayOffset <= totalSpanDays && (
                      <ReferenceLine
                        x={todayOffset}
                        stroke="#ef4444"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        label={{
                          value: 'Today',
                          position: 'top',
                          fill: '#ef4444',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      />
                    )}
                    <Tooltip content={<MilestoneGanttTooltip minDate={minDate} />} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Milestone Cards / Action Checklist */}
      {(viewMode === 'cards' || viewMode === 'combined') && chartData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Milestone Checklist &amp; Deliverables ({chartData.length})
            </h4>
            <span className="text-xs font-mono text-slate-500">
              Sorted chronologically by deadline
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {chartData.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 transition-colors flex flex-col justify-between text-xs bg-slate-50/50 dark:bg-slate-950/30"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white text-xs leading-snug">
                      {item.title}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shrink-0 uppercase tracking-wider"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" /> Deadline: {item.dueDateStr}
                      </span>
                      {item.status === 'Completed' ? (
                        <span className="text-teal-600 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Done
                        </span>
                      ) : item.isOverdue ? (
                        <span className="text-rose-600 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Overdue
                        </span>
                      ) : (
                        <span className="text-sky-600 font-bold">
                          {item.daysRemaining} days left
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${item.progress_percent}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums">{item.progress_percent}%</span>
                    </div>
                  </div>

                  {item.deliverable && (
                    <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Deliverable: </span>
                      {item.deliverable}
                    </div>
                  )}
                </div>

                {canEdit && item.status !== 'Completed' && onMarkMilestoneComplete && (
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onMarkMilestoneComplete(item.id, item.title)}
                      className="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Mark Complete</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// COMPONENT 2: PORTFOLIO GANTT TIMELINE (MULTI-PROJECT INSTITUTIONAL VIEW)
// =============================================================================

interface PortfolioGanttChartProps {
  projects: Project[];
  directorates: Directorate[];
  milestones: ProjectMilestone[];
  onSelectProject: (projectId: string) => void;
}

export function PortfolioGanttChart({
  projects,
  directorates,
  milestones,
  onSelectProject,
}: PortfolioGanttChartProps) {
  const today = useMemo(() => {
    const t = new Date();
    return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
  }, []);

  const { minDate, totalSpanDays, todayOffset, tickDays, chartData } = useMemo(() => {
    if (!projects || projects.length === 0) {
      const now = new Date();
      return {
        minDate: now,
        totalSpanDays: 365,
        todayOffset: 0,
        tickDays: [],
        chartData: [],
      };
    }

    let earliest = parseDateOnly(projects[0].start_date);
    let latest = parseDateOnly(projects[0].end_date);

    projects.forEach((p) => {
      const s = parseDateOnly(p.start_date);
      const e = parseDateOnly(p.end_date);
      if (s < earliest) earliest = new Date(s);
      if (e > latest) latest = new Date(e);
    });

    const minD = new Date(earliest.getTime() - 15 * 86400000);
    const maxD = new Date(latest.getTime() + 30 * 86400000);
    const totalDays = Math.max(60, Math.ceil((maxD.getTime() - minD.getTime()) / 86400000));
    const todayOff = Math.round((today.getTime() - minD.getTime()) / 86400000);

    const intervalDays = totalDays > 730 ? 90 : totalDays > 365 ? 60 : 30;
    const ticks: number[] = [];
    for (let day = 0; day <= totalDays; day += intervalDays) {
      ticks.push(day);
    }

    const items: GanttItem[] = projects.map((proj) => {
      const startD = parseDateOnly(proj.start_date);
      const endD = parseDateOnly(proj.end_date);
      const startOff = Math.max(0, Math.round((startD.getTime() - minD.getTime()) / 86400000));
      const endOff = Math.round((endD.getTime() - minD.getTime()) / 86400000);
      const duration = Math.max(14, endOff - startOff);

      const dir = directorates.find((d) => d.id === proj.directorate_id);
      const color = getDirectorateColor(dir?.code);

      const shortLabel =
        proj.project_code.length > 18
          ? `${proj.project_code.slice(0, 16)}…`
          : proj.project_code;

      return {
        id: proj.id,
        type: 'project',
        title: proj.title,
        shortLabel,
        startDateStr: proj.start_date,
        dueDateStr: proj.end_date,
        startOffset: startOff,
        duration,
        status: proj.status,
        progress_percent: proj.progress_percent,
        color,
        deliverable: `${dir?.code || '—'} · ${proj.status} · ${proj.progress_percent}%`,
        daysRemaining: Math.round((endD.getTime() - today.getTime()) / 86400000),
        isOverdue: endD < today && proj.status !== ProjectStatus.COMPLETED,
        raw: proj,
      };
    });

    // Sort by start date
    items.sort((a, b) => a.startOffset - b.startOffset);

    return {
      minDate: minD,
      totalSpanDays: totalDays,
      todayOffset: todayOff,
      tickDays: ticks,
      chartData: items,
    };
  }, [projects, directorates, today]);

  const chartHeight = Math.max(300, chartData.length * 38 + 90);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-sky-600" />
            <span>KMFRI Research Projects Multi-Year Timeline</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-directorate research project spans, execution windows, and active milestone progression
          </p>
        </div>

        {/* Directorate Color Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#0284c7] inline-block" />
            <span>OCS (Oceanography)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#0d9488] inline-block" />
            <span>MCF (Fisheries)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#059669] inline-block" />
            <span>FWS (Freshwater)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#10b981] inline-block" />
            <span>AQU (Aquaculture)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#d97706] inline-block" />
            <span>SEC (Socio-Econ)</span>
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500">
          No research projects available for Gantt timeline visualization.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: 700, height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ top: 20, right: 35, left: 160, bottom: 25 }}
                barSize={18}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    const item: GanttItem = e.activePayload[0].payload;
                    onSelectProject(item.id);
                  }
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={true}
                  vertical={true}
                  opacity={0.15}
                />
                <XAxis
                  type="number"
                  domain={[0, totalSpanDays]}
                  ticks={tickDays}
                  tickFormatter={(days) => formatTickDate(minDate, days)}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#94a3b8' }}
                />
                <YAxis
                  type="category"
                  dataKey="shortLabel"
                  width={150}
                  tick={{ fontSize: 11, fill: '#475569', cursor: 'pointer' }}
                  axisLine={{ stroke: '#94a3b8' }}
                />
                <Bar
                  dataKey="startOffset"
                  stackId="portfolio"
                  fill="transparent"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="duration"
                  stackId="portfolio"
                  radius={[4, 4, 4, 4]}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  isAnimationActive={true}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
                {todayOffset >= 0 && todayOffset <= totalSpanDays && (
                  <ReferenceLine
                    x={todayOffset}
                    stroke="#ef4444"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: 'Today',
                      position: 'top',
                      fill: '#ef4444',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  />
                )}
                <Tooltip content={<PortfolioGanttTooltip minDate={minDate} />} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 font-mono border-t border-slate-100 dark:border-slate-800">
        <span>Click any project row or bar in the Gantt chart to open its full 11-tab workspace</span>
        <span>Red dashed marker = Current date checkpoint</span>
      </div>
    </div>
  );
}
