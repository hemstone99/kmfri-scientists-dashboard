import React, { useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  ArrowUpDown,
  BookOpen,
  Building2,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  Download,
  Edit3,
  Eye,
  FileEdit,
  FolderKanban,
  KeyRound,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Power,
  Search,
  Trophy,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  OutputType,
  PermissionCode,
  ProjectStatus,
  ReportStatus,
  RoleCode,
  UserProfile,
} from '../types/kmfri.ts';
import { GisMapCanvas } from './GisMapCanvas.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import { calculateScientistBscScore } from '../utils/bscEngine.ts';
import {
  exportToCSV,
  exportToExcel,
  exportToInstitutionalReportHTML,
} from '../utils/exportUtils.ts';

const scientistSchema = z.object({
  staff_number: z.string().min(3, 'Staff number is required (e.g. KMFRI/RES/104)'),
  full_name: z.string().min(3, 'Full name is required'),
  title: z.string().min(1, 'Title is required (Dr., Prof., Mr., Ms.)'),
  email: z.string().email('Valid institutional email is required'),
  password: z.string().optional(),
  phone: z.string().optional(),
  position: z.string().min(2, 'Position/Rank is required'),
  role_code: z.nativeEnum(RoleCode),
  directorate_id: z.string().optional(),
  research_area_id: z.string().optional(),
  office_station: z.string().min(2, 'Office station is required'),
  orcid_id: z.string().optional(),
  specialization: z.string().optional(),
  bio: z.string().optional(),
});

type ScientistFormValues = z.infer<typeof scientistSchema>;

const columnHelper = createColumnHelper<UserProfile>();

export const ScientistsModule: React.FC = () => {
  const {
    db,
    user,
    hasPermission,
    selectedScientistId,
    setSelectedScientistId,
    setSelectedProjectId,
    setActiveModule,
    setFloatingChatOpen,
    onlineUserIds,
    refreshData,
    apiFetch,
    showToast,
  } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [dirFilter, setDirFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sorting, setSorting] = useState<SortingState>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingScientist, setEditingScientist] = useState<UserProfile | null>(null);
  const [avatarDraft, setAvatarDraft] = useState<string>('');
  const [resetModalUser, setResetModalUser] = useState<UserProfile | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Self-service password change modal state
  const [selfPasswordModalOpen, setSelfPasswordModalOpen] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [selfNewPasswordInput, setSelfNewPasswordInput] = useState('');
  const [selfConfirmPasswordInput, setSelfConfirmPasswordInput] = useState('');

  // Activity creation modal for Scientist Dashboard
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [actProjectId, setActProjectId] = useState('');
  const [actTitle, setActTitle] = useState('');
  const [actType, setActType] = useState<any>('Field Sampling');
  const [actDate, setActDate] = useState(new Date().toISOString().slice(0, 10));
  const [actDesc, setActDesc] = useState('');

  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const modalPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const canManageUsers = hasPermission(PermissionCode.USERS_MANAGE);
  const canResetPassword = hasPermission(PermissionCode.USERS_RESET_PASSWORD);
  const canEditProjects = hasPermission(PermissionCode.PROJECTS_EDIT);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ScientistFormValues>({
    resolver: zodResolver(scientistSchema),
    defaultValues: {
      staff_number: '',
      full_name: '',
      title: 'Dr.',
      email: '',
      password: '',
      phone: '',
      position: 'Senior Research Scientist',
      role_code: RoleCode.SCIENTIST,
      directorate_id: '30000000-0000-4000-8000-000000000001',
      research_area_id: '40000000-0000-4000-8000-000000000001',
      office_station: 'Mombasa Headquarters (English Point)',
      orcid_id: '',
      specialization: '',
      bio: '',
    },
  });

  const selectedScientist = selectedScientistId && db
    ? db.users.find((u) => u.id === selectedScientistId) || null
    : null;

  const openCreateModal = () => {
    if (!db) return;
    setEditingScientist(null);
    setAvatarDraft('');
    reset({
      staff_number: `KMFRI/RES/${String(db.users.length + 101)}`,
      full_name: '',
      title: 'Dr.',
      email: '',
      password: '',
      phone: '+254 ',
      position: 'Research Scientist',
      role_code: RoleCode.SCIENTIST,
      directorate_id: db.directorates[0]?.id || '',
      research_area_id: db.research_areas[0]?.id || '',
      office_station: 'Mombasa Headquarters (English Point)',
      orcid_id: '',
      specialization: '',
      bio: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (scientist: UserProfile) => {
    setEditingScientist(scientist);
    setAvatarDraft(scientist.avatar_url || '');
    reset({
      staff_number: scientist.staff_number,
      full_name: scientist.full_name,
      title: scientist.title,
      email: scientist.email,
      password: '',
      phone: scientist.phone,
      position: scientist.position,
      role_code: scientist.role_code,
      directorate_id: scientist.directorate_id || '',
      research_area_id: scientist.research_area_id || '',
      office_station: scientist.office_station,
      orcid_id: scientist.orcid_id || '',
      specialization: scientist.specialization || '',
      bio: scientist.bio || '',
    });
    setModalOpen(true);
  };

  const handleDirectAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    targetUser: UserProfile
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file (PNG, JPG, WebP)', 'error');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      showToast('Profile image must be under 4 MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = String(reader.result || '');
        await apiFetch(`/users/${targetUser.id}/avatar`, {
          method: 'POST',
          body: JSON.stringify({ avatar_url: dataUrl }),
        });
        await refreshData();
        showToast('Profile picture updated! Your new photo is now live across KMFRI & Chat.');
      } catch (err: any) {
        showToast(err.message || 'Failed to update profile picture', 'error');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleModalAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarDraft(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const onSubmitScientist = async (values: ScientistFormValues) => {
    try {
      const payload = {
        ...values,
        avatar_url: avatarDraft || editingScientist?.avatar_url || '',
      };
      if (editingScientist) {
        await apiFetch(`/users/${editingScientist.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast(`Updated profile for ${values.title} ${values.full_name}`);
      } else {
        await apiFetch('/users', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast(`Created researcher account for ${values.title} ${values.full_name}`);
      }
      setModalOpen(false);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save scientist account', 'error');
    }
  };

  const handleToggleAccountStatus = async (scientist: UserProfile) => {
    try {
      await apiFetch(`/users/${scientist.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ is_active: !scientist.is_active }),
      });
      showToast(
        `${scientist.is_active ? 'Deactivated' : 'Reactivated'} account for ${scientist.full_name}`
      );
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Status change failed', 'error');
    }
  };

  const handleResetPassword = async (scientist: UserProfile) => {
    setResetModalUser(scientist);
    setNewPasswordInput('Kmfri@2025!');
  };

  const confirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser || newPasswordInput.trim().length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    try {
      await apiFetch(`/users/${resetModalUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: newPasswordInput.trim() }),
      });
      showToast(`Password reset completed for ${resetModalUser.full_name}`);
      setResetModalUser(null);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Password reset failed', 'error');
    }
  };

  const handleSelfPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selfNewPasswordInput.trim().length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }
    if (selfNewPasswordInput !== selfConfirmPasswordInput) {
      showToast('New password and confirmation do not match', 'error');
      return;
    }
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPasswordInput || undefined,
          new_password: selfNewPasswordInput.trim(),
        }),
      });
      showToast('Your password has been updated and logged to the security audit trail.');
      setSelfPasswordModalOpen(false);
      setCurrentPasswordInput('');
      setSelfNewPasswordInput('');
      setSelfConfirmPasswordInput('');
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update password', 'error');
    }
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScientist || !actProjectId || !actTitle) return;
    try {
      await apiFetch('/activities', {
        method: 'POST',
        body: JSON.stringify({
          project_id: actProjectId,
          scientist_id: selectedScientist.id,
          title: actTitle,
          activity_type: actType,
          activity_date: actDate,
          description: actDesc,
          status: 'Completed',
        }),
      });
      showToast('Logged research activity');
      setActivityModalOpen(false);
      setActTitle('');
      setActDesc('');
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to log activity', 'error');
    }
  };

  const filteredScientists = useMemo(() => {
    if (!db) return [];
    return db.users.filter((u) => {
      if (statusFilter === 'active' && !u.is_active) return false;
      if (statusFilter === 'inactive' && u.is_active) return false;
      if (dirFilter !== 'all' && u.directorate_id !== dirFilter) return false;
      if (areaFilter !== 'all' && u.research_area_id !== areaFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = u.full_name.toLowerCase().includes(q);
        const matchStaff = u.staff_number.toLowerCase().includes(q);
        const matchEmail = u.email.toLowerCase().includes(q);
        const matchPos = u.position.toLowerCase().includes(q);
        if (!matchName && !matchStaff && !matchEmail && !matchPos) return false;
      }
      return true;
    });
  }, [db, statusFilter, dirFilter, areaFilter, searchQuery]);

  const columns = useMemo(
    () => {
      if (!db) return [];
      return [
      columnHelper.accessor('staff_number', {
        header: 'Staff No.',
        cell: (info) => (
          <span className="font-mono text-xs font-semibold text-sky-700 dark:text-sky-400">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('full_name', {
        header: 'Scientist / Researcher',
        cell: (info) => {
          const sci = info.row.original;
          const isOnline = onlineUserIds.includes(sci.id);
          return (
            <div className="flex items-center gap-2.5">
              <UserAvatar user={sci} size="sm" showOnline={true} isOnline={isOnline} />
              <div>
                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>
                    {sci.title} {sci.full_name}
                  </span>
                  {isOnline && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Online
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">{sci.email}</div>
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor('position', {
        header: 'Position & Role',
        cell: (info) => {
          const sci = info.row.original;
          return (
            <div>
              <div className="text-xs text-slate-800 dark:text-slate-200">{sci.position}</div>
              <span className="inline-block mt-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {sci.role_code}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor('directorate_id', {
        header: 'Directorate / Research Area',
        cell: (info) => {
          const sci = info.row.original;
          const dir = db.directorates.find((d) => d.id === sci.directorate_id);
          const area = db.research_areas.find((a) => a.id === sci.research_area_id);
          return (
            <div>
              <div className="text-xs text-slate-800 dark:text-slate-200">
                {dir?.name || 'General Management'}
              </div>
              <div className="text-[11px] text-teal-600 dark:text-teal-400">
                {area?.name || 'All Areas'}
              </div>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'workload',
        header: 'Projects (PI / Team)',
        cell: (info) => {
          const sci = info.row.original;
          const piCount = db.projects.filter((p) => p.principal_investigator_id === sci.id).length;
          const memberCount = db.project_members.filter((m) => m.user_id === sci.id).length;
          return (
            <div className="font-mono text-xs tabular-nums">
              <span className="font-semibold text-slate-900 dark:text-white">{piCount} PI</span>
              <span className="text-slate-400 mx-1">·</span>
              <span className="text-slate-600 dark:text-slate-300">{memberCount} Team</span>
            </div>
          );
        },
      }),
      columnHelper.accessor('is_active', {
        header: 'Status',
        cell: (info) =>
          info.getValue() ? (
            <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              Active
            </span>
          ) : (
            <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
              Deactivated
            </span>
          ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => {
          const sci = info.row.original;
          return (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedScientistId(sci.id)}
                className="px-2 py-1 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100 text-[11px] font-medium flex items-center gap-1"
                title="View Scientist Dashboard"
              >
                <Eye className="w-3 h-3" />
                <span>Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModule('chat')}
                className="p-1 rounded border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50"
                title={`Chat with ${sci.full_name}`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
              {canManageUsers && (
                <>
                  <button
                    type="button"
                    onClick={() => openEditModal(sci)}
                    className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Edit Account"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAccountStatus(sci)}
                    className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title={sci.is_active ? 'Deactivate Account' : 'Reactivate Account'}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {canResetPassword && (
                <button
                  type="button"
                  onClick={() => handleResetPassword(sci)}
                  className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Reset Password"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        },
      }),
    ];
    },
    [
      db,
      canManageUsers,
      canResetPassword,
      onlineUserIds,
    ]
  );

  const table = useReactTable({
    data: filteredScientists,
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
            Loading Scientist Registry...
          </div>
        </div>
      </div>
    );
  }

  const handleExportScientists = (format: 'csv' | 'excel' | 'pdf') => {
    const rows = filteredScientists.map((s) => {
      const dir = db.directorates.find((d) => d.id === s.directorate_id);
      const area = db.research_areas.find((a) => a.id === s.research_area_id);
      return {
        Staff_Number: s.staff_number,
        Full_Name: `${s.title} ${s.full_name}`,
        Email: s.email,
        Position: s.position,
        Directorate: dir?.name || '—',
        Research_Area: area?.name || '—',
        Station: s.office_station,
        Phone: s.phone,
        Status: s.is_active ? 'Active' : 'Deactivated',
      };
    });
    if (format === 'csv') exportToCSV('kmfri_scientists_directory', rows);
    if (format === 'excel') exportToExcel('kmfri_scientists_directory', 'Scientists', rows);
    if (format === 'pdf') {
      exportToInstitutionalReportHTML(
        'kmfri_scientists_directory',
        'KMFRI Scientific Personnel Registry',
        'Official Directory of Active and Registered Research Scientists',
        rows
      );
    }
  };

  // ===========================================================================
  // DEDICATED SCIENTIST DASHBOARD VIEW
  // ===========================================================================
  if (selectedScientist) {
    const dir = db.directorates.find((d) => d.id === selectedScientist.directorate_id);
    const area = db.research_areas.find((a) => a.id === selectedScientist.research_area_id);
    const isOwnProfile = user?.id === selectedScientist.id;
    const isScientistOnline = onlineUserIds.includes(selectedScientist.id);

    const ledProjects = db.projects.filter(
      (p) => p.principal_investigator_id === selectedScientist.id
    );
    const assignedProjectIds = new Set([
      ...ledProjects.map((p) => p.id),
      ...db.project_members
        .filter((pm) => pm.user_id === selectedScientist.id)
        .map((pm) => pm.project_id),
    ]);
    const allScientistProjects = db.projects.filter((p) => assignedProjectIds.has(p.id));
    const activeScientistProjects = allScientistProjects.filter(
      (p) => p.status === ProjectStatus.APPROVED || p.status === ProjectStatus.IN_PROGRESS
    );
    const completedScientistProjects = allScientistProjects.filter(
      (p) => p.status === ProjectStatus.COMPLETED
    );

    const scientistMilestones = db.project_milestones.filter(
      (m) => m.owner_id === selectedScientist.id || assignedProjectIds.has(m.project_id)
    );
    const scientistFunding = db.funding.filter((g) => assignedProjectIds.has(g.project_id));
    const scientistLocationIds = new Set(
      db.project_locations
        .filter((pl) => assignedProjectIds.has(pl.project_id))
        .map((pl) => pl.location_id)
    );
    const scientistLocations = db.locations.filter((l) => scientistLocationIds.has(l.id));
    const scientistCollabIds = new Set(
      db.project_collaborators
        .filter((pc) => assignedProjectIds.has(pc.project_id))
        .map((pc) => pc.collaborator_id)
    );
    const scientistCollaborators = db.collaborators.filter((c) => scientistCollabIds.has(c.id));
    const scientistReports = db.reports.filter((r) => r.scientist_id === selectedScientist.id);
    const scientistOutputs = db.research_outputs.filter(
      (o) =>
        o.lead_scientist_id === selectedScientist.id ||
        db.output_authors.some((oa) => oa.output_id === o.id && oa.user_id === selectedScientist.id)
    );
    const scientistActivities = db.research_activities.filter(
      (a) => a.scientist_id === selectedScientist.id || assignedProjectIds.has(a.project_id)
    );
    const scientistNotifications = db.notifications.filter(
      (n) => !n.recipient_user_id || n.recipient_user_id === selectedScientist.id
    );

    return (
      <div className="space-y-6">
        {/* Back & Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <button
            type="button"
            onClick={() => setSelectedScientistId(null)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Scientists Directory</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveModule('chat')}
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Live Chat</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModule('outputs')}
              className="px-3 py-1.5 rounded-lg bg-[#0A2540] hover:bg-sky-900 dark:bg-sky-700 dark:hover:bg-sky-600 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>Write Publication</span>
            </button>

            {canEditProjects && (
              <button
                type="button"
                onClick={() => {
                  setActProjectId(allScientistProjects[0]?.id || db.projects[0]?.id || '');
                  setActivityModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Field/Lab Activity</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveModule('reports')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Submit Report
            </button>

            {isOwnProfile && (
              <button
                type="button"
                onClick={() => setSelfPasswordModalOpen(true)}
                className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Reset Password</span>
              </button>
            )}

            {(canManageUsers || isOwnProfile) && (
              <button
                type="button"
                onClick={() => openEditModal(selectedScientist)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>
        </div>

        {/* Scientist Identity & Profile Header with Interactive Avatar Upload */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
              {/* Profile Picture + Upload Button */}
              <div className="relative group self-start sm:self-center">
                <UserAvatar
                  user={selectedScientist}
                  size="xl"
                  showOnline={true}
                  isOnline={isScientistOnline}
                />
                {(isOwnProfile || canManageUsers) && (
                  <>
                    <input
                      ref={profilePhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleDirectAvatarUpload(e, selectedScientist)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => profilePhotoInputRef.current?.click()}
                      className="mt-2 sm:mt-0 sm:absolute sm:-bottom-1.5 sm:-right-1.5 px-2 py-1 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-semibold shadow-md flex items-center gap-1 border-2 border-white dark:border-slate-900"
                      title="Update Profile Picture (visible across KMFRI & Live Chat)"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Photo</span>
                    </button>
                  </>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
                  <span>Staff No: {selectedScientist.staff_number}</span>
                  <span>·</span>
                  <span>Role: {selectedScientist.role_code}</span>
                  <span>·</span>
                  <span
                    className={
                      selectedScientist.is_active ? 'text-emerald-600' : 'text-rose-600'
                    }
                  >
                    {selectedScientist.is_active ? '● Active Account' : '✖ Deactivated'}
                  </span>
                  {isScientistOnline && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                      Online in Chat
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {selectedScientist.title} {selectedScientist.full_name}
                </h1>
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                  {selectedScientist.position} · {dir?.name || 'Unassigned Directorate'} (
                  {area?.name || 'General Research'})
                </div>
                {selectedScientist.specialization && (
                  <p className="text-xs text-slate-500 mt-2 max-w-2xl">
                    Specialization: {selectedScientist.specialization}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Mail className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="font-mono truncate">{selectedScientist.email}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Phone className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="font-mono">{selectedScientist.phone || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="truncate">{selectedScientist.office_station}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <BookOpen className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="font-mono">ORCID: {selectedScientist.orcid_id || 'Not linked'}</span>
              </div>
            </div>
          </div>

          {/* Scientist KPI Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-500">Assigned / Led Projects</div>
              <div className="text-xl font-mono font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {allScientistProjects.length} ({ledProjects.length} PI)
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Active / Completed</div>
              <div className="text-xl font-mono font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {activeScientistProjects.length} / {completedScientistProjects.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Milestones</div>
              <div className="text-xl font-mono font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {scientistMilestones.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Linked Grants</div>
              <div className="text-xl font-mono font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {scientistFunding.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Reports (Pending)</div>
              <div className="text-xl font-mono font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {scientistReports.length} (
                {scientistReports.filter((r) => r.status !== ReportStatus.APPROVED).length})
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Publications &amp; Outputs</div>
              <div className="text-xl font-mono font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {scientistOutputs.length}
              </div>
            </div>
          </div>
        </div>

        {/* Scientist Performance Balanced Scorecard (BSC) Card */}
        {(() => {
          const bsc = calculateScientistBscScore(selectedScientist.id, db);
          if (!bsc) return null;
          return (
            <div className="bg-gradient-to-r from-amber-500/10 via-sky-500/10 to-teal-500/10 border border-amber-500/30 rounded-xl p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Performance Contracting Audit
                      </span>
                      <span className="text-xs text-slate-500">FY 2026/27</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Scientist Balanced Scorecard (BSC): {bsc.total_score} / 100
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-lg font-mono font-bold text-sm ${
                      bsc.grade === 'A+' || bsc.grade === 'A'
                        ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                        : 'bg-sky-500/20 text-sky-600 border border-sky-500/30'
                    }`}
                  >
                    Grade {bsc.grade} ({bsc.grade_label.split(' ')[0]})
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveModule('balanced_scorecard')}
                    className="px-3 py-1.5 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white text-xs font-semibold hover:bg-sky-900"
                  >
                    Open Institutional BSC Hub →
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-xs">
                <div className="bg-white/70 dark:bg-slate-900/70 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">1. Scientific Excellence (40%)</div>
                  <div className="text-base font-bold text-sky-700 dark:text-sky-300 font-mono mt-0.5">
                    {bsc.perspectives.scientific_excellence.score} / 40 pts
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 mt-2 overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full" style={{ width: `${bsc.perspectives.scientific_excellence.percent}%` }} />
                  </div>
                </div>

                <div className="bg-white/70 dark:bg-slate-900/70 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">2. Policy &amp; Blue Economy (25%)</div>
                  <div className="text-base font-bold text-teal-700 dark:text-teal-300 font-mono mt-0.5">
                    {bsc.perspectives.policy_stakeholder_impact.score} / 25 pts
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 mt-2 overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${bsc.perspectives.policy_stakeholder_impact.percent}%` }} />
                  </div>
                </div>

                <div className="bg-white/70 dark:bg-slate-900/70 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">3. Grant Stewardship (20%)</div>
                  <div className="text-base font-bold text-indigo-700 dark:text-indigo-300 font-mono mt-0.5">
                    {bsc.perspectives.grant_stewardship.score} / 20 pts
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 mt-2 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${bsc.perspectives.grant_stewardship.percent}%` }} />
                  </div>
                </div>

                <div className="bg-white/70 dark:bg-slate-900/70 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">4. Capacity &amp; Collab (15%)</div>
                  <div className="text-base font-bold text-amber-700 dark:text-amber-300 font-mono mt-0.5">
                    {bsc.perspectives.capacity_collaboration.score} / 15 pts
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 mt-2 overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${bsc.perspectives.capacity_collaboration.percent}%` }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Projects & Milestones Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assigned & Led Projects */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-sky-600" />
                <span>Assigned &amp; Led Research Projects</span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveModule('projects')}
                className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
              >
                All Projects →
              </button>
            </div>

            {allScientistProjects.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-500">
                No projects assigned to this scientist yet.
              </div>
            ) : (
              <div className="space-y-3">
                {allScientistProjects.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-sky-700 dark:text-sky-400">
                        {p.project_code} ·{' '}
                        {p.principal_investigator_id === selectedScientist.id
                          ? 'Principal Investigator'
                          : 'Co-Investigator'}{' '}
                        · {p.status}
                      </div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                        {p.title}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-1">
                        Progress: {p.progress_percent}% · {p.start_date} to {p.end_date}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProjectId(p.id);
                        setActiveModule('projects');
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                    >
                      Open
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Milestones & Deadlines */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-teal-600" />
                <span>Project Milestones &amp; Deadlines</span>
              </h3>
              <span className="text-xs font-mono text-slate-500">
                {scientistMilestones.length} Milestones
              </span>
            </div>

            {scientistMilestones.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-500">
                No milestones assigned yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {scientistMilestones.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{m.title}</div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        Due: {m.due_date} · Status: {m.status} · {m.progress_percent}%
                      </div>
                    </div>
                    {canEditProjects && m.status !== 'Completed' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/milestones/${m.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ status: 'Completed', progress_percent: 100 }),
                          });
                          await refreshData();
                          showToast(`Marked milestone "${m.title}" completed`);
                        }}
                        className="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-medium flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Complete</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reports, Publications/Datasets/Presentations & Funding */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Submitted & Pending Reports */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-sky-600" />
                <span>Submitted &amp; Pending Reports</span>
              </h3>
            </div>
            {scientistReports.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                No reports submitted or pending for this scientist.
              </div>
            ) : (
              <div className="space-y-2">
                {scientistReports.map((r) => (
                  <div
                    key={r.id}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <div className="font-semibold text-slate-900 dark:text-white">{r.title}</div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {r.report_type} · {r.status} · Due {r.due_date}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Publications, Datasets & Presentations */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal-600" />
                <span>Publications, Datasets &amp; Presentations</span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveModule('outputs')}
                className="text-[11px] font-semibold text-sky-600 hover:underline"
              >
                Write / View →
              </button>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500 mb-3">
              <span>
                Pubs: {scientistOutputs.filter((o) => o.output_type === OutputType.PUBLICATION).length}
              </span>
              <span>·</span>
              <span>
                Datasets: {scientistOutputs.filter((o) => o.output_type === OutputType.DATASET).length}
              </span>
              <span>·</span>
              <span>
                Talks: {scientistOutputs.filter((o) => o.output_type === OutputType.PRESENTATION).length}
              </span>
            </div>
            {scientistOutputs.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                No research outputs catalogued yet.
              </div>
            ) : (
              <div className="space-y-2">
                {scientistOutputs.map((o) => (
                  <div
                    key={o.id}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <div className="font-semibold text-slate-900 dark:text-white">{o.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {o.output_type} · {o.journal_or_event} · {o.publication_date}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Funding & Collaborators */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
                <Coins className="w-4 h-4 text-teal-600" />
                <span>Project Grants &amp; Funding</span>
              </h3>
              {scientistFunding.length === 0 ? (
                <p className="text-xs text-slate-500">No linked grants yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {scientistFunding.map((g) => (
                    <div key={g.id} className="text-xs font-mono flex justify-between">
                      <span>{g.grant_number}</span>
                      <span>
                        {g.currency} {g.allocated_amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-sky-600" />
                <span>Collaborators ({scientistCollaborators.length})</span>
              </h3>
              {scientistCollaborators.length === 0 ? (
                <p className="text-xs text-slate-500">No linked partner institutions yet.</p>
              ) : (
                <div className="space-y-1">
                  {scientistCollaborators.map((c) => (
                    <div key={c.id} className="text-xs text-slate-700 dark:text-slate-300">
                      {c.organization_name} ({c.country})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* GIS Sampling Locations & Activity/Notification Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Scientist Field Sampling Stations &amp; GIS Locations
            </h3>
            <GisMapCanvas locations={scientistLocations} heightClass="h-64" />
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                Research Activities &amp; Notifications Feed
              </h3>
              {scientistActivities.length === 0 && scientistNotifications.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-500">
                  No recent research activities or notifications for this scientist.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {scientistActivities.map((act) => (
                    <div
                      key={act.id}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <div className="font-semibold text-slate-900 dark:text-white">
                        [Activity] {act.title}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {act.activity_type} · {act.activity_date} · {act.status}
                      </div>
                    </div>
                  ))}
                  {scientistNotifications.slice(0, 5).map((n) => (
                    <div
                      key={n.id}
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <div className="font-semibold text-slate-900 dark:text-white">
                        [{n.category}] {n.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{n.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Self-Service Password Reset / Change Modal */}
        {selfPasswordModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-500" />
                  <span>Reset / Update Your Password</span>
                </h3>
                <button type="button" onClick={() => setSelfPasswordModalOpen(false)}>
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleSelfPasswordSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium mb-1">
                    Current Password <span className="text-slate-400">(optional verification)</span>
                  </label>
                  <input
                    type="password"
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="Enter current password..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    value={selfNewPasswordInput}
                    onChange={(e) => setSelfNewPasswordInput(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={selfConfirmPasswordInput}
                    onChange={(e) => setSelfConfirmPasswordInput(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelfPasswordModalOpen(false)}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                  >
                    Update Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Log Research Activity Modal */}
        {activityModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Log Research Activity
                </h3>
                <button type="button" onClick={() => setActivityModalOpen(false)}>
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleLogActivity} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium mb-1">Project</label>
                  <select
                    required
                    value={actProjectId}
                    onChange={(e) => setActProjectId(e.target.value)}
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
                  <label className="block font-medium mb-1">Activity Type</label>
                  <select
                    value={actType}
                    onChange={(e) => setActType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="Field Sampling">Field Sampling</option>
                    <option value="Cruise Expedition">Cruise Expedition</option>
                    <option value="Lab Analysis">Lab Analysis</option>
                    <option value="Stakeholder Workshop">Stakeholder Workshop</option>
                    <option value="Data Modeling">Data Modeling</option>
                    <option value="Milestone Review">Milestone Review</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Activity Title</label>
                  <input
                    type="text"
                    required
                    value={actTitle}
                    onChange={(e) => setActTitle(e.target.value)}
                    placeholder="e.g., Coral transect survey at Mombasa Marine Park"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Activity Date</label>
                  <input
                    type="date"
                    required
                    value={actDate}
                    onChange={(e) => setActDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Field/Lab Observations</label>
                  <textarea
                    rows={3}
                    value={actDesc}
                    onChange={(e) => setActDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActivityModalOpen(false)}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-sky-600 text-white font-semibold"
                  >
                    Save Activity
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===========================================================================
  // SCIENTISTS DIRECTORY LIST VIEW
  // ===========================================================================
  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            KMFRI Research Scientists &amp; Personnel Registry
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage operational scientist profiles, profile photos, staff numbers, directorate assignments, and researcher dashboards
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {user && (
            <button
              type="button"
              onClick={() => setSelectedScientistId(user.id)}
              className="px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>My Profile &amp; Photo</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => handleExportScientists('csv')}
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportScientists('excel')}
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportScientists('pdf')}
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF Report</span>
          </button>

          {canManageUsers && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-3.5 py-2 rounded-lg bg-[#0A2540] hover:bg-sky-900 dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register Scientist</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, staff number, email..."
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
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          <option value="all">All Research Areas</option>
          {db.research_areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          <option value="all">All Account Statuses</option>
          <option value="active">Active Scientists Only</option>
          <option value="inactive">Deactivated Accounts</option>
        </select>
      </div>

      {/* TanStack Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                >
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="py-3 px-4">
                      {header.isPlaceholder ? null : (
                        <div
                          onClick={header.column.getToggleSortingHandler()}
                          className={
                            header.column.getCanSort()
                              ? 'flex items-center gap-1 cursor-pointer select-none hover:text-slate-900 dark:hover:text-white'
                              : ''
                          }
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && <ArrowUpDown className="w-3 h-3" />}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-10 text-center text-slate-500">
                    No registered scientists match the current filter criteria.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {table.getRowModel().rows.length} of {filteredScientists.length} registered
            personnel
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Create / Edit Scientist Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingScientist ? 'Edit Scientist / Profile & Photo' : 'Register New KMFRI Scientist'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit(onSubmitScientist)}
              className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto"
            >
              {/* Profile Picture Upload Box inside Modal */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <UserAvatar
                  name={editingScientist?.full_name || 'KMFRI Scientist'}
                  avatarUrl={avatarDraft}
                  size="lg"
                />
                <div className="flex-1">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Scientist Profile Picture
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Visible on your researcher profile, publications, and when chatting with colleagues.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <input
                      ref={modalPhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleModalAvatarFile}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => modalPhotoInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Upload Photo from Device</span>
                    </button>
                    {avatarDraft && (
                      <button
                        type="button"
                        onClick={() => setAvatarDraft('')}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium mb-1">Staff Number</label>
                  <input
                    {...register('staff_number')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                  {errors.staff_number && (
                    <p className="text-rose-500 mt-1">{errors.staff_number.message}</p>
                  )}
                </div>
                <div>
                  <label className="block font-medium mb-1">Honorific Title</label>
                  <select
                    {...register('title')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="Dr.">Dr.</option>
                    <option value="Prof.">Prof.</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Mrs.">Mrs.</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Full Name</label>
                  <input
                    {...register('full_name')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                  {errors.full_name && (
                    <p className="text-rose-500 mt-1">{errors.full_name.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium mb-1">Institutional Email</label>
                  <input
                    type="email"
                    {...register('email')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                  {errors.email && <p className="text-rose-500 mt-1">{errors.email.message}</p>}
                </div>
                {!editingScientist ? (
                  <div>
                    <label className="block font-medium mb-1">Initial Password</label>
                    <input
                      type="text"
                      {...register('password')}
                      placeholder="Default: Kmfri@2025!"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block font-medium mb-1">Phone Contact</label>
                    <input
                      {...register('phone')}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium mb-1">Position / Scientific Rank</label>
                  <input
                    {...register('position')}
                    placeholder="e.g. Principal Research Scientist"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">System RBAC Role</label>
                  <select
                    {...register('role_code')}
                    disabled={!canManageUsers}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono disabled:opacity-60"
                  >
                    {Object.values(RoleCode).map((rc) => (
                      <option key={rc} value={rc}>
                        {rc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium mb-1">Directorate</label>
                  <select
                    {...register('directorate_id')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="">None / General</option>
                    {db.directorates.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Primary Research Area</label>
                  <select
                    {...register('research_area_id')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="">None / Cross-cutting</option>
                    {db.research_areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium mb-1">Research Center / Station</label>
                  <input
                    {...register('office_station')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">ORCID iD</label>
                  <input
                    {...register('orcid_id')}
                    placeholder="0000-0002-XXXX-XXXX"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Scientific Specialization</label>
                <input
                  {...register('specialization')}
                  placeholder="e.g. Coral Reef Ecology, Bathymetry, Stock Assessment"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
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
                  className="px-5 py-2 rounded-lg bg-[#0A2540] hover:bg-sky-900 dark:bg-sky-600 text-white font-semibold"
                >
                  {editingScientist ? 'Update Profile' : 'Create Scientist Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Password Reset Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Reset Scientist Password
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Set a new temporary password for{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {resetModalUser.title} {resetModalUser.full_name}
              </span>{' '}
              ({resetModalUser.email}). Action will be recorded in the security audit log.
            </p>
            <form onSubmit={confirmResetPassword} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">New Temporary Password</label>
                <input
                  type="text"
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-sky-600 text-white font-semibold"
                >
                  Confirm Password Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
