import React, { useState } from 'react';
import {
  BootstrapData,
  ProjectRecord,
} from '../types.ts';
import {
  canApproveProject,
  canEditProject,
  calculateRemainingFunding,
  calculateUtilizationPercent,
  isReportOverdue,
} from '../lib/domain.ts';
import { InteractiveMap } from './InteractiveMap.tsx';
import {
  X,
  CheckCircle2,
  PauseCircle,
  Archive,
  Plus,
  Edit3,
  Trash2,
  Calendar,
  Users,
  DollarSign,
  MapPin,
  Building2,
  Flag,
  FileText,
  FolderOpen,
  Activity,
  ExternalLink,
} from 'lucide-react';

interface ProjectDetailModalProps {
  project: ProjectRecord;
  data: BootstrapData;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  apiFetch: <T = any>(path: string, options?: RequestInit) => Promise<T>;
  onEditProject: (project: ProjectRecord) => void;
  onSelectScientist?: (userId: string) => void;
}

const PROJECT_TABS = [
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
] as const;

type ProjectTab = (typeof PROJECT_TABS)[number];

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  data,
  onClose,
  onRefresh,
  apiFetch,
  onEditProject,
  onSelectScientist,
}) => {
  const [activeTab, setActiveTab] = useState<ProjectTab>('Overview');
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Forms inside tabs
  const [msForm, setMsForm] = useState({
    title: '',
    description: '',
    dueDate: new Date().toISOString().slice(0, 10),
    status: 'Pending',
    progressPercent: 0,
  });

  const [actForm, setActForm] = useState({
    title: '',
    description: '',
    activityDate: new Date().toISOString().slice(0, 10),
    locationId: '',
    hours: '8',
    status: 'Completed',
  });

  const [docForm, setDocForm] = useState({
    name: '',
    type: 'Proposal',
    fileUrl: '',
    fileSize: '240 KB',
    version: '1.0',
  });

  const [selectedMemberId, setSelectedMemberId] = useState('');

  const currentUser = data.currentUser;
  const directorate = data.directorates.find((d) => d.id === project.directorateId);
  const researchArea = data.researchAreas.find((r) => r.id === project.researchAreaId);
  const piUser = data.users.find((u) => u.id === project.principalInvestigatorId);

  const members = data.projectMembers
    .filter((pm) => pm.projectId === project.id)
    .map((pm) => ({
      ...pm,
      user: data.users.find((u) => u.id === pm.userId),
    }));

  const milestones = data.projectMilestones.filter((m) => m.projectId === project.id);
  const projectFunding = data.funding
    .filter((f) => f.projectId === project.id)
    .map((f) => ({
      ...f,
      funder: data.funders.find((fd) => fd.id === f.funderId),
    }));

  const projLocLinks = data.projectLocations.filter((pl) => pl.projectId === project.id);
  const projLocations = data.locations.filter((l) =>
    projLocLinks.some((pl) => pl.locationId === l.id)
  );

  const projCollabLinks = data.projectCollaborators.filter(
    (pc) => pc.projectId === project.id
  );
  const projCollaborators = projCollabLinks.map((pc) => ({
    ...pc,
    collaborator: data.collaborators.find((c) => c.id === pc.collaboratorId),
  }));

  const projReports = data.reports.filter((r) => r.projectId === project.id);
  const projDocuments = data.documents.filter((d) => d.projectId === project.id);
  const projActivities = data.researchActivities.filter(
    (a) => a.projectId === project.id
  );

  const canEdit = canEditProject(
    currentUser.id,
    currentUser.roleName,
    project.principalInvestigatorId,
    members.map((m) => m.userId)
  );

  const canApprove = canApproveProject(
    currentUser.roleName,
    currentUser.permissions,
    currentUser.directorateCode,
    directorate?.code
  );

  const handleStatusChange = async (newStatus: string) => {
    setBusy(true);
    setStatusMsg(null);
    try {
      await apiFetch(`/api/projects/${project.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      await onRefresh();
      setStatusMsg(`Project status updated to ${newStatus}.`);
    } catch (err: any) {
      setStatusMsg(err.message || 'Status update failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;
    setBusy(true);
    try {
      const nextMemberIds = Array.from(
        new Set([...members.map((m) => m.userId), selectedMemberId])
      );
      await apiFetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        body: JSON.stringify({ memberIds: nextMemberIds }),
      });
      setSelectedMemberId('');
      await onRefresh();
    } catch (err: any) {
      setStatusMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msForm.title.trim()) return;
    setBusy(true);
    try {
      await apiFetch('/api/milestones', {
        method: 'POST',
        body: JSON.stringify({
          projectId: project.id,
          ...msForm,
        }),
      });
      setMsForm({
        title: '',
        description: '',
        dueDate: new Date().toISOString().slice(0, 10),
        status: 'Pending',
        progressPercent: 0,
      });
      await onRefresh();
    } catch (err: any) {
      setStatusMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleMilestone = async (msId: string, currentStatus: string) => {
    setBusy(true);
    try {
      const nextStatus = currentStatus === 'Completed' ? 'In Progress' : 'Completed';
      await apiFetch(`/api/milestones/${msId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: nextStatus,
          progressPercent: nextStatus === 'Completed' ? 100 : 50,
          completionDate:
            nextStatus === 'Completed' ? new Date().toISOString().slice(0, 10) : null,
        }),
      });
      await onRefresh();
    } catch (err: any) {
      setStatusMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actForm.title.trim()) return;
    setBusy(true);
    try {
      await apiFetch('/api/activities', {
        method: 'POST',
        body: JSON.stringify({
          projectId: project.id,
          scientistId: currentUser.id,
          ...actForm,
        }),
      });
      setActForm({
        title: '',
        description: '',
        activityDate: new Date().toISOString().slice(0, 10),
        locationId: '',
        hours: '8',
        status: 'Completed',
      });
      await onRefresh();
    } catch (err: any) {
      setStatusMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.name.trim() || !docForm.fileUrl.trim()) return;
    setBusy(true);
    try {
      await apiFetch('/api/documents', {
        method: 'POST',
        body: JSON.stringify({
          projectId: project.id,
          ...docForm,
        }),
      });
      setDocForm({
        name: '',
        type: 'Proposal',
        fileUrl: '',
        fileSize: '240 KB',
        version: '1.0',
      });
      await onRefresh();
    } catch (err: any) {
      setStatusMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const totalAllocated = projectFunding.reduce(
    (acc, f) => acc + Number(f.allocatedAmount || 0),
    0
  );
  const totalSpent = projectFunding.reduce(
    (acc, f) => acc + Number(f.spentAmount || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-6xl max-h-[90vh] flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        {/* Top Project Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono font-semibold text-sky-700 dark:text-sky-400">
                {project.projectCode}
              </span>
              <span>·</span>
              <span>{directorate?.name || 'General Directorate'}</span>
              <span>·</span>
              <span>{researchArea?.name || 'Marine Research'}</span>
              <span>·</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Status: {project.status}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {project.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canApprove && project.status === 'Proposed' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleStatusChange('Approved')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve Project</span>
              </button>
            )}
            {canApprove && project.status === 'Approved' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleStatusChange('In Progress')}
                className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium"
              >
                Mark In Progress
              </button>
            )}
            {canApprove && project.status === 'In Progress' && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleStatusChange('Completed')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                >
                  Mark Completed
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleStatusChange('Suspended')}
                  className="px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-700 dark:text-amber-400 text-xs font-medium flex items-center gap-1"
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Suspend</span>
                </button>
              </>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => onEditProject(project)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Project</span>
              </button>
            )}
            {canApprove && project.status !== 'Archived' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleStatusChange('Archived')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 text-xs flex items-center gap-1"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archive</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="px-6 py-2 bg-sky-50 dark:bg-sky-950/60 border-b border-sky-200 dark:border-sky-800 text-xs text-sky-800 dark:text-sky-200">
            {statusMsg}
          </div>
        )}

        {/* 11-Tab Navigation Bar */}
        <div className="flex items-center gap-1 px-6 py-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto bg-slate-50 dark:bg-slate-950">
          {PROJECT_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'bg-sky-700 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Viewport */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'Overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    Scientific Description & Scope
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {project.description || 'No detailed description provided yet.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white mb-1.5">
                      Research Objectives
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {project.objectives || 'Objectives not yet specified.'}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white mb-1.5">
                      Expected Deliverables
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {project.deliverables || 'Deliverables not yet specified.'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white mb-1.5">
                    Operational Risks & Field Challenges
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {project.risksIssues || 'No critical risks or issues logged.'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    Project Telemetry & Governance
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Principal Investigator:</span>
                      {piUser ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectScientist) {
                              onClose();
                              onSelectScientist(piUser.id);
                            }
                          }}
                          className="font-medium text-sky-700 dark:text-sky-400 hover:underline"
                        >
                          {piUser.fullName}
                        </button>
                      ) : (
                        <span className="text-slate-700 dark:text-slate-300">Unassigned</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Priority Level:</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {project.priority}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Start Date:</span>
                      <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                        {project.startDate}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">End Date:</span>
                      <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                        {project.endDate}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Approved Budget:</span>
                      <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                        {project.currency} {Number(project.budget).toLocaleString()}
                      </span>
                    </div>
                    <div className="pt-2">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-500">Overall Completion:</span>
                        <span className="font-mono font-semibold tabular-nums text-teal-700 dark:text-teal-400">
                          {project.progressPercent}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-600 transition-all"
                          style={{ width: `${project.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Team' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Principal Investigator & Co-Investigators ({members.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Scientists and technologists assigned to execute this research project.
                  </p>
                </div>
                {canEdit && (
                  <form onSubmit={handleAddMember} className="flex items-center gap-2">
                    <select
                      value={selectedMemberId}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="">+ Assign Scientist to Team...</option>
                      {data.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.staffNumber || u.email})
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={busy || !selectedMemberId}
                      className="px-3 py-1.5 rounded-lg bg-sky-700 text-white text-xs font-medium disabled:opacity-50"
                    >
                      Assign
                    </button>
                  </form>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {piUser && (
                  <div className="p-4 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/40 dark:bg-sky-950/30 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-sky-700 dark:text-sky-400">
                        Principal Investigator (Lead)
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                        {piUser.fullName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {piUser.position || 'Research Scientist'} · {piUser.email}
                      </div>
                    </div>
                  </div>
                )}
                {members
                  .filter((m) => m.userId !== project.principalInvestigatorId)
                  .map((m) => (
                    <div
                      key={m.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-medium text-teal-700 dark:text-teal-400">
                          {m.role}
                        </div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                          {m.user?.fullName || 'Scientist'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {m.user?.staffNumber} · {m.user?.email}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {activeTab === 'Timeline' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span>Project Start: {project.startDate}</span>
                  <span>Current Progress: {project.progressPercent}%</span>
                  <span>Project End: {project.endDate}</span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-600"
                    style={{ width: `${project.progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Chronological Milestones & Deliverables Schedule
                </h4>
                {milestones.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No milestones scheduled yet. Use the Milestones tab to add project checkpoints.
                  </p>
                ) : (
                  milestones.map((ms) => (
                    <div
                      key={ms.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="text-xs font-mono text-slate-500">
                          Due: {ms.dueDate}{' '}
                          {ms.completionDate ? `· Completed: ${ms.completionDate}` : ''}
                        </div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {ms.title}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-semibold text-teal-700 dark:text-teal-400">
                          {ms.status} ({ms.progressPercent}%)
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {(activeTab === 'Budget' || activeTab === 'Funding') && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500">Total Project Budget</div>
                  <div className="text-lg font-mono font-bold tabular-nums text-slate-900 dark:text-white mt-1">
                    {project.currency} {Number(project.budget).toLocaleString()}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500">Allocated Grants Total</div>
                  <div className="text-lg font-mono font-bold tabular-nums text-sky-700 dark:text-sky-400 mt-1">
                    {totalAllocated.toLocaleString()}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500">Total Expenditure</div>
                  <div className="text-lg font-mono font-bold tabular-nums text-teal-700 dark:text-teal-400 mt-1">
                    {totalSpent.toLocaleString()}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500">Remaining Grant Balance</div>
                  <div className="text-lg font-mono font-bold tabular-nums text-slate-900 dark:text-white mt-1">
                    {calculateRemainingFunding(totalAllocated, totalSpent).toLocaleString()} (
                    {calculateUtilizationPercent(totalAllocated, totalSpent)}% used)
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-500">
                      <th className="py-2.5 px-4">Grant Number</th>
                      <th className="py-2.5 px-4">Funder Source</th>
                      <th className="py-2.5 px-4 text-right">Award Amount</th>
                      <th className="py-2.5 px-4 text-right">Allocated</th>
                      <th className="py-2.5 px-4 text-right">Spent</th>
                      <th className="py-2.5 px-4">Period</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {projectFunding.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-500">
                          No grant allocations linked to this project yet. Add grants in the Funding module.
                        </td>
                      </tr>
                    ) : (
                      projectFunding.map((f) => (
                        <tr key={f.id}>
                          <td className="py-2.5 px-4 font-mono font-medium text-sky-700 dark:text-sky-400">
                            {f.grantNumber}
                          </td>
                          <td className="py-2.5 px-4 text-slate-900 dark:text-white">
                            {f.funder?.name || 'Funding Partner'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                            {f.currency} {Number(f.amount).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                            {f.currency} {Number(f.allocatedAmount).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                            {f.currency} {Number(f.spentAmount).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-500">
                            {f.startDate} → {f.endDate}
                          </td>
                          <td className="py-2.5 px-4 font-medium">{f.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'Locations' && (
            <div className="space-y-4">
              <InteractiveMap
                locations={projLocations.length > 0 ? projLocations : data.locations}
                projectLocations={data.projectLocations}
                projects={data.projects}
                selectedProjectId={projLocations.length > 0 ? project.id : undefined}
                heightClass="h-[340px]"
              />
            </div>
          )}

          {activeTab === 'Collaborators' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Partner Organizations & MOUs ({projCollaborators.length})
              </h3>
              {projCollaborators.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No external collaborators linked to this project yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {projCollaborators.map(({ collaborator, role }) =>
                    collaborator ? (
                      <div
                        key={collaborator.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800"
                      >
                        <div className="text-xs text-teal-700 dark:text-teal-400 font-medium">
                          {collaborator.organizationType} · {collaborator.country} · {role}
                        </div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                          {collaborator.organizationName}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Contact: {collaborator.contactPerson || 'N/A'} ({collaborator.email || 'No email'})
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'Milestones' && (
            <div className="space-y-5">
              {canEdit && (
                <form
                  onSubmit={handleAddMilestone}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
                >
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Milestone Title
                    </label>
                    <input
                      type="text"
                      required
                      value={msForm.title}
                      onChange={(e) => setMsForm({ ...msForm, title: e.target.value })}
                      placeholder="e.g., Acoustic Hydrographic Survey Cruise Q2"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      required
                      value={msForm.dueDate}
                      onChange={(e) => setMsForm({ ...msForm, dueDate: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Progress %
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={msForm.progressPercent}
                      onChange={(e) =>
                        setMsForm({ ...msForm, progressPercent: Number(e.target.value) })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium"
                  >
                    + Add Milestone
                  </button>
                </form>
              )}

              <div className="space-y-2.5">
                {milestones.map((ms) => (
                  <div
                    key={ms.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {ms.title}
                      </div>
                      <div className="text-xs text-slate-500">
                        Due: {ms.dueDate} · Status: {ms.status} ({ms.progressPercent}%)
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleToggleMilestone(ms.id, ms.status)}
                        className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {ms.status === 'Completed' ? 'Reopen' : 'Mark Completed'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'Reports' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Submitted & Scheduled Technical Reports ({projReports.length})
              </h3>
              {projReports.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No reports filed for this project yet. Submit reports via the Reports module.
                </p>
              ) : (
                <div className="space-y-2">
                  {projReports.map((r) => {
                    const overdue = isReportOverdue(r.dueDate, r.status);
                    return (
                      <div
                        key={r.id}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs text-slate-500">
                            {r.reportType} · Period: {r.reportingPeriod} · v{r.version}
                          </div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {r.title}
                          </div>
                          {r.reviewComments && (
                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              Reviewer Note: &ldquo;{r.reviewComments}&rdquo;
                            </div>
                          )}
                        </div>
                        <div className="text-right text-xs">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {r.status} {overdue ? '· OVERDUE' : ''}
                          </div>
                          <div className="font-mono text-slate-500">Due: {r.dueDate}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'Documents' && (
            <div className="space-y-5">
              {canEdit && (
                <form
                  onSubmit={handleAddDocument}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
                >
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Document Title
                    </label>
                    <input
                      type="text"
                      required
                      value={docForm.name}
                      onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                      placeholder="e.g., RV Mtafiti Cruise Plan & Protocol.pdf"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Document Type
                    </label>
                    <select
                      value={docForm.type}
                      onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="Proposal">Proposal</option>
                      <option value="Cruise Plan">Cruise Plan</option>
                      <option value="Ethics Approval">Ethics Approval</option>
                      <option value="Dataset Archive">Dataset Archive</option>
                      <option value="MOU">MOU Agreement</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Document URL / Reference
                    </label>
                    <input
                      type="text"
                      required
                      value={docForm.fileUrl}
                      onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })}
                      placeholder="https://repository.kmfri.go.ke/doc..."
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium"
                  >
                    + Attach Document
                  </button>
                </form>
              )}

              <div className="space-y-2">
                {projDocuments.length === 0 ? (
                  <p className="text-xs text-slate-500">No documents attached to this project yet.</p>
                ) : (
                  projDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {doc.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {doc.type} · Version {doc.version} · {doc.fileSize}
                        </div>
                      </div>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-sky-700 dark:text-sky-400 hover:underline flex items-center gap-1"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'Activity' && (
            <div className="space-y-5">
              {canEdit && (
                <form
                  onSubmit={handleAddActivity}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
                >
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Field / Lab Research Activity
                    </label>
                    <input
                      type="text"
                      required
                      value={actForm.title}
                      onChange={(e) => setActForm({ ...actForm, title: e.target.value })}
                      placeholder="e.g., Water quality & chlorophyll-a sampling at Tudor Creek"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Activity Date
                    </label>
                    <input
                      type="date"
                      required
                      value={actForm.activityDate}
                      onChange={(e) => setActForm({ ...actForm, activityDate: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Hours Logged
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={actForm.hours}
                      onChange={(e) => setActForm({ ...actForm, hours: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium"
                  >
                    + Log Activity
                  </button>
                </form>
              )}

              <div className="space-y-2">
                {projActivities.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No research activities logged for this project yet.
                  </p>
                ) : (
                  projActivities.map((act) => {
                    const sci = data.users.find((u) => u.id === act.scientistId);
                    return (
                      <div
                        key={act.id}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {act.title}
                          </div>
                          <div className="text-xs text-slate-500">
                            Scientist: {sci?.fullName || 'Researcher'} · Date: {act.activityDate}
                          </div>
                        </div>
                        <div className="text-right font-mono text-xs">
                          <span className="font-semibold text-teal-700 dark:text-teal-400">
                            {act.hours} hrs
                          </span>
                          <span className="text-slate-400"> · </span>
                          <span>{act.status}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
