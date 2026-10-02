import React, { useState, useMemo } from 'react';
import { BootstrapData } from '../types.ts';
import {
  calculateScientistBalancedScorecard,
  generateCSV,
  ScientistBalancedScorecard,
} from '../lib/domain.ts';
import {
  Award,
  Briefcase,
  BookOpen,
  DollarSign,
  Compass,
  Plus,
  Download,
  CheckCircle2,
  Clock,
  Trash2,
  X,
  UserCheck,
  Calendar,
  MapPin,
} from 'lucide-react';

interface BalancedScorecardViewProps {
  data: BootstrapData;
  searchQuery: string;
  onRefresh: () => Promise<void>;
  apiFetch: <T = any>(path: string, options?: RequestInit) => Promise<T>;
  onSelectScientistProfile?: (userId: string) => void;
}

const EVENT_TYPE_PRESETS: { label: string; defaultWeight: number }[] = [
  { label: 'RV Mtafiti Research Cruise', defaultWeight: 15 },
  { label: 'Marine & Coastal Field Expedition', defaultWeight: 12 },
  { label: 'Freshwater Lake Hydro-Acoustic Survey', defaultWeight: 12 },
  { label: 'WIOMSA / International Scientific Symposium', defaultWeight: 12 },
  { label: 'BMU & County Stakeholder Co-Management Workshop', defaultWeight: 10 },
  { label: 'National Blue Economy Policy Briefing', defaultWeight: 10 },
  { label: 'ISO Laboratory Accreditation & QA Audit', defaultWeight: 10 },
];

function getInitials(fullName: string): string {
  return (fullName || 'KM')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export const BalancedScorecardView: React.FC<BalancedScorecardViewProps> = ({
  data,
  searchQuery,
  onRefresh,
  apiFetch,
  onSelectScientistProfile,
}) => {
  const currentUser = data.currentUser;
  const isViewer = currentUser.roleName === 'VIEWER';

  // Compute scorecards for all active scientists / researchers / directors
  const scientistUsers = useMemo(() => {
    return data.users.filter((u) => u.roleName !== 'VIEWER');
  }, [data.users]);

  const scorecardsByUser = useMemo(() => {
    const map = new Map<string, ScientistBalancedScorecard>();
    for (const u of scientistUsers) {
      const bsc = calculateScientistBalancedScorecard({
        scientistId: u.id,
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
      map.set(u.id, bsc);
    }
    return map;
  }, [
    scientistUsers,
    data.projects,
    data.projectMembers,
    data.reports,
    data.researchOutputs,
    data.funding,
    data.researchActivities,
    data.documents,
  ]);

  const rankedScientists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scientistUsers
      .filter((u) => {
        if (!q) return true;
        const dir = data.directorates.find((d) => d.id === u.directorateId);
        const area = data.researchAreas.find((a) => a.id === u.researchAreaId);
        return (
          u.fullName.toLowerCase().includes(q) ||
          (u.position || '').toLowerCase().includes(q) ||
          (dir?.name || '').toLowerCase().includes(q) ||
          (area?.name || '').toLowerCase().includes(q) ||
          (u.staffNumber || '').toLowerCase().includes(q)
        );
      })
      .map((user) => ({
        user,
        scorecard: scorecardsByUser.get(user.id)!,
      }))
      .sort((a, b) => b.scorecard.totalScore - a.scorecard.totalScore);
  }, [
    scientistUsers,
    scorecardsByUser,
    searchQuery,
    data.directorates,
    data.researchAreas,
  ]);

  const [selectedScientistId, setSelectedScientistId] = useState<string>(() => {
    const meInList = data.users.find(
      (u) => u.id === currentUser.id && u.roleName !== 'VIEWER'
    );
    return meInList?.id || data.users[0]?.id || '';
  });

  const activeEntry =
    rankedScientists.find((r) => r.user.id === selectedScientistId) ||
    rankedScientists[0] ||
    null;

  // Modal state to log a new scientific event / cruise / expedition
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState('RV Mtafiti Research Cruise');
  const [eventWeight, setEventWeight] = useState(15);
  const [eventScientistId, setEventScientistId] = useState(currentUser.id);
  const [eventProjectId, setEventProjectId] = useState(
    data.projects[0]?.id || ''
  );
  const [eventDate, setEventDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [eventLocationId, setEventLocationId] = useState(
    data.locations[0]?.id || ''
  );
  const [eventStatus, setEventStatus] = useState<
    'Completed' | 'Ongoing' | 'Planned'
  >('Completed');
  const [eventDescription, setEventDescription] = useState('');
  const [submittingEvent, setSubmittingEvent] = useState(false);

  const avgInstituteScore =
    rankedScientists.length > 0
      ? Math.round(
          rankedScientists.reduce((s, r) => s + r.scorecard.totalScore, 0) /
            rankedScientists.length
        )
      : 0;

  const topPerformer = rankedScientists[0] || null;

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    setSubmittingEvent(true);
    try {
      await apiFetch('/api/activities', {
        method: 'POST',
        body: JSON.stringify({
          title: eventTitle.trim(),
          eventType,
          scoreWeight: Number(eventWeight) || 10,
          scientistId: eventScientistId || currentUser.id,
          projectId: eventProjectId || null,
          activityDate: eventDate,
          locationId: eventLocationId || null,
          status: eventStatus,
          description: eventDescription.trim() || null,
          hours: eventWeight,
        }),
      });
      setEventTitle('');
      setEventDescription('');
      setShowEventModal(false);
      await onRefresh();
    } finally {
      setSubmittingEvent(false);
    }
  };

  const handleExportScorecardCSV = () => {
    const headers = [
      'Rank',
      'Staff Number',
      'Scientist Name',
      'Directorate',
      'Total BSC Score (/100)',
      'Performance Grade',
      'Project Execution (/35)',
      'Publications & Docs (/25)',
      'Grant Stewardship (/20)',
      'Cruises & Events (/20)',
      'PI Projects',
      'Publications',
      'Events Completed',
    ];
    const rows = rankedScientists.map((entry, idx) => {
      const dir = data.directorates.find(
        (d) => d.id === entry.user.directorateId
      );
      return [
        idx + 1,
        entry.user.staffNumber,
        entry.user.fullName,
        dir?.code || entry.user.directorateCode || 'OCS',
        entry.scorecard.totalScore,
        entry.scorecard.grade,
        entry.scorecard.projectExecutionScore,
        entry.scorecard.publicationsOutputScore,
        entry.scorecard.financialGrantScore,
        entry.scorecard.eventsActivitiesScore,
        entry.scorecard.metrics.ledProjectsCount,
        entry.scorecard.metrics.publicationsCount,
        entry.scorecard.metrics.completedEventsCount,
      ];
    });
    const csv = generateCSV(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KMFRI_Balanced_Scorecard_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getGradeBadgeStyle = (grade: ScientistBalancedScorecard['grade']) => {
    if (grade.includes('A+')) {
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    }
    if (grade.includes('(A)')) {
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30';
    }
    if (grade.includes('B+')) {
      return 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30';
    }
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
  };

  return (
    <div className="space-y-6">
      {/* Top Balanced Scorecard Executive Banner */}
      <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-r from-slate-900 via-sky-950 to-teal-950 text-white p-5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-teal-300">
              <Award className="w-4 h-4 text-amber-400" />
              <span>KMFRI PERFORMANCE CONTRACTING &amp; SCIENTIST BALANCED SCORECARD (BSC)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Scientist Balanced Scorecard, Project Delivery &amp; Scientific Events
            </h1>
            <p className="text-xs text-slate-300 max-w-3xl">
              Automated 100-point institutional evaluation across four strategic pillars: <strong>Research Project Execution (35%)</strong>, <strong>Publications &amp; Co-Authored Outputs (25%)</strong>, <strong>Grant Stewardship (20%)</strong>, and <strong>Cruises, Field Expeditions &amp; Related Events (20%)</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!isViewer && (
              <button
                type="button"
                onClick={() => {
                  setEventScientistId(
                    activeEntry?.user.id || currentUser.id
                  );
                  setShowEventModal(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Log Cruise / Scientific Event (+BSC Points)</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportScorecardCSV}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-sky-300" />
              <span>Export Scorecard CSV</span>
            </button>
          </div>
        </div>

        {/* 4 Summary KPI Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="text-[11px] font-mono uppercase text-slate-400">
              Institute Mean BSC Score
            </div>
            <div className="text-2xl font-bold font-mono text-teal-300 mt-0.5">
              {avgInstituteScore}{' '}
              <span className="text-xs font-normal text-slate-400">/ 100 pts</span>
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              Evaluated across {rankedScientists.length} active scientists
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="text-[11px] font-mono uppercase text-slate-400">
              Top Ranked Scientist
            </div>
            <div className="text-sm sm:text-base font-bold text-white truncate mt-1">
              {topPerformer ? topPerformer.user.fullName : '—'}
            </div>
            <div className="text-[11px] font-mono text-amber-300 mt-0.5">
              {topPerformer
                ? `${topPerformer.scorecard.totalScore}/100 pts • ${topPerformer.scorecard.grade}`
                : ''}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="text-[11px] font-mono uppercase text-slate-400">
              Projects &amp; Manuscripts Scored
            </div>
            <div className="text-2xl font-bold font-mono text-sky-300 mt-0.5">
              {data.projects.length} / {(data.researchOutputs || []).length}
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              Active Projects &amp; Peer-Reviewed Outputs
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="text-[11px] font-mono uppercase text-slate-400">
              Cruises &amp; Scientific Events
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-300 mt-0.5">
              {(data.researchActivities || []).length}
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              {(data.researchActivities || []).filter((a) => a.status === 'Completed').length}{' '}
              Completed Field &amp; Policy Events
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Grid: Left Leaderboard & Right Individual Scientist 4-Perspective Scorecard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Cols: Scientist BSC Leaderboard */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Scientist Balanced Scorecard Ranking
              </h2>
              <p className="text-[11px] text-slate-500">
                Click any scientist to inspect their 4-quadrant scorecard &amp; events
              </p>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              FY 2025/2026
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[660px] overflow-y-auto">
            {rankedScientists.map(({ user, scorecard }, idx) => {
              const isSelected = activeEntry?.user.id === user.id;
              const dir = data.directorates.find(
                (d) => d.id === user.directorateId
              );
              const area = data.researchAreas.find(
                (a) => a.id === user.researchAreaId
              );
              return (
                <div
                  key={user.id}
                  onClick={() => setSelectedScientistId(user.id)}
                  className={`p-3.5 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-sky-50/90 dark:bg-sky-950/40 border-l-4 border-l-sky-600'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg font-mono text-xs font-bold flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                          : idx === 1
                            ? 'bg-slate-300/40 text-slate-700 dark:text-slate-200'
                            : idx === 2
                              ? 'bg-orange-500/15 text-orange-700 dark:text-orange-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      #{idx + 1}
                    </div>

                    {user.profilePhoto ? (
                      <img
                        src={user.profilePhoto}
                        alt={user.fullName}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-xl object-cover border border-sky-500/30 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-sky-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {getInitials(user.fullName)}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {user.fullName}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {dir?.code || 'OCS'} • {area?.name || user.position || 'Research Scientist'}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${getGradeBadgeStyle(
                            scorecard.grade
                          )}`}
                        >
                          {scorecard.grade}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                      {scorecard.totalScore}
                      <span className="text-[11px] text-slate-400 font-normal">/100</span>
                    </div>
                    <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-400"
                        style={{ width: `${scorecard.totalScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 7 Cols: Selected Scientist Detailed 4-Quadrant Balanced Scorecard */}
        {activeEntry && (
          <div className="lg:col-span-7 space-y-5">
            {/* Scientist Scorecard Header Card */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {activeEntry.user.profilePhoto ? (
                    <img
                      src={activeEntry.user.profilePhoto}
                      alt={activeEntry.user.fullName}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-sky-500/40"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-sky-700 text-white font-bold text-lg flex items-center justify-center">
                      {getInitials(activeEntry.user.fullName)}
                    </div>
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {activeEntry.user.fullName}
                      </h2>
                      <span
                        className={`text-xs font-mono font-semibold px-2.5 py-0.5 rounded-lg border ${getGradeBadgeStyle(
                          activeEntry.scorecard.grade
                        )}`}
                      >
                        {activeEntry.scorecard.grade}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeEntry.user.staffNumber || 'KMFRI-STAFF'} •{' '}
                      {data.directorates.find(
                        (d) => d.id === activeEntry.user.directorateId
                      )?.name || 'Oceans & Coastal Systems'}{' '}
                      ({activeEntry.user.position || 'Research Scientist'})
                    </p>
                    <div className="text-[11px] font-mono text-teal-700 dark:text-teal-400 mt-1">
                      Tier Classification: {activeEntry.scorecard.rankBadge}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right px-4 py-2 rounded-2xl bg-slate-900 text-white border border-slate-800">
                    <div className="text-[10px] font-mono uppercase text-slate-400">
                      Composite BSC Score
                    </div>
                    <div className="text-2xl font-bold font-mono text-teal-400">
                      {activeEntry.scorecard.totalScore}
                      <span className="text-xs text-slate-400 font-normal"> / 100</span>
                    </div>
                  </div>
                  {onSelectScientistProfile && (
                    <button
                      type="button"
                      onClick={() => onSelectScientistProfile(activeEntry.user.id)}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-sky-500 flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-sky-600" />
                      <span>Full Profile</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 4-Pillar Score Bars */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-sky-600" />
                      Projects
                    </span>
                    <span className="font-mono">
                      {activeEntry.scorecard.projectExecutionScore}/35
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-2 overflow-hidden">
                    <div
                      className="h-full bg-sky-600 rounded-full"
                      style={{
                        width: `${Math.round(
                          (activeEntry.scorecard.projectExecutionScore / 35) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                      Outputs
                    </span>
                    <span className="font-mono">
                      {activeEntry.scorecard.publicationsOutputScore}/25
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-2 overflow-hidden">
                    <div
                      className="h-full bg-teal-600 rounded-full"
                      style={{
                        width: `${Math.round(
                          (activeEntry.scorecard.publicationsOutputScore / 25) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      Grants
                    </span>
                    <span className="font-mono">
                      {activeEntry.scorecard.financialGrantScore}/20
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-2 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{
                        width: `${Math.round(
                          (activeEntry.scorecard.financialGrantScore / 20) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-amber-600" />
                      Events
                    </span>
                    <span className="font-mono">
                      {activeEntry.scorecard.eventsActivitiesScore}/20
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-2 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{
                        width: `${Math.round(
                          (activeEntry.scorecard.eventsActivitiesScore / 20) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Quadrant Cards with Itemized Score Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeEntry.scorecard.perspectives.map((p) => (
                <div
                  key={p.perspective}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        {p.perspective}
                      </h3>
                      <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 font-mono text-xs font-bold">
                        {p.earnedScore} / {p.maxScore} pts
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{p.summary}</p>

                    <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {p.items.length === 0 ? (
                        <div className="text-[11px] text-slate-400 italic py-2">
                          No qualifying records logged under this pillar yet.
                        </div>
                      ) : (
                        p.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px]"
                          >
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                              {item.label}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0 font-mono">
                              <span className="text-teal-700 dark:text-teal-400 font-semibold">
                                {item.points}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-[10px]">
                                {item.status}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>Pillar Attainment</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {p.percentage}% of target
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Institutional Ledger of Cruises, Field Expeditions & Related Scientific Events */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-teal-700 dark:text-teal-400">
              <Compass className="w-4 h-4" />
              <span>BALANCED SCORECARD PILLAR 4: CRUISES, FIELD EXPEDITIONS &amp; RELATED SCIENTIFIC EVENTS</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
              Institutional Scientific Events &amp; Field Expedition Ledger ({(data.researchActivities || []).length})
            </h3>
          </div>
          {!isViewer && (
            <button
              type="button"
              onClick={() => setShowEventModal(true)}
              className="px-3.5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Record Related Event / Cruise</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-mono uppercase text-slate-500">
                <th className="py-2.5 px-3">Event / Cruise Title</th>
                <th className="py-2.5 px-3">Event Category</th>
                <th className="py-2.5 px-3">Lead Scientist</th>
                <th className="py-2.5 px-3">Linked Project</th>
                <th className="py-2.5 px-3">Location &amp; Date</th>
                <th className="py-2.5 px-3">BSC Weight</th>
                <th className="py-2.5 px-3">Status</th>
                {!isViewer && <th className="py-2.5 px-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(data.researchActivities || []).map((act) => {
                const sci = data.users.find((u) => u.id === act.scientistId);
                const proj = data.projects.find((p) => p.id === act.projectId);
                const loc = data.locations.find((l) => l.id === act.locationId);
                return (
                  <tr
                    key={act.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {act.title}
                      </div>
                      {act.description && (
                        <div className="text-[11px] text-slate-500 line-clamp-1">
                          {act.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-sky-700 dark:text-sky-400">
                      {act.eventType || 'Field Expedition'}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {sci?.fullName || 'KMFRI Team'}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                      {proj ? proj.projectCode : 'Institute-Wide'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
                        <span>{loc ? `${loc.name} (${loc.county})` : 'Kenyan Coast'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span>{act.activityDate}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-teal-700 dark:text-teal-400">
                      +{act.scoreWeight ?? 10} pts
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[11px] ${
                          act.status === 'Completed'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : act.status === 'Ongoing'
                              ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {act.status === 'Completed' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        <span>{act.status}</span>
                      </span>
                    </td>
                    {!isViewer && (
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {act.status !== 'Completed' && (
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/activities/${act.id}`, {
                                  method: 'PUT',
                                  body: JSON.stringify({ status: 'Completed' }),
                                });
                                await onRefresh();
                              }}
                              className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-500 cursor-pointer"
                            >
                              Mark Completed
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/activities/${act.id}`, {
                                method: 'DELETE',
                              });
                              await onRefresh();
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Delete Event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Log New Cruise, Field Expedition or Scientific Event */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Log Scientific Event, Cruise or Field Expedition
                </h3>
                <p className="text-xs text-slate-500">
                  Automatically credits the scientist&apos;s Balanced Scorecard under Pillar 4
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  Event / Expedition Title *
                </label>
                <input
                  type="text"
                  required
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g., RV Mtafiti North Kenya Bank Acoustic & CTD Transect"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Event Category</label>
                  <select
                    value={eventType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEventType(val);
                      const preset = EVENT_TYPE_PRESETS.find((p) => p.label === val);
                      if (preset) setEventWeight(preset.defaultWeight);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {EVENT_TYPE_PRESETS.map((p) => (
                      <option key={p.label} value={p.label}>
                        {p.label} ({p.defaultWeight} pts)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">
                    BSC Score Weight (Points)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={25}
                    value={eventWeight}
                    onChange={(e) => setEventWeight(Number(e.target.value) || 10)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Lead Scientist *</label>
                  <select
                    value={eventScientistId}
                    onChange={(e) => setEventScientistId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {scientistUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.staffNumber || 'Staff'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Linked Research Project</label>
                  <select
                    value={eventProjectId}
                    onChange={(e) => setEventProjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">Institute-Wide Event</option>
                    {data.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} — {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Event Date</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Station / Location</label>
                  <select
                    value={eventLocationId}
                    onChange={(e) => setEventLocationId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">Kenyan Coast / General</option>
                    {data.locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.county})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Completion Status</label>
                  <select
                    value={eventStatus}
                    onChange={(e) =>
                      setEventStatus(e.target.value as 'Completed' | 'Ongoing' | 'Planned')
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="Completed">Completed (100% Weight)</option>
                    <option value="Ongoing">Ongoing (75% Weight)</option>
                    <option value="Planned">Planned (50% Weight)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Scientific Deliverables / Event Notes
                </label>
                <textarea
                  rows={2}
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  placeholder="Summarize cruise stations sampled, workshop resolutions, or lab calibration metrics..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEvent}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold cursor-pointer"
                >
                  {submittingEvent ? 'Recording...' : 'Save Event & Update Scorecard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
