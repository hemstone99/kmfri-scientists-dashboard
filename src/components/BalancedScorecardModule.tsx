import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  FileCheck,
  Filter,
  GraduationCap,
  Layers,
  Printer,
  Search,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { useAuth } from '../context/AuthContext.tsx';
import { ScientistBscScore } from '../types/kmfri.ts';
import { getAllScientistsBscScores } from '../utils/bscEngine.ts';
import { UserAvatar } from './UserAvatar.tsx';
import { exportToCSV, exportToExcel, exportToInstitutionalReportHTML } from '../utils/exportUtils.ts';
import { KmfriLogo } from './KmfriLogo.tsx';

export const BalancedScorecardModule: React.FC = () => {
  const { db, user, setSelectedScientistId, setActiveModule } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [directorateFilter, setDirectorateFilter] = useState('all');
  const [selectedScorecard, setSelectedScorecard] = useState<ScientistBscScore | null>(null);
  const [certificateModal, setCertificateModal] = useState<ScientistBscScore | null>(null);

  const allScores = useMemo(() => {
    if (!db) return [];
    return getAllScientistsBscScores(db);
  }, [db]);

  const filteredScores = useMemo(() => {
    return allScores.filter((s) => {
      if (directorateFilter !== 'all' && s.directorate_name !== directorateFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.scientist_name.toLowerCase().includes(q) ||
          s.staff_number.toLowerCase().includes(q) ||
          s.position.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allScores, directorateFilter, searchQuery]);

  const stats = useMemo(() => {
    if (allScores.length === 0) {
      return { average: 0, topScore: 0, gradeACount: 0, gradeBCount: 0 };
    }
    const sum = allScores.reduce((acc, s) => acc + s.total_score, 0);
    const avg = Math.round((sum / allScores.length) * 10) / 10;
    const top = Math.max(...allScores.map((s) => s.total_score));
    const gradeA = allScores.filter((s) => s.grade === 'A+' || s.grade === 'A').length;
    const gradeB = allScores.filter((s) => s.grade === 'B').length;
    return { average: avg, topScore: top, gradeACount: gradeA, gradeBCount: gradeB };
  }, [allScores]);

  // Directorate Comparison data
  const directorateComparison = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    allScores.forEach((s) => {
      const cur = map.get(s.directorate_name) || { total: 0, count: 0 };
      cur.total += s.total_score;
      cur.count += 1;
      map.set(s.directorate_name, cur);
    });
    return Array.from(map.entries()).map(([name, data]) => ({
      name: name.replace('Directorate', '').trim(),
      avgScore: Math.round((data.total / data.count) * 10) / 10,
      scientists: data.count,
    }));
  }, [allScores]);

  // Radar Chart data for selected scientist
  const radarData = useMemo(() => {
    if (!selectedScorecard) return [];
    return [
      {
        perspective: 'Scientific Excellence (40%)',
        score: selectedScorecard.perspectives.scientific_excellence.percent,
        fullMark: 100,
      },
      {
        perspective: 'Policy & Stakeholders (25%)',
        score: selectedScorecard.perspectives.policy_stakeholder_impact.percent,
        fullMark: 100,
      },
      {
        perspective: 'Grant Stewardship (20%)',
        score: selectedScorecard.perspectives.grant_stewardship.percent,
        fullMark: 100,
      },
      {
        perspective: 'Capacity & Collab (15%)',
        score: selectedScorecard.perspectives.capacity_collaboration.percent,
        fullMark: 100,
      },
    ];
  }, [selectedScorecard]);

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const rows = filteredScores.map((s) => ({
      Rank: s.rank,
      Staff_Number: s.staff_number,
      Full_Name: `${s.title} ${s.scientist_name}`,
      Position: s.position,
      Directorate: s.directorate_name,
      Score: `${s.total_score}/100`,
      Grade: s.grade,
      Scientific_Excellence: `${s.perspectives.scientific_excellence.score}/40`,
      Policy_Impact: `${s.perspectives.policy_stakeholder_impact.score}/25`,
      Grant_Stewardship: `${s.perspectives.grant_stewardship.score}/20`,
      Collaboration: `${s.perspectives.capacity_collaboration.score}/15`,
    }));

    if (format === 'csv') exportToCSV('kmfri_balanced_scorecard_evaluations', rows);
    if (format === 'excel') exportToExcel('kmfri_balanced_scorecard_evaluations', 'BSC Scores', rows);
    if (format === 'pdf') {
      exportToInstitutionalReportHTML(
        'kmfri_balanced_scorecard_evaluations',
        'KMFRI Scientific Performance & Balanced Scorecard Registry',
        'Official Institutional Performance Contracting & Researcher Evaluations',
        rows
      );
    }
  };

  const directoratesList = useMemo(() => {
    if (!db) return [];
    return db.directorates.map((d) => d.name);
  }, [db]);

  if (!db) return null;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0A2540] via-sky-950 to-teal-950 text-white rounded-xl p-5 sm:p-6 border border-sky-800/50 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Institutional Performance Contracting
              </span>
              <span className="text-xs text-sky-200/80">FY 2026/2027 Scientific Audit</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Trophy className="w-6 h-6 text-amber-400 shrink-0" />
              <span>KMFRI Scientific Balanced Scorecard (BSC)</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Automated, data-driven researcher performance evaluation framework. Calculates individual and directorate scores based on peer-reviewed research outputs, statutory technical reports, grant mobilization, milestone completions, and blue economy stakeholder impact.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('excel')}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Official Report</span>
            </button>
          </div>
        </div>

        {/* Institutional KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-5 border-t border-sky-800/60">
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-[11px] text-sky-200">Institutional Average Score</div>
            <div className="text-2xl font-mono font-bold text-white mt-0.5">{stats.average}<span className="text-xs text-sky-300">/100</span></div>
            <div className="text-[10px] text-teal-300 mt-0.5">● Benchmark: 70.0 (Satisfactory)</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-[11px] text-sky-200">Top Researcher Score</div>
            <div className="text-2xl font-mono font-bold text-amber-400 mt-0.5">{stats.topScore}<span className="text-xs text-sky-300">/100</span></div>
            <div className="text-[10px] text-amber-300 mt-0.5">★ Grade A+ (Exceptional)</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-[11px] text-sky-200">Grade A / A+ Personnel</div>
            <div className="text-2xl font-mono font-bold text-emerald-400 mt-0.5">{stats.gradeACount}</div>
            <div className="text-[10px] text-slate-300 mt-0.5">High Performance Band</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-[11px] text-sky-200">Total Evaluated Scientists</div>
            <div className="text-2xl font-mono font-bold text-sky-400 mt-0.5">{allScores.length}</div>
            <div className="text-[10px] text-slate-300 mt-0.5">100% Audit Coverage</div>
          </div>
        </div>
      </div>

      {/* 4 Perspectives Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-700 dark:text-sky-400">
            <span>Perspective 1</span>
            <span className="font-mono px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">Weight: 40%</span>
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white mt-1.5 text-sm">
            Research &amp; Scientific Excellence
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Refereed publications in peer-reviewed journals, marine datasets archived, and milestones delivered on schedule.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-teal-700 dark:text-teal-400">
            <span>Perspective 2</span>
            <span className="font-mono px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/20">Weight: 25%</span>
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white mt-1.5 text-sm">
            Policy &amp; Blue Economy Impact
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Approved statutory technical reports, environmental advisories to Ministry, and fisherfolk capacity workshops.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-700 dark:text-indigo-400">
            <span>Perspective 3</span>
            <span className="font-mono px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">Weight: 20%</span>
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white mt-1.5 text-sm">
            Grant Stewardship &amp; Delivery
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            External research funding mobilization, Principal Investigator stewardship, budget discipline, and zero audit queries.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-400">
            <span>Perspective 4</span>
            <span className="font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">Weight: 15%</span>
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white mt-1.5 text-sm">
            Capacity &amp; Collaboration
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Regional &amp; international partner MOUs, inter-directorate team appointments, and mentoring junior research scientists.
          </p>
        </div>
      </div>

      {/* Directorate Comparison Chart & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Directorate Average Scientific Score Comparison
            </h2>
            <p className="text-xs text-slate-500">Benchmark across all 5 official research directorates</p>
          </div>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={directorateComparison} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-10} textAnchor="end" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(val: any) => [`${val}/100`, 'Average Score']}
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px', fontSize: '12px' }}
              />
              <Bar dataKey="avgScore" fill="#0284c7" radius={[6, 6, 0, 0]}>
                {directorateComparison.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={['#0284c7', '#0d9488', '#2563eb', '#0891b2', '#7c3aed'][index % 5]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scientist Rankings Table & Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Scientist Performance Rankings &amp; Scorecards
            </h2>
            <p className="text-xs text-slate-500">Click any researcher to inspect their full 4-perspective score breakdown or generate a certified scorecard</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search scientist..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>
            <select
              value={directorateFilter}
              onChange={(e) => setDirectorateFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              <option value="all">All Directorates</option>
              {directoratesList.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 w-12 text-center">Rank</th>
                <th className="py-3 px-4">Scientist</th>
                <th className="py-3 px-4">Directorate</th>
                <th className="py-3 px-4 text-center">Excellence (40)</th>
                <th className="py-3 px-4 text-center">Policy (25)</th>
                <th className="py-3 px-4 text-center">Grants (20)</th>
                <th className="py-3 px-4 text-center">Collab (15)</th>
                <th className="py-3 px-4 text-right">Total Score</th>
                <th className="py-3 px-4 text-center">Grade</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredScores.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No scientist records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredScores.map((s) => (
                  <tr
                    key={s.scientist_id}
                    onClick={() => setSelectedScorecard(s)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold font-mono text-xs ${
                          s.rank === 1
                            ? 'bg-amber-400 text-slate-950 shadow-xs'
                            : s.rank === 2
                            ? 'bg-slate-300 text-slate-900'
                            : s.rank === 3
                            ? 'bg-amber-600/30 text-amber-300'
                            : 'text-slate-500'
                        }`}
                      >
                        {s.rank}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={s.scientist_name} avatarUrl={s.avatar_url} size="sm" />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {s.title} {s.scientist_name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {s.staff_number} · {s.position}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {s.directorate_name}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium text-sky-700 dark:text-sky-400">
                      {s.perspectives.scientific_excellence.score}/40
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium text-teal-700 dark:text-teal-400">
                      {s.perspectives.policy_stakeholder_impact.score}/25
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium text-indigo-700 dark:text-indigo-400">
                      {s.perspectives.grant_stewardship.score}/20
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium text-amber-700 dark:text-amber-400">
                      {s.perspectives.capacity_collaboration.score}/15
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                        {s.total_score}
                      </span>
                      <span className="text-slate-400 text-[10px]">/100</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded font-bold font-mono text-[11px] ${
                          s.grade === 'A+'
                            ? 'bg-amber-400/20 text-amber-500 dark:text-amber-300 border border-amber-400/30'
                            : s.grade === 'A'
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : s.grade === 'B'
                            ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30'
                            : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {s.grade}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCertificateModal(s);
                        }}
                        className="px-2.5 py-1 rounded bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 hover:bg-sky-100 text-[11px] font-semibold border border-sky-200 dark:border-sky-800"
                      >
                        Certificate
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Scientist Balanced Scorecard Modal */}
      {selectedScorecard && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="bg-gradient-to-r from-[#0A2540] via-sky-900 to-teal-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <UserAvatar
                  name={selectedScorecard.scientist_name}
                  avatarUrl={selectedScorecard.avatar_url}
                  size="lg"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-teal-500/20 text-teal-300">
                      Rank #{selectedScorecard.rank} Institutional
                    </span>
                    <span className="text-xs font-mono text-sky-200">
                      {selectedScorecard.staff_number}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white mt-0.5">
                    {selectedScorecard.title} {selectedScorecard.scientist_name}
                  </h3>
                  <div className="text-xs text-sky-200">
                    {selectedScorecard.position} · {selectedScorecard.directorate_name}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-3xl font-black font-mono text-amber-400">
                    {selectedScorecard.total_score}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                    Grade {selectedScorecard.grade}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedScorecard(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
              {/* Radar Chart & Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="h-64 w-full bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#64748b" opacity={0.3} />
                      <PolarAngleAxis dataKey="perspective" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                      <Radar name="Scientist Score" dataKey="score" stroke="#0284c7" fill="#0284c7" fillOpacity={0.4} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    Operational Evidence Matrix
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-slate-500 text-[11px]">Projects Led (PI)</div>
                      <div className="text-base font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                        {selectedScorecard.metrics.projects_led}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-slate-500 text-[11px]">Milestones Completed</div>
                      <div className="text-base font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                        {selectedScorecard.metrics.milestones_completed}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-slate-500 text-[11px]">Publications Catalogued</div>
                      <div className="text-base font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                        {selectedScorecard.metrics.publications_count}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-slate-500 text-[11px]">Approved Reports</div>
                      <div className="text-base font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                        {selectedScorecard.metrics.reports_approved}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>{selectedScorecard.grade_label}</span>
                    </div>
                    <div className="text-[11px] mt-1 text-slate-600 dark:text-slate-300">
                      Scientist is in compliance with Kenya Public Service Performance Contracting benchmarks.
                    </div>
                  </div>
                </div>
              </div>

              {/* Perspective Breakdowns */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  Detailed Perspective Point Audit
                </h4>

                {/* Perspective 1 */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      1. Research &amp; Scientific Excellence
                    </span>
                    <span className="font-mono font-bold text-sky-600">
                      {selectedScorecard.perspectives.scientific_excellence.score} / 40 pts
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full"
                      style={{ width: `${selectedScorecard.perspectives.scientific_excellence.percent}%` }}
                    />
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
                    {selectedScorecard.perspectives.scientific_excellence.details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>

                {/* Perspective 2 */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      2. Policy &amp; Blue Economy Stakeholder Impact
                    </span>
                    <span className="font-mono font-bold text-teal-600">
                      {selectedScorecard.perspectives.policy_stakeholder_impact.score} / 25 pts
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full"
                      style={{ width: `${selectedScorecard.perspectives.policy_stakeholder_impact.percent}%` }}
                    />
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
                    {selectedScorecard.perspectives.policy_stakeholder_impact.details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>

                {/* Perspective 3 */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      3. Grant Stewardship &amp; Project Delivery
                    </span>
                    <span className="font-mono font-bold text-indigo-600">
                      {selectedScorecard.perspectives.grant_stewardship.score} / 20 pts
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${selectedScorecard.perspectives.grant_stewardship.percent}%` }}
                    />
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
                    {selectedScorecard.perspectives.grant_stewardship.details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>

                {/* Perspective 4 */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      4. Institutional Capacity &amp; Collaboration
                    </span>
                    <span className="font-mono font-bold text-amber-600">
                      {selectedScorecard.perspectives.capacity_collaboration.score} / 15 pts
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${selectedScorecard.perspectives.capacity_collaboration.percent}%` }}
                    />
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
                    {selectedScorecard.perspectives.capacity_collaboration.details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setSelectedScientistId(selectedScorecard.scientist_id);
                  setActiveModule('scientists');
                  setSelectedScorecard(null);
                }}
                className="text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline flex items-center gap-1"
              >
                <span>Open Full Scientist Profile</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCertificateModal(selectedScorecard);
                  }}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <Award className="w-4 h-4" />
                  <span>Generate Certificate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedScorecard(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Printable Balanced Scorecard Certificate Modal */}
      {certificateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white text-slate-900 border-8 border-double border-[#0A2540] rounded-xl p-8 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setCertificateModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-500 print:hidden"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Certificate Header */}
            <div className="text-center space-y-2 border-b-2 border-[#0A2540] pb-6">
              <div className="flex justify-center">
                <KmfriLogo variant="full" size="lg" />
              </div>
              <div className="text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
                Republic of Kenya · Ministry of Mining, Blue Economy and Maritime Affairs
              </div>
              <h2 className="text-2xl font-serif font-black tracking-wide text-[#0A2540] pt-1">
                CERTIFICATE OF SCIENTIFIC EXCELLENCE
              </h2>
              <div className="text-xs italic text-slate-500">
                Institutional Balanced Scorecard Evaluation &amp; Performance Contracting
              </div>
            </div>

            {/* Certificate Body */}
            <div className="py-8 text-center space-y-4">
              <p className="text-xs text-slate-600 uppercase tracking-widest font-mono">
                This is to officially certify that
              </p>
              <div className="text-2xl font-serif font-bold text-slate-950 underline decoration-[#0284c7] decoration-2 underline-offset-8">
                {certificateModal.title} {certificateModal.scientist_name}
              </div>
              <div className="text-xs font-mono text-slate-600">
                Staff Number: {certificateModal.staff_number} · {certificateModal.position}
              </div>
              <div className="text-xs text-slate-700 max-w-lg mx-auto leading-relaxed pt-2">
                has successfully completed the comprehensive Performance Contracting &amp; Scientific Balanced Scorecard (BSC) evaluation within the{' '}
                <strong className="text-slate-900">{certificateModal.directorate_name}</strong> for the reporting period, obtaining an aggregate score of:
              </div>

              {/* Big Score Seal */}
              <div className="inline-flex flex-col items-center justify-center w-28 h-28 rounded-full border-4 border-amber-500 bg-amber-50/60 mx-auto my-2 shadow-inner">
                <span className="text-3xl font-black font-mono text-[#0A2540]">
                  {certificateModal.total_score}
                </span>
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                  Grade {certificateModal.grade}
                </span>
              </div>

              <div className="text-xs font-semibold text-teal-800 uppercase tracking-wider">
                {certificateModal.grade_label}
              </div>

              {/* 4 Perspectives Summary Table on Certificate */}
              <div className="grid grid-cols-4 gap-2 pt-4 max-w-md mx-auto text-left text-[11px] font-mono border-t border-slate-200">
                <div className="p-1.5 bg-slate-50 rounded">
                  <div className="text-[9px] text-slate-500">Excellence</div>
                  <div className="font-bold">{certificateModal.perspectives.scientific_excellence.score}/40</div>
                </div>
                <div className="p-1.5 bg-slate-50 rounded">
                  <div className="text-[9px] text-slate-500">Policy</div>
                  <div className="font-bold">{certificateModal.perspectives.policy_stakeholder_impact.score}/25</div>
                </div>
                <div className="p-1.5 bg-slate-50 rounded">
                  <div className="text-[9px] text-slate-500">Grants</div>
                  <div className="font-bold">{certificateModal.perspectives.grant_stewardship.score}/20</div>
                </div>
                <div className="p-1.5 bg-slate-50 rounded">
                  <div className="text-[9px] text-slate-500">Collab</div>
                  <div className="font-bold">{certificateModal.perspectives.capacity_collaboration.score}/15</div>
                </div>
              </div>
            </div>

            {/* Certificate Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t-2 border-slate-200 text-center text-xs text-slate-600">
              <div>
                <div className="font-serif italic font-bold text-slate-900 border-b border-slate-400 pb-1 mx-8">
                  Prof. James Njiru, PhD
                </div>
                <div className="font-semibold text-slate-900 mt-1">Director General</div>
                <div className="text-[10px] text-slate-500">Kenya Marine and Fisheries Research Institute</div>
              </div>
              <div>
                <div className="font-serif italic font-bold text-slate-900 border-b border-slate-400 pb-1 mx-8">
                  Dr. Nina Wambui, PhD
                </div>
                <div className="font-semibold text-slate-900 mt-1">Director of Research &amp; Governance</div>
                <div className="text-[10px] text-slate-500">Performance Contracting Secretariat</div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-[#0A2540] text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Certificate</span>
              </button>
              <button
                type="button"
                onClick={() => setCertificateModal(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
