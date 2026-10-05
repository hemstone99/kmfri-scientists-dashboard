import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  Download,
  Eye,
  FileSpreadsheet,
  FolderKanban,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  PermissionCode,
  Report,
  reportFormSchema,
  ReportStatus,
} from '../types/kmfri.ts';
import {
  exportToCSV,
  exportToExcel,
  exportToInstitutionalReportHTML,
  exportToMultiSheetExcel,
} from '../utils/exportUtils.ts';

type ReportFormValues = z.infer<typeof reportFormSchema>;

export function ReportsModule() {
  const { db, user, apiFetch, refreshData, hasPermission, showToast } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [reviewModalReport, setReviewModalReport] = useState<Report | null>(null);
  const [reviewerComments, setReviewerComments] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [exportScope, setExportScope] = useState<'my_portfolio' | 'all_portfolios'>('all_portfolios');

  const canSubmitReport = hasPermission(PermissionCode.REPORTS_SUBMIT);
  const canReviewReport = hasPermission(PermissionCode.REPORTS_REVIEW);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      title: '',
      project_id: '',
      scientist_id: '',
      report_type: 'Quarterly Progress',
      reporting_period: 'Q1 FY 2026/27',
      due_date: new Date().toISOString().split('T')[0],
      status: ReportStatus.DRAFT,
      summary: '',
    },
  });

  const operationalScientists = useMemo(() => {
    return db?.users.filter((u) => u.is_operational_scientist) || [];
  }, [db?.users]);
  const selectableScientists =
    operationalScientists.length > 0 ? operationalScientists : (db?.users || []);

  const filteredReports = useMemo(() => {
    if (!db) return [];
    return db.reports.filter((r) => {
      if (statusFilter === 'OVERDUE' && !r.is_overdue) return false;
      if (statusFilter !== 'all' && statusFilter !== 'OVERDUE' && r.status !== statusFilter)
        return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const proj = db.projects.find((p) => p.id === r.project_id);
        const sci = db.users.find((u) => u.id === r.scientist_id);
        const match =
          r.title.toLowerCase().includes(q) ||
          r.reporting_period.toLowerCase().includes(q) ||
          (proj?.project_code || '').toLowerCase().includes(q) ||
          (sci?.full_name || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [db, statusFilter, searchQuery]);

  if (!db) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mx-auto" />
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Loading Research Reports...
          </div>
        </div>
      </div>
    );
  }

  const openCreateModal = () => {
    setFormError(null);
    reset({
      title: '',
      project_id: db.projects[0]?.id || '',
      scientist_id: selectableScientists[0]?.id || '',
      report_type: 'Quarterly Progress',
      reporting_period: 'Q1 FY 2026/27',
      due_date: new Date().toISOString().split('T')[0],
      status: ReportStatus.DRAFT,
      summary: '',
    });
    setModalOpen(true);
  };

  const onSubmitReport = async (values: ReportFormValues) => {
    setFormError(null);
    try {
      await apiFetch('/reports', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      await refreshData();
      setModalOpen(false);
      showToast(`Created report "${values.title}" (${values.status})`);
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleWorkflowTransition = async (
    reportId: string,
    action: 'submit' | 'start_review' | 'approve' | 'reject',
    comments?: string
  ) => {
    try {
      await apiFetch(`/reports/${reportId}/workflow`, {
        method: 'POST',
        body: JSON.stringify({ action, comments }),
      });
      await refreshData();
      setReviewModalReport(null);
      setReviewerComments('');
      showToast(`Report workflow action '${action}' completed`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleExportReports = (format: 'csv' | 'excel' | 'pdf') => {
    const rows = filteredReports.map((r) => {
      const proj = db.projects.find((p) => p.id === r.project_id);
      const sci = db.users.find((u) => u.id === r.scientist_id);
      const rev = db.users.find((u) => u.id === r.reviewer_id);
      return {
        Title: r.title,
        Project: proj?.project_code || '—',
        Scientist: sci ? `${sci.title} ${sci.full_name}` : '—',
        Type: r.report_type,
        Period: r.reporting_period,
        Due_Date: r.due_date,
        Status: r.status,
        Overdue: r.is_overdue ? 'YES' : 'NO',
        Version: `v${r.version}`,
        Reviewer: rev ? rev.full_name : '—',
      };
    });
    if (format === 'csv') exportToCSV('kmfri_reports_registry', rows);
    if (format === 'excel') exportToExcel('kmfri_reports_registry', 'Reports', rows);
    if (format === 'pdf') {
      exportToInstitutionalReportHTML(
        'kmfri_reports_registry',
        'KMFRI Technical & Progress Reports Registry',
        `Exported by ${user?.full_name}`,
        rows
      );
    }
  };

  // Scope filtered projects & funding
  const scopedProjects = useMemo(() => {
    if (!db) return [];
    if (exportScope === 'my_portfolio' && user) {
      return db.projects.filter(
        (p) =>
          p.principal_investigator_id === user.id ||
          db.project_members.some((pm) => pm.project_id === p.id && pm.user_id === user.id)
      );
    }
    return db.projects;
  }, [db, exportScope, user]);

  const scopedFunding = useMemo(() => {
    if (!db) return [];
    if (exportScope === 'my_portfolio' && user) {
      const myProjIds = new Set(scopedProjects.map((p) => p.id));
      return db.funding.filter((f) => myProjIds.has(f.project_id));
    }
    return db.funding;
  }, [db, scopedProjects, exportScope, user]);

  // Export Project Portfolios to CSV or Excel for External Reporting
  const handleExportProjects = (format: 'csv' | 'excel') => {
    if (!db || scopedProjects.length === 0) {
      showToast('No projects available in this portfolio scope to export.', 'info');
      return;
    }

    const rows = scopedProjects.map((p) => {
      const dir = db.directorates.find((d) => d.id === p.directorate_id);
      const ra = db.research_areas.find((r) => r.id === p.research_area_id);
      const pi = db.users.find((u) => u.id === p.principal_investigator_id);
      const funder = db.funders.find((f) => f.id === p.primary_funder_id);
      const memberNames = db.project_members
        .filter((pm) => pm.project_id === p.id)
        .map((pm) => {
          const u = db.users.find((u) => u.id === pm.user_id);
          return u ? `${u.full_name} (${pm.project_role})` : '—';
        })
        .join('; ');
      const milestones = db.project_milestones.filter((m) => m.project_id === p.id);
      const completedMilestones = milestones.filter((m) => m.status === 'Completed').length;

      return {
        Project_Code: p.project_code,
        Title: p.title,
        Directorate: dir ? `${dir.name} (${dir.code})` : '—',
        Research_Area: ra ? ra.name : '—',
        Principal_Investigator: pi ? `${pi.title} ${pi.full_name} (${pi.staff_number})` : '—',
        Team_Members: memberNames || 'Principal Investigator only',
        Start_Date: p.start_date,
        End_Date: p.end_date,
        Status: p.status,
        Priority: p.priority,
        Budget: p.budget,
        Currency: p.currency,
        Primary_Funder: funder ? funder.name : 'Government of Kenya (GoK Core)',
        Progress_Percent: `${p.progress_percent}%`,
        Milestones_Completed: `${completedMilestones} of ${milestones.length}`,
        Deliverables: Array.isArray(p.deliverables) ? p.deliverables.join('; ') : '—',
        Risks_Issues: p.risks_issues || 'None flagged',
      };
    });

    const filename = `kmfri_project_portfolios_${exportScope}_${new Date().toISOString().slice(0, 10)}`;
    if (format === 'csv') {
      exportToCSV(filename, rows);
      showToast(`Exported ${rows.length} project portfolios as CSV`);
    } else {
      exportToExcel(filename, 'Project_Portfolios', rows);
      showToast(`Exported ${rows.length} project portfolios as Excel`);
    }
  };

  // Export Project Funding Data to CSV or Excel
  const handleExportFunding = (format: 'csv' | 'excel') => {
    if (!db || scopedFunding.length === 0) {
      showToast('No funding grant awards found in this portfolio scope.', 'info');
      return;
    }

    const rows = scopedFunding.map((f) => {
      const proj = db.projects.find((p) => p.id === f.project_id);
      const funder = db.funders.find((fun) => fun.id === f.funder_id);
      const pi = proj ? db.users.find((u) => u.id === proj.principal_investigator_id) : null;
      const rate = f.allocated_amount > 0 ? ((f.spent_amount / f.allocated_amount) * 100).toFixed(1) : '0';

      return {
        Grant_Number: f.grant_number,
        Project_Code: proj?.project_code || '—',
        Project_Title: proj?.title || '—',
        Lead_Investigator: pi ? `${pi.title} ${pi.full_name}` : '—',
        Funder_Name: funder ? funder.name : '—',
        Funder_Type: funder ? funder.funder_type : '—',
        Total_Grant_Award: f.amount,
        Currency: f.currency,
        Allocated_Budget: f.allocated_amount,
        Spent_Amount: f.spent_amount,
        Remaining_Balance: f.remaining_amount,
        Expenditure_Rate: `${rate}%`,
        Award_Date: f.award_date,
        Grant_Period: `${f.start_date} to ${f.end_date}`,
        Grant_Status: f.status,
        Conditions_Notes: f.notes || '—',
      };
    });

    const filename = `kmfri_funding_grants_${exportScope}_${new Date().toISOString().slice(0, 10)}`;
    if (format === 'csv') {
      exportToCSV(filename, rows);
      showToast(`Exported ${rows.length} grant awards as CSV`);
    } else {
      exportToExcel(filename, 'Funding_Grants', rows);
      showToast(`Exported ${rows.length} grant awards as Excel`);
    }
  };

  // Comprehensive Multi-Sheet External Reporting Dossier
  const handleExportComprehensiveDossier = () => {
    if (!db) return;

    // 1. Projects Sheet
    const projectRows = scopedProjects.map((p) => {
      const dir = db.directorates.find((d) => d.id === p.directorate_id);
      const ra = db.research_areas.find((r) => r.id === p.research_area_id);
      const pi = db.users.find((u) => u.id === p.principal_investigator_id);
      const funder = db.funders.find((f) => f.id === p.primary_funder_id);
      return {
        Project_Code: p.project_code,
        Title: p.title,
        Directorate: dir ? dir.code : '—',
        Research_Area: ra ? ra.name : '—',
        Lead_PI: pi ? `${pi.title} ${pi.full_name}` : '—',
        Status: p.status,
        Priority: p.priority,
        Budget: p.budget,
        Currency: p.currency,
        Primary_Funder: funder ? funder.name : 'GoK',
        Progress: `${p.progress_percent}%`,
        Start_Date: p.start_date,
        End_Date: p.end_date,
      };
    });

    // 2. Funding Sheet
    const fundingRows = scopedFunding.map((f) => {
      const proj = db.projects.find((p) => p.id === f.project_id);
      const funder = db.funders.find((fun) => fun.id === f.funder_id);
      return {
        Grant_Number: f.grant_number,
        Project_Code: proj?.project_code || '—',
        Funder: funder ? funder.name : '—',
        Award_Amount: f.amount,
        Currency: f.currency,
        Allocated: f.allocated_amount,
        Spent: f.spent_amount,
        Remaining: f.remaining_amount,
        Award_Date: f.award_date,
        Status: f.status,
      };
    });

    // 3. Reports Sheet
    const reportRows = filteredReports.map((r) => {
      const proj = db.projects.find((p) => p.id === r.project_id);
      const sci = db.users.find((u) => u.id === r.scientist_id);
      return {
        Report_Title: r.title,
        Project_Code: proj?.project_code || '—',
        Scientist: sci ? sci.full_name : '—',
        Type: r.report_type,
        Period: r.reporting_period,
        Due_Date: r.due_date,
        Status: r.status,
        Overdue: r.is_overdue ? 'YES' : 'NO',
      };
    });

    const filename = `kmfri_comprehensive_external_dossier_${new Date().toISOString().slice(0, 10)}`;
    exportToMultiSheetExcel(filename, [
      { title: 'Project Portfolios', rows: projectRows },
      { title: 'Funding & Grants', rows: fundingRows },
      { title: 'Technical Reports', rows: reportRows },
    ]);
    showToast('Comprehensive Multi-Sheet External Dossier generated successfully!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* External Reporting & Portfolios / Funding Export Center */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                External Reporting &amp; Portfolios / Funding Export Center
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Generate structured CSV and Excel reports for parent ministries (Ministry of Mining, Blue Economy and Maritime Affairs), bilateral donors, and oversight bodies.
            </p>
          </div>

          {/* Scope Selector */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setExportScope('all_portfolios')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                exportScope === 'all_portfolios'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All Institute Portfolios
            </button>
            <button
              type="button"
              onClick={() => setExportScope('my_portfolio')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                exportScope === 'my_portfolio'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              My Portfolios &amp; Grants
            </button>
          </div>
        </div>

        {/* Action Export Buttons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          {/* Card 1: Project Portfolios */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FolderKanban className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Project Portfolios</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500 font-semibold">
                  {scopedProjects.length} Projects
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Project codes, milestones, deliverables, objectives, PI, team members, budget &amp; risks.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleExportProjects('csv')}
                className="flex-1 px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1 shadow-2xs transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-sky-600" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportProjects('excel')}
                className="flex-1 px-2.5 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center justify-center gap-1 shadow-2xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel (.xls)</span>
              </button>
            </div>
          </div>

          {/* Card 2: Funding & Grants */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Funding &amp; Grants Data</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500 font-semibold">
                  {scopedFunding.length} Grants
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Grant numbers, donors, award amounts, expenditures, remaining balances &amp; utilization rates.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleExportFunding('csv')}
                className="flex-1 px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1 shadow-2xs transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportFunding('excel')}
                className="flex-1 px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1 shadow-2xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel (.xls)</span>
              </button>
            </div>
          </div>

          {/* Card 3: Complete Comprehensive Multi-Sheet Dossier */}
          <div className="p-3.5 rounded-lg bg-linear-to-br from-[#0A2540] to-sky-900 text-white space-y-2.5 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5 text-sky-200">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Comprehensive Dossier</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-200 border border-sky-400/30">
                  Multi-Sheet
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                Single unified Excel workbook with 3 sheets: Project Portfolios, Funding &amp; Grants, and Technical Reports.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportComprehensiveDossier}
              className="w-full px-3 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download External Dossier (Excel)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by report title, project code, or scientist..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', ...Object.values(ReportStatus), 'OVERDUE'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-[#0A2540] dark:bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {st === 'all' ? 'All Reports' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {filteredReports.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <ClipboardCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              No Technical or Progress Reports Logged Yet
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Draft or submit a project report to initiate the Draft → Submit → Review → Approve/Reject supervisory workflow.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500">
                  <th className="py-3 px-4 font-semibold">Report Title &amp; Type</th>
                  <th className="py-3 px-4 font-semibold">Project · Scientist</th>
                  <th className="py-3 px-4 font-semibold">Period · Due Date</th>
                  <th className="py-3 px-4 font-semibold">Status · Version</th>
                  <th className="py-3 px-4 font-semibold">Reviewer Notes</th>
                  <th className="py-3 px-4 font-semibold">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredReports.map((r) => {
                  const proj = db.projects.find((p) => p.id === r.project_id);
                  const sci = db.users.find((u) => u.id === r.scientist_id);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {r.title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{r.report_type}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-sky-700 dark:text-sky-400">
                          {proj?.project_code || '—'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {sci ? `${sci.title} ${sci.full_name}` : '—'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div>{r.reporting_period}</div>
                        <div
                          className={`text-[11px] flex items-center gap-1 ${
                            r.is_overdue ? 'text-rose-600 font-semibold' : 'text-slate-500'
                          }`}
                        >
                          {r.is_overdue && <AlertTriangle className="w-3 h-3" />}
                          <span>Due: {r.due_date}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className="font-semibold">{r.status}</span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span>v{r.version}</span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-500">
                        {r.reviewer_comments || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {canSubmitReport &&
                            (r.status === ReportStatus.DRAFT ||
                              r.status === ReportStatus.REJECTED) && (
                              <button
                                type="button"
                                onClick={() => handleWorkflowTransition(r.id, 'submit')}
                                className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold flex items-center gap-1"
                              >
                                <Send className="w-3 h-3" />
                                <span>{r.status === ReportStatus.REJECTED ? 'Resubmit' : 'Submit'}</span>
                              </button>
                            )}
                          {canReviewReport &&
                            (r.status === ReportStatus.SUBMITTED ||
                              r.status === ReportStatus.UNDER_REVIEW) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewModalReport(r);
                                  setReviewerComments(r.reviewer_comments || '');
                                }}
                                className="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-semibold flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Review / Approve</span>
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Report Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Create / Submit Project Report
              </h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            {formError && (
              <div className="mb-3 p-2.5 rounded bg-rose-50 text-xs text-rose-700">{formError}</div>
            )}
            <form onSubmit={handleSubmit(onSubmitReport)} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Report Title *</label>
                <input
                  type="text"
                  {...register('title')}
                  placeholder="Q1 Hydrographic & Plankton Biomass Technical Report"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                {errors.title && <p className="text-rose-600 mt-1">{errors.title.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Project *</label>
                  <select
                    {...register('project_id')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="">Select Project...</option>
                    {db.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.project_code} — {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Lead Scientist *</label>
                  <select
                    {...register('scientist_id')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="">Select Scientist...</option>
                    {selectableScientists.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} {s.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Report Type *</label>
                  <select
                    {...register('report_type')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="Quarterly Progress">Quarterly Progress</option>
                    <option value="Annual Technical">Annual Technical</option>
                    <option value="Financial Audit">Financial Audit</option>
                    <option value="Field Expedition">Field Expedition</option>
                    <option value="Final Completion">Final Completion</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Reporting Period *</label>
                  <input
                    type="text"
                    {...register('reporting_period')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Due Date *</label>
                  <input
                    type="date"
                    {...register('due_date')}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">Initial Workflow Status *</label>
                <select
                  {...register('status')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={ReportStatus.DRAFT}>Save as Draft</option>
                  <option value={ReportStatus.SUBMITTED}>Submit Immediately for Review</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Executive Summary &amp; Findings *</label>
                <textarea
                  rows={3}
                  {...register('summary')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                {errors.summary && <p className="text-rose-600 mt-1">{errors.summary.message}</p>}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white font-semibold"
                >
                  Save Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supervisory Review Modal */}
      {reviewModalReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Supervisory Report Review — {reviewModalReport.title}
              </h3>
              <button type="button" onClick={() => setReviewModalReport(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="text-xs space-y-2 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="font-mono text-slate-500">
                Type: {reviewModalReport.report_type} · Period: {reviewModalReport.reporting_period}{' '}
                · Version: v{reviewModalReport.version}
              </div>
              <p className="text-slate-800 dark:text-slate-200">{reviewModalReport.summary}</p>
            </div>

            <div className="text-xs">
              <label className="block font-medium mb-1">Reviewer Evaluation &amp; Comments</label>
              <textarea
                rows={3}
                value={reviewerComments}
                onChange={(e) => setReviewerComments(e.target.value)}
                placeholder="Enter technical review remarks, methodology feedback, or approval notes..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              {reviewModalReport.status === ReportStatus.SUBMITTED && (
                <button
                  type="button"
                  onClick={() =>
                    handleWorkflowTransition(
                      reviewModalReport.id,
                      'start_review',
                      reviewerComments
                    )
                  }
                  className="px-3 py-2 rounded-lg border border-sky-500 text-sky-700 dark:text-sky-300 text-xs font-semibold"
                >
                  Mark Under Review
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  handleWorkflowTransition(reviewModalReport.id, 'reject', reviewerComments)
                }
                className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reject for Revision</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleWorkflowTransition(reviewModalReport.id, 'approve', reviewerComments)
                }
                className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve Report</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
