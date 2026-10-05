import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  Archive,
  ArrowLeft,
  ArrowUpDown,
  BarChart3,
  Calendar,
  CheckCircle2,
  Download,
  Edit3,
  FolderKanban,
  Layers,
  Plus,
  Search,
  Table,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  PermissionCode,
  Project,
   projectFormSchema,
  ProjectPriority,
  ProjectStatus,
} from '../types/kmfri.ts';
import { GisMapCanvas } from './GisMapCanvas.tsx';
import { exportToCSV, exportToExcel, exportToInstitutionalReportHTML } from '../utils/exportUtils.ts';
import { ProjectMilestonesGantt, PortfolioGanttChart } from './ProjectGanttChart.tsx';

type ProjectFormValues = z.infer<typeof projectFormSchema>;

type ProjectTab =
  | 'Overview'
  | 'Team'
  | 'Timeline'
  | 'Budget'
  | 'Funding'
  | 'Locations'
  | 'Collaborators'
  | 'Milestones'
  | 'Reports'
  | 'Documents'
  | 'Activity';

const PROJECT_TABS: ProjectTab[] = [
  'Overview',
  'Team',
  'Timeline',
  'Budget',
  'Funding',
  'Locations',
  'Collaborators',
  'Milestones',
  'Reports',
  'Documents',
  'Activity',
];

export function ProjectsModule() {
  const {
    db,
    user,
    selectedProjectId,
    setSelectedProjectId,
    setSelectedScientistId,
    setActiveModule,
    apiFetch,
    refreshData,
    hasPermission,
    showToast,
  } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [dirFilter, setDirFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [activeTab, setActiveTab] = useState<ProjectTab>('Overview');
  const [portfolioViewMode, setPortfolioViewMode] = useState<'table' | 'gantt'>('table');

  // Create / Edit Project Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Team Assignment State
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Co-Investigator');
  const [newMemberAllocation, setNewMemberAllocation] = useState(25);

  // Milestone Creation State
  const [msTitle, setMsTitle] = useState('');
  const [msDueDate, setMsDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [msDesc, setMsDesc] = useState('');
  const [msDeliverable, setMsDeliverable] = useState('');

  const canCreateProject = hasPermission(PermissionCode.PROJECTS_CREATE);
  const canEditProject = hasPermission(PermissionCode.PROJECTS_EDIT);
  const canApproveProject = hasPermission(PermissionCode.PROJECTS_APPROVE);
  const canArchiveProject = hasPermission(PermissionCode.PROJECTS_ARCHIVE);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema) as any,
    defaultValues: {
      project_code: '',
      title: '',
      description: '',
      objectives_text: '',
      directorate_id: '30000000-0000-4000-8000-000000000001',
      research_area_id: '40000000-0000-4000-8000-000000000001',
      principal_investigator_id: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '2027-06-30',
      status: ProjectStatus.PROPOSED,
      priority: ProjectPriority.HIGH,
      budget: 15000000,
      currency: 'KES',
      primary_funder_id: '',
      deliverables_text: '',
      progress_percent: 0,
      risks_issues: '',
    },
  });

  const watchedDirId = watch('directorate_id');

  const operationalScientists = useMemo(() => {
    return db?.users.filter((u) => u.is_operational_scientist) || [];
  }, [db?.users]);
  const selectableInvestigators =
    operationalScientists.length > 0 ? operationalScientists : (db?.users || []);

  const filteredProjects = useMemo(() => {
    if (!db) return [];
    return db.projects.filter((p) => {
      if (!showArchived && p.is_archived) return false;
      if (showArchived && !p.is_archived) return false;
      if (dirFilter !== 'all' && p.directorate_id !== dirFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          p.project_code.toLowerCase().includes(q) ||
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [db, showArchived, dirFilter, statusFilter, searchQuery]);

  const selectedProject = useMemo(
    () => (db ? db.projects.find((p) => p.id === selectedProjectId) || null : null),
    [db, selectedProjectId]
  );

  const openCreateModal = () => {
    if (!db) return;
    setEditingProject(null);
    setFormError(null);
    reset({
      project_code: `KMFRI-OCS-${new Date().getFullYear()}-${Math.floor(10 + Math.random() * 89)}`,
      title: '',
      description: '',
      objectives_text: '',
      directorate_id: db.directorates[0]?.id || '',
      research_area_id: db.research_areas[0]?.id || '',
      principal_investigator_id: selectableInvestigators[0]?.id || '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '2027-06-30',
      status: ProjectStatus.PROPOSED,
      priority: ProjectPriority.HIGH,
      budget: 12500000,
      currency: 'KES',
      primary_funder_id: db.funders[0]?.id || '',
      deliverables_text: '',
      progress_percent: 0,
      risks_issues: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (proj: Project) => {
    setEditingProject(proj);
    setFormError(null);
    reset({
      project_code: proj.project_code,
      title: proj.title,
      description: proj.description,
      objectives_text: proj.objectives.join('\n'),
      directorate_id: proj.directorate_id,
      research_area_id: proj.research_area_id,
      principal_investigator_id: proj.principal_investigator_id,
      start_date: proj.start_date,
      end_date: proj.end_date,
      status: proj.status,
      priority: proj.priority,
      budget: proj.budget,
      currency: proj.currency,
      primary_funder_id: proj.primary_funder_id || '',
      deliverables_text: proj.deliverables.join('\n'),
      progress_percent: proj.progress_percent,
      risks_issues: proj.risks_issues,
    });
    setModalOpen(true);
  };

  const onSubmitProject = async (values: ProjectFormValues) => {
    setFormError(null);
    try {
      if (editingProject) {
        await apiFetch(`/projects/${editingProject.id}`, {
          method: 'PUT',
          body: JSON.stringify(values),
        });
        showToast(`Updated project ${values.project_code}`);
      } else {
        const created = await apiFetch<Project>('/projects', {
          method: 'POST',
          body: JSON.stringify(values),
        });
        showToast(`Created project ${created.project_code}`);
      }
      await refreshData();
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleStatusDecision = async (proj: Project, newStatus: ProjectStatus) => {
    try {
      await apiFetch(`/projects/${proj.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      });
      await refreshData();
      showToast(`Project ${proj.project_code} transitioned to '${newStatus}'`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleArchiveToggle = async (proj: Project) => {
    try {
      await apiFetch(`/projects/${proj.id}/archive`, { method: 'POST' });
      await refreshData();
      showToast(`${proj.is_archived ? 'Restored' : 'Archived'} project ${proj.project_code}`, 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleAssignTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newMemberUserId) return;
    try {
      await apiFetch(`/projects/${selectedProject.id}/members`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: newMemberUserId,
          project_role: newMemberRole,
          allocation_percent: newMemberAllocation,
        }),
      });
      await refreshData();
      setNewMemberUserId('');
      showToast('Assigned scientist to project team');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRemoveTeamMember = async (memberId: string) => {
    if (!selectedProject) return;
    try {
      await apiFetch(`/projects/${selectedProject.id}/members/${memberId}`, {
        method: 'DELETE',
      });
      await refreshData();
      showToast('Removed member from project team', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !msTitle || !msDueDate) return;
    try {
      await apiFetch(`/projects/${selectedProject.id}/milestones`, {
        method: 'POST',
        body: JSON.stringify({
          title: msTitle,
          due_date: msDueDate,
          description: msDesc,
          deliverable_summary: msDeliverable,
          status: 'Pending',
          progress_percent: 0,
          owner_id: selectedProject.principal_investigator_id,
        }),
      });
      await refreshData();
      setMsTitle('');
      setMsDesc('');
      setMsDeliverable('');
      showToast('Added project milestone');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSeedSampleMilestones = async () => {
    if (!selectedProject) return;
    try {
      const startYear = parseInt(selectedProject.start_date.split('-')[0], 10) || 2026;
      const standardMilestones = [
        {
          title: 'Inception Protocol & Stakeholder Reconnaissance',
          due_date: `${startYear}-03-31`,
          description: 'Comprehensive baseline synthesis, survey design approval, and community liaison.',
          deliverable_summary: 'Signed Inception Report & Stakeholder Engagement Register',
          status: 'Completed',
          progress_percent: 100,
        },
        {
          title: 'Q2 Oceanographic Sampling & Cruise Data Collection',
          due_date: `${startYear}-06-30`,
          description: 'Primary acoustic transect surveys, CTD water profiling, and specimen collection.',
          deliverable_summary: 'Raw Oceanographic & Bathymetric Cruise Dataset',
          status: 'In Progress',
          progress_percent: 65,
        },
        {
          title: 'Midterm Specimen Processing & Analytical Interim Monograph',
          due_date: `${startYear}-09-30`,
          description: 'Laboratory taxonomic verification, nutrient assay, and geostatistical modeling.',
          deliverable_summary: 'Interim Technical Progress Monograph submitted to Directorate',
          status: 'Pending',
          progress_percent: 25,
        },
        {
          title: 'Validated Spatial GIS Geodatabase & Peer-Reviewed Publication',
          due_date: `${startYear}-12-15`,
          description: 'Final thematic cartography, policy brief for Blue Economy ministry, and manuscript submission.',
          deliverable_summary: 'Peer-reviewed research paper submitted to Western Indian Ocean Journal',
          status: 'Pending',
          progress_percent: 0,
        },
      ];

      for (const ms of standardMilestones) {
        await apiFetch(`/projects/${selectedProject.id}/milestones`, {
          method: 'POST',
          body: JSON.stringify({
            ...ms,
            owner_id: selectedProject.principal_investigator_id,
          }),
        });
      }
      await refreshData();
      showToast(`Populated 4 standard KMFRI milestones for ${selectedProject.project_code}`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const columns = useMemo<ColumnDef<Project>[]>(
    () => {
      if (!db) return [];
      return [
      {
        accessorKey: 'project_code',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-semibold"
          >
            <span>Project Code</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => {
              setSelectedProjectId(row.original.id);
              setActiveTab('Overview');
            }}
            className="font-mono text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline"
          >
            {row.original.project_code}
          </button>
        ),
      },
      {
        accessorKey: 'title',
        header: 'Title & Directorate',
        cell: ({ row }) => {
          const dir = db.directorates.find((d) => d.id === row.original.directorate_id);
          const area = db.research_areas.find((a) => a.id === row.original.research_area_id);
          return (
            <div>
              <button
                type="button"
                onClick={() => {
                  setSelectedProjectId(row.original.id);
                  setActiveTab('Overview');
                }}
                className="font-semibold text-slate-900 dark:text-white hover:text-sky-600 text-left"
              >
                {row.original.title}
              </button>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {dir?.code || '—'} · {area?.name || '—'} · Priority: {row.original.priority}
              </div>
            </div>
          );
        },
      },
      {
        id: 'pi',
        header: 'Principal Investigator',
        cell: ({ row }) => {
          const pi = db.users.find((u) => u.id === row.original.principal_investigator_id);
          return pi ? (
            <span className="text-xs">
              {pi.title} {pi.full_name}
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
            {row.original.status}
          </span>
        ),
      },
      {
        accessorKey: 'progress_percent',
        header: 'Progress',
        cell: ({ row }) => (
          <div className="w-24">
            <div className="flex justify-between font-mono text-[11px] mb-1 tabular-nums">
              <span>{row.original.progress_percent}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-600"
                style={{ width: `${row.original.progress_percent}%` }}
              />
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'budget',
        header: () => <div className="text-right">Budget</div>,
        cell: ({ row }) => (
          <div className="text-right font-mono text-xs tabular-nums">
            {row.original.currency} {row.original.budget.toLocaleString()}
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const proj = row.original;
          return (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedProjectId(proj.id);
                  setActiveTab('Overview');
                }}
                className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Open (11 Tabs)
              </button>
              {canEditProject && (
                <button
                  type="button"
                  onClick={() => openEditModal(proj)}
                  className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                  title="Edit Project"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
              {canArchiveProject && (
                <button
                  type="button"
                  onClick={() => handleArchiveToggle(proj)}
                  className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                  title={proj.is_archived ? 'Restore Project' : 'Archive Project'}
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        },
      },
    ];
    },
    [db, canEditProject, canArchiveProject]
  );

  const table = useReactTable({
    data: filteredProjects,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (!db) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mx-auto" />
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Loading Project Management System...
          </div>
        </div>
      </div>
    );
  }

  const handleExportProjects = (format: 'csv' | 'excel' | 'pdf') => {
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
        Progress: `${p.progress_percent}%`,
        Budget: `${p.currency} ${p.budget.toLocaleString()}`,
        Start_Date: p.start_date,
        End_Date: p.end_date,
      };
    });
    if (format === 'csv') exportToCSV('kmfri_projects_registry', rows);
    if (format === 'excel') exportToExcel('kmfri_projects_registry', 'Projects', rows);
    if (format === 'pdf') {
      exportToInstitutionalReportHTML(
        'kmfri_projects_registry',
        'KMFRI Research Projects Portfolio Registry',
        `Exported by ${user?.full_name}`,
        rows
      );
    }
  };

  // ===========================================================================
  // PROJECT DETAIL WORKSPACE WITH ALL 11 TABS
  // ===========================================================================
  if (selectedProject) {
    const dir = db.directorates.find((d) => d.id === selectedProject.directorate_id);
    const area = db.research_areas.find((a) => a.id === selectedProject.research_area_id);
    const pi = db.users.find((u) => u.id === selectedProject.principal_investigator_id);
    const members = db.project_members.filter((m) => m.project_id === selectedProject.id);
    const milestones = db.project_milestones.filter((m) => m.project_id === selectedProject.id);
    const grants = db.funding.filter((g) => g.project_id === selectedProject.id);
    const projLocLinks = db.project_locations.filter((pl) => pl.project_id === selectedProject.id);
    const projLocations = db.locations.filter((l) =>
      projLocLinks.some((pl) => pl.location_id === l.id)
    );
    const projCollabLinks = db.project_collaborators.filter(
      (pc) => pc.project_id === selectedProject.id
    );
    const projCollaborators = db.collaborators.filter((c) =>
      projCollabLinks.some((pc) => pc.collaborator_id === c.id)
    );
    const projReports = db.reports.filter((r) => r.project_id === selectedProject.id);
    const projDocs = db.documents.filter((d) => d.project_id === selectedProject.id);
    const projActivities = db.research_activities.filter(
      (a) => a.project_id === selectedProject.id
    );
    const projAuditLogs = db.audit_logs.filter((al) => al.entity_id === selectedProject.id);

    const totalAllocated = grants.reduce((sum, g) => sum + g.allocated_amount, 0);
    const totalSpent = grants.reduce((sum, g) => sum + g.spent_amount, 0);
    const totalRemaining = totalAllocated - totalSpent;

    return (
      <div className="space-y-6">
        {/* Top Action & Approval Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <button
            type="button"
            onClick={() => setSelectedProjectId(null)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Projects Portfolio</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {canApproveProject && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 mr-1">Governance Action:</span>
                {selectedProject.status === ProjectStatus.PROPOSED && (
                  <button
                    type="button"
                    onClick={() => handleStatusDecision(selectedProject, ProjectStatus.APPROVED)}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Proposal</span>
                  </button>
                )}
                <select
                  value={selectedProject.status}
                  onChange={(e) =>
                    handleStatusDecision(selectedProject, e.target.value as ProjectStatus)
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                >
                  {Object.values(ProjectStatus).map((st) => (
                    <option key={st} value={st}>
                      Status: {st}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {canEditProject && (
              <button
                type="button"
                onClick={() => openEditModal(selectedProject)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Project</span>
              </button>
            )}
          </div>
        </div>

        {/* Project Header Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-sky-700 dark:text-sky-400">
                <span>{selectedProject.project_code}</span>
                <span>·</span>
                <span>{selectedProject.status}</span>
                <span>·</span>
                <span>Priority: {selectedProject.priority}</span>
                <span>·</span>
                <span>{dir?.name || '—'}</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {selectedProject.title}
              </h1>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl">
                {selectedProject.description}
              </p>
            </div>

            <div className="flex items-center gap-6 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-[11px] text-slate-500">Budget</div>
                <div className="text-lg font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  {selectedProject.currency} {selectedProject.budget.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Completion</div>
                <div className="text-lg font-mono font-bold text-teal-600 tabular-nums">
                  {selectedProject.progress_percent}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Duration</div>
                <div className="text-xs font-mono text-slate-800 dark:text-slate-200 mt-1">
                  {selectedProject.start_date} → {selectedProject.end_date}
                </div>
              </div>
            </div>
          </div>

          {/* 11 Project Detail Tabs */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1 overflow-x-auto">
            {PROJECT_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-[#0A2540] dark:bg-sky-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'Overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                  Scientific Objectives
                </h3>
                {selectedProject.objectives.length === 0 ? (
                  <p className="text-xs text-slate-500">No objectives listed.</p>
                ) : (
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {selectedProject.objectives.map((obj, idx) => (
                      <li key={idx}>{obj}</li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                  Expected Deliverables
                </h3>
                {selectedProject.deliverables.length === 0 ? (
                  <p className="text-xs text-slate-500">No deliverables specified.</p>
                ) : (
                  <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {selectedProject.deliverables.map((del, idx) => (
                      <li key={idx}>{del}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                  Risks, Bottlenecks &amp; Mitigation Notes
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {selectedProject.risks_issues || 'No active project risks or issues logged.'}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 text-xs">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Institutional Metadata
              </h3>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Principal Investigator</span>
                {pi ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedScientistId(pi.id);
                      setActiveModule('scientists');
                    }}
                    className="font-semibold text-sky-700 dark:text-sky-400 hover:underline"
                  >
                    {pi.title} {pi.full_name}
                  </button>
                ) : (
                  <span>—</span>
                )}
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Directorate</span>
                <span className="font-medium">{dir?.name || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Research Area</span>
                <span className="font-medium">{area?.name || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Team Size</span>
                <span className="font-mono">{members.length} Researchers</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Milestones</span>
                <span className="font-mono">{milestones.length}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">UUID</span>
                <span className="font-mono text-[11px] text-slate-400">{selectedProject.id}</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TEAM */}
        {activeTab === 'Team' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Assigned Research Team ({members.length})
              </h3>
              <div className="space-y-2.5">
                {members.map((m) => {
                  const sci = db.users.find((u) => u.id === m.user_id);
                  return (
                    <div
                      key={m.id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            if (sci) {
                              setSelectedScientistId(sci.id);
                              setActiveModule('scientists');
                            }
                          }}
                          className="font-semibold text-slate-900 dark:text-white hover:text-sky-600"
                        >
                          {sci ? `${sci.title} ${sci.full_name}` : m.user_id}
                        </button>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {m.project_role} · Allocation: {m.allocation_percent}% · Staff:{' '}
                          {sci?.staff_number || '—'}
                        </div>
                      </div>
                      {canEditProject && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTeamMember(m.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded"
                          title="Remove from project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {canEditProject && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-sky-600" />
                  <span>Assign Co-Investigator / Team Member</span>
                </h3>
                <form onSubmit={handleAssignTeamMember} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-medium mb-1">Select Scientist</label>
                    <select
                      required
                      value={newMemberUserId}
                      onChange={(e) => setNewMemberUserId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    >
                      <option value="">Choose Scientist...</option>
                      {selectableInvestigators.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} {s.full_name} ({s.staff_number})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Project Role</label>
                    <select
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    >
                      <option value="Co-Investigator">Co-Investigator</option>
                      <option value="Research Associate">Research Associate</option>
                      <option value="Field Technologist">Field Technologist</option>
                      <option value="Data Analyst">Data Analyst</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Workload Allocation (%)</label>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={newMemberAllocation}
                      onChange={(e) => setNewMemberAllocation(Number(e.target.value))}
                      className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                  >
                    Assign to Team
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TIMELINE (RECHARTS GANTT VISUALIZATION) */}
        {activeTab === 'Timeline' && (
          <ProjectMilestonesGantt
            project={selectedProject}
            milestones={milestones}
            activities={projActivities}
            canEdit={canEditProject}
            onMarkMilestoneComplete={async (mId: string, mTitle: string) => {
              try {
                await apiFetch(`/milestones/${mId}`, {
                  method: 'PUT',
                  body: JSON.stringify({ status: 'Completed', progress_percent: 100 }),
                });
                await refreshData();
                showToast(`Completed milestone "${mTitle}"`);
              } catch (err: any) {
                showToast(err.message, 'error');
              }
            }}
            onOpenAddMilestone={() => setActiveTab('Milestones')}
            onSeedSampleMilestones={handleSeedSampleMilestones}
          />
        )}

        {/* TAB 4: BUDGET */}
        {activeTab === 'Budget' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Project Budget vs Grant Allocation &amp; Expenditure
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500">Approved Project Budget</div>
                <div className="text-lg font-mono font-bold mt-1 tabular-nums">
                  {selectedProject.currency} {selectedProject.budget.toLocaleString()}
                </div>
              </div>
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500">Total Grant Allocated</div>
                <div className="text-lg font-mono font-bold text-sky-600 mt-1 tabular-nums">
                  {selectedProject.currency} {totalAllocated.toLocaleString()}
                </div>
              </div>
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500">Total Disbursed / Spent</div>
                <div className="text-lg font-mono font-bold text-amber-600 mt-1 tabular-nums">
                  {selectedProject.currency} {totalSpent.toLocaleString()}
                </div>
              </div>
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500">Remaining Balance</div>
                <div className="text-lg font-mono font-bold text-teal-600 mt-1 tabular-nums">
                  {selectedProject.currency} {totalRemaining.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: FUNDING */}
        {activeTab === 'Funding' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Linked Funding Grants ({grants.length})
              </h3>
              <button
                type="button"
                onClick={() => setActiveModule('funding')}
                className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
              >
                Add Grant in Funding Module →
              </button>
            </div>
            {grants.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No funding grants linked to this project yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {grants.map((g) => {
                  const funder = db.funders.find((f) => f.id === g.funder_id);
                  return (
                    <div
                      key={g.id}
                      className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-mono font-semibold text-sky-700 dark:text-sky-400">
                          {g.grant_number} · {funder?.name || 'Funder'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Awarded: {g.award_date} · Status: {g.status}
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="font-semibold">
                          Allocated: {g.currency} {g.allocated_amount.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Remaining: {g.currency} {g.remaining_amount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: LOCATIONS */}
        {activeTab === 'Locations' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Project GIS Sampling Stations ({projLocations.length})
              </h3>
              <button
                type="button"
                onClick={() => setActiveModule('locations')}
                className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
              >
                Register Station in Locations Module →
              </button>
            </div>
            <GisMapCanvas locations={projLocations} heightClass="h-72" />
          </div>
        )}

        {/* TAB 7: COLLABORATORS */}
        {activeTab === 'Collaborators' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Partner Organizations &amp; MOUs ({projCollaborators.length})
              </h3>
              <button
                type="button"
                onClick={() => setActiveModule('collaborators')}
                className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
              >
                Manage Collaborators →
              </button>
            </div>
            {projCollaborators.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No external collaborators linked to this project yet.
              </p>
            ) : (
              <div className="space-y-2">
                {projCollaborators.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs flex justify-between"
                  >
                    <div>
                      <div className="font-semibold">{c.organization_name}</div>
                      <div className="text-[11px] text-slate-500">
                        {c.contact_person} · {c.email} · {c.country}
                      </div>
                    </div>
                    <span className="font-mono text-[11px]">{c.collaboration_type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 8: MILESTONES */}
        {activeTab === 'Milestones' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Project Milestones ({milestones.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('Timeline')}
                  className="px-2.5 py-1 rounded-lg border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>View Gantt Timeline</span>
                </button>
              </div>
              {milestones.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  No milestones defined yet. Add a milestone on the right.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {milestones.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {m.title}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          Due: {m.due_date} · Status: {m.status} · Progress: {m.progress_percent}%
                        </div>
                        {m.deliverable_summary && (
                          <div className="text-[11px] text-slate-500 mt-1">
                            Deliverable: {m.deliverable_summary}
                          </div>
                        )}
                      </div>
                      {canEditProject && m.status !== 'Completed' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/milestones/${m.id}`, {
                              method: 'PUT',
                              body: JSON.stringify({ status: 'Completed', progress_percent: 100 }),
                            });
                            await refreshData();
                            showToast(`Completed milestone "${m.title}"`);
                          }}
                          className="px-2.5 py-1 rounded bg-teal-600 text-white text-[11px] font-semibold"
                        >
                          Mark Complete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canEditProject && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  Add Project Milestone
                </h3>
                <form onSubmit={handleCreateMilestone} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-medium mb-1">Milestone Title *</label>
                    <input
                      type="text"
                      required
                      value={msTitle}
                      onChange={(e) => setMsTitle(e.target.value)}
                      placeholder="Q2 Bathymetric Acoustic Survey"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Due Date *</label>
                    <input
                      type="date"
                      required
                      value={msDueDate}
                      onChange={(e) => setMsDueDate(e.target.value)}
                      className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Expected Deliverable</label>
                    <input
                      type="text"
                      value={msDeliverable}
                      onChange={(e) => setMsDeliverable(e.target.value)}
                      placeholder="Validated GIS Shapefile & Cruise Report"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={msDesc}
                      onChange={(e) => setMsDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 px-4 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white font-semibold"
                  >
                    Create Milestone
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB 9: REPORTS */}
        {activeTab === 'Reports' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Project Technical &amp; Progress Reports ({projReports.length})
              </h3>
              <button
                type="button"
                onClick={() => setActiveModule('reports')}
                className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
              >
                Open Reports Workflow →
              </button>
            </div>
            {projReports.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No reports submitted for this project yet.
              </p>
            ) : (
              <div className="space-y-2">
                {projReports.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs flex justify-between"
                  >
                    <div>
                      <div className="font-semibold">{r.title}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {r.report_type} · {r.reporting_period} · v{r.version}
                      </div>
                    </div>
                    <span className="font-mono">{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 10: DOCUMENTS */}
        {activeTab === 'Documents' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Project Documents &amp; Attachments ({projDocs.length})
              </h3>
              <button
                type="button"
                onClick={() => setActiveModule('documents')}
                className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
              >
                Upload in Documents Module →
              </button>
            </div>
            {projDocs.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No attachments uploaded for this project yet.
              </p>
            ) : (
              <div className="space-y-2">
                {projDocs.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs flex justify-between"
                  >
                    <div>
                      <div className="font-semibold">{d.title}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {d.file_name} · v{d.version}
                      </div>
                    </div>
                    <span className="font-mono text-[11px]">{d.category}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 11: ACTIVITY */}
        {activeTab === 'Activity' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Project Audit &amp; Operational Activity Stream
            </h3>
            <div className="space-y-2">
              {projAuditLogs.map((al) => (
                <div
                  key={al.id}
                  className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs flex justify-between"
                >
                  <div>
                    <span className="font-mono font-semibold text-sky-700 dark:text-sky-400 mr-2">
                      [{al.action}]
                    </span>
                    <span>{al.summary}</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {new Date(al.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===========================================================================
  // PROJECTS PORTFOLIO LIST VIEW
  // ===========================================================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            KMFRI Research Projects Portfolio
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create, assign, approve, track milestones, and manage multi-directorate marine &amp; freshwater research projects
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setPortfolioViewMode('table')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                portfolioViewMode === 'table'
                  ? 'bg-white dark:bg-slate-800 shadow-xs text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setPortfolioViewMode('gantt')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                portfolioViewMode === 'gantt'
                  ? 'bg-white dark:bg-slate-800 shadow-xs text-sky-700 dark:text-sky-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-sky-600" />
              <span>Gantt Timeline</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleExportProjects('csv')}
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportProjects('excel')}
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportProjects('pdf')}
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF Report</span>
          </button>

          {canCreateProject && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-3.5 py-2 rounded-lg bg-[#0A2540] hover:bg-sky-900 dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project code or title..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          />
        </div>

        <select
          value={dirFilter}
          onChange={(e) => setDirFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          <option value="all">All Directorates</option>
          {db.directorates.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} — {d.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          <option value="all">All Statuses</option>
          {Object.values(ProjectStatus).map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setShowArchived((prev) => !prev)}
          className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 ${
            showArchived
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-800 dark:text-amber-300'
              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>{showArchived ? 'Viewing Archived Projects' : 'View Active Projects'}</span>
        </button>
      </div>

      {/* Portfolio View: Gantt Timeline or Table Registry */}
      {portfolioViewMode === 'gantt' ? (
        <PortfolioGanttChart
          projects={filteredProjects}
          directorates={db.directorates}
          milestones={db.project_milestones}
          onSelectProject={(projId) => {
            setSelectedProjectId(projId);
            setActiveTab('Timeline');
          }}
        />
      ) : (
        /* Table or Empty State */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {filteredProjects.length === 0 ? (
            <div className="py-14 px-6 text-center">
              <FolderKanban className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                No Research Projects Registered Yet
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Create your first KMFRI research project proposal to link scientists, budgets, grants, milestones, and GIS sampling stations.
              </p>
              {canCreateProject && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-4 px-4 py-2 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Project</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr
                      key={hg.id}
                      className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400"
                    >
                      {hg.headers.map((header) => (
                        <th key={header.id} className="py-3 px-4 font-semibold">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="py-3 px-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Project Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {editingProject
                  ? `Edit Project — ${editingProject.project_code}`
                  : 'Create KMFRI Research Project'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmitProject)} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Project Code (Unique) *</label>
                  <input
                    type="text"
                    {...register('project_code')}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                  {errors.project_code && (
                    <p className="text-rose-600 mt-1">{errors.project_code.message}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium mb-1">Project Title *</label>
                  <input
                    type="text"
                    {...register('title')}
                    placeholder="Western Indian Ocean Coral Reef Thermal Resilience & Blue Carbon Assessment"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                  {errors.title && <p className="text-rose-600 mt-1">{errors.title.message}</p>}
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Project Description *</label>
                <textarea
                  rows={2}
                  {...register('description')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                {errors.description && (
                  <p className="text-rose-600 mt-1">{errors.description.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Directorate *</label>
                  <select
                    {...register('directorate_id')}
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
                  <label className="block font-medium mb-1">Research Area *</label>
                  <select
                    {...register('research_area_id')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    {db.research_areas
                      .filter((a) => !watchedDirId || a.directorate_id === watchedDirId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Principal Investigator *</label>
                  <select
                    {...register('principal_investigator_id')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    {selectableInvestigators.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} {s.full_name} ({s.staff_number})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium mb-1">Start Date *</label>
                  <input
                    type="date"
                    {...register('start_date')}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">End Date *</label>
                  <input
                    type="date"
                    {...register('end_date')}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Status *</label>
                  <select
                    {...register('status')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    {Object.values(ProjectStatus).map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Priority *</label>
                  <select
                    {...register('priority')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    {Object.values(ProjectPriority).map((pr) => (
                      <option key={pr} value={pr}>
                        {pr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Currency *</label>
                  <select
                    {...register('currency')}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="KES">KES</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Total Budget *</label>
                  <input
                    type="number"
                    {...register('budget')}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Progress (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    {...register('progress_percent')}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Objectives (one per line) *</label>
                  <textarea
                    rows={3}
                    {...register('objectives_text')}
                    placeholder="Quantify benthic coral recruitment across 12 reef stations&#10;Evaluate blue carbon sequestration rates in Gazi Bay"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                  {errors.objectives_text && (
                    <p className="text-rose-600 mt-1">{errors.objectives_text.message}</p>
                  )}
                </div>
                <div>
                  <label className="block font-medium mb-1">Deliverables (one per line)</label>
                  <textarea
                    rows={3}
                    {...register('deliverables_text')}
                    placeholder="Bathymetric GIS Atlas&#10;Peer-reviewed manuscript & policy brief"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Risks &amp; Issues</label>
                <input
                  type="text"
                  {...register('risks_issues')}
                  placeholder="Offshore monsoon weather windows during SE Monsoon (May-August)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
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
                  {isSubmitting
                    ? 'Saving...'
                    : editingProject
                    ? 'Save Project Changes'
                    : 'Create Research Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
