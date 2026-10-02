import React, { useState, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import {
  ProjectRecord,
  UserRecord,
  ReportRecord,
} from './types.ts';
import {
  ROLE_NAMES,
  canManageUsers,
  canReviewReport,
  isReportOverdue,
  calculateRemainingFunding,
  calculateUtilizationPercent,
  calculateScientistBalancedScorecard,
} from './lib/domain.ts';
import { DashboardsView } from './components/DashboardsView.tsx';
import { AdministrationView } from './components/AdministrationView.tsx';
import { InteractiveMap } from './components/InteractiveMap.tsx';
import { ProjectDetailModal } from './components/ProjectDetailModal.tsx';
import { OperationalModals } from './components/OperationalModals.tsx';
import { DocsAndTestsModal } from './components/DocsAndTestsModal.tsx';
import { KmfriLogo } from './components/KmfriLogo.tsx';
import { PublicationsStudioView } from './components/PublicationsStudioView.tsx';
import { SharedDriveView } from './components/SharedDriveView.tsx';
import { ScientistChatHub } from './components/ScientistChatHub.tsx';
import { AiResearchAssistantView } from './components/AiResearchAssistantView.tsx';
import { BalancedScorecardView } from './components/BalancedScorecardView.tsx';
import kenyanCoastHeroImg from './assets/images/kenyan_coast_hero_1790834061016.jpg';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  DollarSign,
  FileText,
  MapPin,
  Building2,
  BookOpen,
  FolderOpen,
  MessageSquare,
  Sparkles,
  Award,
  Camera,
  Bell,
  Settings,
  Search,
  Sun,
  Moon,
  LogOut,
  Plus,
  Compass,
  RefreshCw,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  Menu,
  X,
} from 'lucide-react';

type ModuleName =
  | 'Dashboard'
  | 'Scientists'
  | 'Balanced Scorecard'
  | 'Projects'
  | 'Funding'
  | 'Reports'
  | 'Locations'
  | 'Collaborators'
  | 'Research Outputs'
  | 'Documents'
  | 'Scientist Chatbox'
  | 'AI Assistant'
  | 'Notifications'
  | 'Administration';

const NAV_MODULES: {
  name: ModuleName;
  label?: string;
  icon: React.ComponentType<any>;
}[] = [
  { name: 'Dashboard', icon: LayoutDashboard },
  { name: 'Scientists', icon: Users },
  {
    name: 'Balanced Scorecard',
    label: 'Balanced Scorecard',
    icon: Award,
  },
  { name: 'Projects', icon: FolderKanban },
  { name: 'Funding', icon: DollarSign },
  { name: 'Reports', icon: FileText },
  { name: 'Locations', icon: MapPin },
  { name: 'Collaborators', icon: Building2 },
  {
    name: 'Research Outputs',
    label: 'Publications Studio',
    icon: BookOpen,
  },
  {
    name: 'Documents',
    label: 'SharePoint & Word Drive',
    icon: FolderOpen,
  },
  {
    name: 'Scientist Chatbox',
    label: 'Scientist Chatbox',
    icon: MessageSquare,
  },
  {
    name: 'AI Assistant',
    label: 'KMFRI AI Assistant',
    icon: Sparkles,
  },
  { name: 'Notifications', icon: Bell },
  { name: 'Administration', icon: Settings },
];

function DashboardShell() {
  const {
    firebaseUser,
    authLoading,
    dataLoading,
    error,
    data,
    theme,
    toggleTheme,
    signInWithEmail,
    resetScientistPassword,
    logout,
    refreshData,
    apiFetch,
  } = useAuth();

  const [activeModule, setActiveModule] = useState<ModuleName>('Dashboard');
  const [dashboardMode, setDashboardMode] = useState<
    'OVERALL' | 'SCIENTIST' | 'OCS_HEAD'
  >('OVERALL');
  const [inspectedScientistId, setInspectedScientistId] = useState<string | null>(
    null
  );
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(
    null
  );
  const [showDocsModal, setShowDocsModal] = useState(false);

  // Sign-In & Self-Service Password Reset Form State
  const [authCardMode, setAuthCardMode] = useState<'SIGN_IN' | 'RESET'>(
    'SIGN_IN'
  );
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Self-Service Password Reset State (Sign-In page)
  const [resetEmail, setResetEmail] = useState('');
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // In-Workspace Password Change Modal State
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newOwnPassword, setNewOwnPassword] = useState('');
  const [confirmOwnPassword, setConfirmOwnPassword] = useState('');
  const [ownPasswordStatus, setOwnPasswordStatus] = useState<string | null>(
    null
  );

  // Floating Chat Drawer & Shared Attachment Handoff
  const [floatingChatOpen, setFloatingChatOpen] = useState(false);
  const [pendingChatShare, setPendingChatShare] = useState<{
    type: 'file' | 'image' | 'publication' | 'project';
    name: string;
    url?: string;
    outputId?: string;
    projectId?: string;
  } | null>(null);

  // Global Search Modal, Mobile Navigation Drawer & Welcome Banner state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [welcomeBannerDismissed, setWelcomeBannerDismissed] = useState(false);
  const [uploadingAvatarId, setUploadingAvatarId] = useState<string | null>(
    null
  );

  const timeOfDayGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const handleUpdateProfilePhoto = async (
    photoDataUrl: string,
    targetUserId?: string
  ) => {
    if (!data) return;
    const uid = targetUserId || data.currentUser.id;
    setUploadingAvatarId(uid);
    try {
      if (uid === data.currentUser.id) {
        await apiFetch('/api/me/profile-photo', {
          method: 'PATCH',
          body: JSON.stringify({ profilePhoto: photoDataUrl }),
        });
      } else {
        await apiFetch(`/api/users/${uid}`, {
          method: 'PUT',
          body: JSON.stringify({ profilePhoto: photoDataUrl }),
        });
      }
      await refreshData();
    } finally {
      setUploadingAvatarId(null);
    }
  };

  // Operational Modals state
  const [modalType, setModalType] = useState<
    | null
    | 'USER'
    | 'PROJECT'
    | 'FUNDER'
    | 'FUNDING'
    | 'REPORT'
    | 'REVIEW_REPORT'
    | 'LOCATION'
    | 'COLLABORATOR'
    | 'OUTPUT'
    | 'DOCUMENT'
  >(null);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(
    null
  );
  const [reviewingReport, setReviewingReport] = useState<ReportRecord | null>(
    null
  );
  const [pickedCoords, setPickedCoords] = useState<{
    lat: number;
    lng: number;
    county?: string;
    marineArea?: string;
    site?: string;
  } | null>(null);

  const unreadNotificationsCount = useMemo(
    () => (data?.notifications || []).filter((n) => !n.readAt).length,
    [data?.notifications]
  );

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;
    setLoginSubmitting(true);
    try {
      await signInWithEmail(loginEmail.trim(), loginPassword);
    } catch {
      // error is displayed via AuthContext error state
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleSelfServicePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim() || !resetIdentifier.trim() || !resetNewPassword)
      return;
    setResetSubmitting(true);
    setResetSuccessMsg(null);
    try {
      const msg = await resetScientistPassword(
        resetEmail.trim(),
        resetIdentifier.trim(),
        resetNewPassword
      );
      setResetSuccessMsg(msg);
      setLoginEmail(resetEmail.trim());
      setLoginPassword(resetNewPassword);
      setAuthCardMode('SIGN_IN');
    } catch {
      // error is displayed via AuthContext error state
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnPasswordStatus(null);
    if (newOwnPassword.trim().length < 6) {
      setOwnPasswordStatus('New password must be at least 6 characters.');
      return;
    }
    if (newOwnPassword !== confirmOwnPassword) {
      setOwnPasswordStatus('Passwords do not match.');
      return;
    }
    try {
      await apiFetch('/api/me/reset-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword: newOwnPassword }),
      });
      setOwnPasswordStatus('SUCCESS: Your account password has been updated.');
      setNewOwnPassword('');
      setConfirmOwnPassword('');
      await refreshData();
    } catch (err: any) {
      setOwnPasswordStatus(err.message || 'Failed to update password.');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
        <div className="text-center space-y-2">
          <Compass className="w-8 h-8 text-sky-600 dark:text-sky-400 animate-spin mx-auto" />
          <div className="text-sm font-medium">
            Initializing KMFRI Research Management Portal...
          </div>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-[#051322] text-slate-900 dark:text-white transition-colors overflow-x-hidden">
        {/* Top Bar Contract on Sign-In Page */}
        <header className="px-4 sm:px-6 md:px-12 py-3.5 border-b border-slate-200 dark:border-sky-900/50 bg-white/95 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <KmfriLogo
              className="h-10 sm:h-11"
              showSubtitle={true}
              compactOnMobile={true}
              lightText={theme === 'dark'}
            />
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <span className="hidden md:inline text-xs text-slate-500 dark:text-sky-300/80">
              Kenya Marine and Fisheries Research Institute · Mombasa HQ
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              className="min-h-[40px] min-w-[40px] p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-sky-500 transition-colors flex items-center justify-center"
              title="Switch Light / Dark Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>
          </div>
        </header>

        {/* Split Modern Architectural Sign-In Canvas */}
        <main className="my-auto max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          {/* Left 7-Column Crystal-Clear Kenyan Coast Visual Showcase & Institutional Identity */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-5">
            <div className="inline-flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-mono font-semibold text-sky-700 dark:text-teal-400">
              <span>MINISTRY OF MINING, BLUE ECONOMY & MARITIME AFFAIRS</span>
              <span className="hidden sm:inline">·</span>
              <span>WGS84 04°03&apos;S 39°41&apos;E</span>
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
              KMFRI Scientists, Projects & Marine Research Governance System
            </h1>

            {/* Ultra-Clear Kenyan Coast Aerial Photography Showcase */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-sky-900/60 shadow-lg bg-slate-900">
              <img
                src={kenyanCoastHeroImg}
                alt="Kenyan Indian Ocean Coastline, Turquoise Coral Reef Lagoon, Mangroves and KMFRI Research Vessel"
                referrerPolicy="no-referrer"
                className="w-full h-[210px] sm:h-[275px] md:h-[320px] object-cover object-center"
              />
              <div className="px-3.5 sm:px-4 py-2.5 sm:py-3 bg-slate-950/90 border-t border-sky-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-400 inline-block shrink-0" />
                  <span className="font-semibold text-white">
                    Kenyan Indian Ocean Coastline &amp; Coral Reef Lagoon
                  </span>
                </div>
                <span className="font-mono text-[10px] sm:text-[11px] text-sky-300">
                  Mombasa · Watamu · Gazi Bay · Lamu EEZ (04°03&apos;17&quot;S 039°41&apos;01&quot;E)
                </span>
              </div>
            </div>

            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Secure institutional workspace for KMFRI Principal Investigators, Directorate Heads, and Research Administrators. Manage marine and freshwater research projects, grant allocations, technical report workflows, and satellite hydrographic station telemetry.
            </p>

            {/* Architectural Telemetry Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-3.5 pt-1">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70">
                <div className="font-mono font-bold text-base sm:text-lg text-sky-700 dark:text-sky-400 tabular-nums">
                  4 Directorates
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Oceans, Freshwater, Aquaculture & Blue Economy
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70">
                <div className="font-mono font-bold text-base sm:text-lg text-teal-700 dark:text-teal-400 tabular-nums">
                  8 GIS Stations
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Satellite EEZ, Lamu, Gazi, Kisumu & Turkana
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70">
                <div className="font-mono font-bold text-base sm:text-lg text-slate-900 dark:text-white tabular-nums">
                  6 RBAC Tiers
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Role-isolated permissions & JSONB audit logs
                </div>
              </div>
            </div>
          </div>

          {/* Right 5-Column Modern Researcher Email & Password Sign-In Card */}
          <div className="lg:col-span-5">
            <div className="p-5 sm:p-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg space-y-5">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <KmfriLogo
                  className="h-9 sm:h-10"
                  showSubtitle={true}
                  lightText={theme === 'dark'}
                />
                <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-mono font-semibold text-sky-700 dark:text-sky-400">
                  {authCardMode === 'SIGN_IN'
                    ? 'RESEARCHER AUTHENTICATION PORTAL'
                    : 'SCIENTIST SELF-SERVICE PASSWORD RESET'}
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {authCardMode === 'SIGN_IN'
                    ? 'Sign In to Your KMFRI Account'
                    : 'Reset Your Scientist Password'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {authCardMode === 'SIGN_IN'
                    ? 'Enter the institutional email address and password provisioned by your KMFRI System Administrator.'
                    : 'Verify your identity using your institutional email and KMFRI Staff Number (or Full Name) to set a new password.'}
                </p>
              </div>

              {resetSuccessMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 font-medium">
                  {resetSuccessMsg}
                </div>
              )}

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200">
                  {error}
                </div>
              )}

              {authCardMode === 'SIGN_IN' ? (
                <form onSubmit={handleEmailSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Institutional Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="scientist@kmfri.go.ke"
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:border-sky-600"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Account Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(loginEmail);
                          setResetSuccessMsg(null);
                          setAuthCardMode('RESET');
                        }}
                        className="text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline flex items-center gap-1"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>Forgot / Reset Password?</span>
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-sky-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loginSubmitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>
                      {loginSubmitting
                        ? 'Verifying Credentials...'
                        : 'Sign In with Email & Password'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={handleSelfServicePasswordReset}
                  className="space-y-3.5"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Institutional Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="scientist@kmfri.go.ke"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      KMFRI Staff Number or Full Name (Verification) *
                    </label>
                    <input
                      type="text"
                      required
                      value={resetIdentifier}
                      onChange={(e) => setResetIdentifier(e.target.value)}
                      placeholder="e.g., KMFRI-2041 or Dr. Amina Mwangi"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      New Account Password (min. 6 chars) *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full px-3.5 py-2 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setAuthCardMode('SIGN_IN')}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
                    >
                      Back to Sign In
                    </button>
                    <button
                      type="submit"
                      disabled={resetSubmitting}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {resetSubmitting
                        ? 'Resetting Password...'
                        : 'Verify & Reset Password'}
                    </button>
                  </div>
                </form>
              )}

              <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
                Accounts are provisioned by KMFRI Administrators in the System Administration module, or automatically activated on first institutional sign-in.
              </div>
            </div>
          </div>
        </main>

        <footer className="px-6 md:px-12 py-4 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-sky-900/40 flex flex-wrap justify-between gap-2">
          <span>
            © {new Date().getFullYear()} Kenya Marine and Fisheries Research Institute (KMFRI)
          </span>
          <span>
            English Point (Mombasa) · Kisumu · Kalokol (Turkana) · Naivasha · Gazi Bay · Shimoni
          </span>
        </footer>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-4">
          <Compass className="w-8 h-8 text-sky-700 dark:text-sky-400 animate-spin mx-auto" />
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            Synchronizing KMFRI PostgreSQL Workspace...
          </div>
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950 text-xs text-rose-700 dark:text-rose-200">
              {error}
            </div>
          )}
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={refreshData}
              className="px-4 py-2 rounded-lg bg-sky-700 text-white text-xs font-medium"
            >
              Retry Connection
            </button>
            <button
              type="button"
              onClick={logout}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentUser = data.currentUser;
  const activeSyncedProject = selectedProject
    ? data.projects.find((p) => p.id === selectedProject.id) || selectedProject
    : null;

  const q = globalSearch.trim().toLowerCase();

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors overflow-x-hidden">
      {/* MOBILE & TABLET SLIDE-OVER NAVIGATION DRAWER */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full bg-[#082238] text-slate-200 flex flex-col justify-between overflow-y-auto shadow-2xl border-r border-sky-900/60">
            <div>
              <div className="px-4 py-3.5 border-b border-sky-900/60 flex items-center justify-between gap-2">
                <KmfriLogo
                  className="h-9"
                  showSubtitle={false}
                  lightText={true}
                />
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-sky-900/60"
                  aria-label="Close navigation menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="p-3 space-y-1">
                {NAV_MODULES.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.name;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => {
                        setActiveModule(item.name);
                        setMobileNavOpen(false);
                      }}
                      className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-300 hover:bg-sky-950/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="whitespace-nowrap">
                          {item.label || item.name}
                        </span>
                      </div>
                      {item.name === 'Scientist Chatbox' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                      {item.name === 'AI Assistant' && (
                        <span className="text-[10px] font-mono font-bold text-teal-300">
                          AI
                        </span>
                      )}
                      {item.name === 'Notifications' &&
                        unreadNotificationsCount > 0 && (
                          <span className="font-mono text-[11px] font-bold text-teal-300">
                            {unreadNotificationsCount}
                          </span>
                        )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-4 border-t border-sky-900/60 space-y-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  {currentUser.profilePhoto ? (
                    <img
                      src={currentUser.profilePhoto}
                      alt={currentUser.fullName}
                      className="w-10 h-10 rounded-full object-cover border-2 border-teal-400"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-sky-700 border border-sky-400 text-white font-bold text-xs flex items-center justify-center">
                      {currentUser.fullName
                        .split(' ')
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                  )}
                  <label
                    title="Update My Profile Picture"
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-teal-500 text-slate-950 flex items-center justify-center cursor-pointer shadow"
                  >
                    <Camera className="w-3 h-3" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            handleUpdateProfilePhoto(reader.result);
                          }
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white truncate">
                    {currentUser.fullName}
                  </div>
                  <div className="text-sky-300/80 font-mono text-[11px] truncate">
                    {currentUser.staffNumber} · {currentUser.roleName}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  setOwnPasswordStatus(null);
                  setShowChangePasswordModal(true);
                }}
                className="w-full min-h-[40px] py-2 px-2.5 rounded-lg bg-sky-950/90 hover:bg-sky-900 border border-sky-800 text-sky-200 text-[11px] font-medium flex items-center justify-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-teal-400" />
                <span>Reset My Password</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  setShowDocsModal(true);
                }}
                className="w-full min-h-[40px] py-2 px-2.5 rounded-lg border border-sky-800/80 text-slate-200 text-[11px] font-medium"
              >
                Documentation &amp; Automated Tests
              </button>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  Active RBAC Role View
                </label>
                <select
                  value={currentUser.roleName}
                  onChange={async (e) => {
                    await apiFetch('/api/me/role-switch', {
                      method: 'POST',
                      body: JSON.stringify({ roleName: e.target.value }),
                    });
                    await refreshData();
                  }}
                  className="w-full px-2 py-2 rounded bg-slate-900 border border-sky-800 text-[11px] text-white"
                >
                  {ROLE_NAMES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* DESKTOP LEFT SIDEBAR NAVIGATION */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 border-r border-slate-200 dark:border-slate-800 bg-[#082238] text-slate-200 flex-col justify-between no-print">
        <div>
          <div className="px-4 py-3.5 border-b border-sky-900/60 flex items-center">
            <KmfriLogo className="h-10" showSubtitle={true} lightText={true} />
          </div>

          <nav className="p-3 space-y-1">
            {NAV_MODULES.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setActiveModule(item.name)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-300 hover:bg-sky-950/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">
                      {item.label || item.name}
                    </span>
                  </div>
                  {item.name === 'Scientist Chatbox' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                  {item.name === 'AI Assistant' && (
                    <span className="text-[10px] font-mono font-bold text-teal-300">
                      AI
                    </span>
                  )}
                  {item.name === 'Notifications' &&
                    unreadNotificationsCount > 0 && (
                      <span className="font-mono text-[11px] font-bold text-teal-300">
                        {unreadNotificationsCount}
                      </span>
                    )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Authenticated Scientist Sidebar Footer with Profile Picture */}
        <div className="p-4 border-t border-sky-900/60 space-y-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="relative group shrink-0">
              {currentUser.profilePhoto ? (
                <img
                  src={currentUser.profilePhoto}
                  alt={currentUser.fullName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-teal-400 shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-sky-700 border border-sky-400 text-white font-bold text-xs flex items-center justify-center">
                  {currentUser.fullName
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
              )}
              <label
                title="Update My Profile Picture"
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-teal-500 hover:bg-teal-400 text-slate-950 flex items-center justify-center cursor-pointer shadow"
              >
                <Camera className="w-3 h-3" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === 'string') {
                        handleUpdateProfilePhoto(reader.result);
                      }
                    };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-white truncate">
                {currentUser.fullName}
              </div>
              <div className="text-sky-300/80 font-mono text-[11px] truncate">
                {currentUser.staffNumber} · {currentUser.roleName}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setOwnPasswordStatus(null);
              setShowChangePasswordModal(true);
            }}
            className="w-full py-1.5 px-2.5 rounded-lg bg-sky-950/90 hover:bg-sky-900 border border-sky-800 text-sky-200 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5 text-teal-400" />
            <span>Reset My Password</span>
          </button>

          <div>
            <label className="block text-[10px] text-slate-400 mb-1">
              Active RBAC Role View
            </label>
            <select
              value={currentUser.roleName}
              onChange={async (e) => {
                await apiFetch('/api/me/role-switch', {
                  method: 'POST',
                  body: JSON.stringify({ roleName: e.target.value }),
                });
                await refreshData();
              }}
              className="w-full px-2 py-1.5 rounded bg-slate-900 border border-sky-800 text-[11px] text-white"
            >
              {ROLE_NAMES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE CANVAS */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Responsive Top App Bar */}
        <header className="min-h-14 px-3 sm:px-6 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 sm:gap-4 no-print sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden min-h-[40px] min-w-[40px] p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0"
              aria-label="Open navigation drawer"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="lg:hidden shrink-0">
              <KmfriLogo
                className="h-8"
                showSubtitle={false}
                lightText={theme === 'dark'}
              />
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
              <span className="hidden lg:inline font-bold text-slate-900 dark:text-white">
                KMFRI
              </span>
              <span className="hidden lg:inline">/</span>
              <span className="font-semibold text-slate-900 dark:text-white truncate">
                {activeModule}
              </span>
            </div>

            {dataLoading && (
              <RefreshCw className="w-3.5 h-3.5 text-sky-600 animate-spin shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Activated Global Search Form + Search Button */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowSearchModal(true);
              }}
              className="flex items-center gap-1.5"
            >
              <div className="relative hidden sm:block w-36 md:w-56 lg:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Search projects, scientists..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-sky-600"
                />
                {globalSearch && (
                  <button
                    type="button"
                    onClick={() => setGlobalSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                onClick={() => setShowSearchModal(true)}
                className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                title="Search across all KMFRI modules"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Search</span>
              </button>
            </form>

            <button
              type="button"
              onClick={() => setActiveModule('AI Assistant')}
              className={`min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeModule === 'AI Assistant'
                  ? 'bg-teal-600 text-white'
                  : 'border border-teal-500/40 bg-teal-50/70 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60'
              }`}
              title="KMFRI AI Research Assistant"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">AI Assistant</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDocsModal(true)}
              className="hidden xl:inline-flex min-h-[38px] items-center px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Docs & Tests
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 text-xs font-medium"
              title="Toggle Dark / Light Theme"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden md:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                  <span className="hidden md:inline">Dark</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={logout}
              className="min-h-[38px] min-w-[38px] p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-rose-600 flex items-center justify-center"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Module Content Area */}
        <main className="p-3.5 sm:p-6 pb-24 lg:pb-6 flex-1 overflow-y-auto overflow-x-hidden max-w-[1440px] w-full mx-auto space-y-5 sm:space-y-6">
          {/* PERSONALIZED GREETING & WELCOME BACK BANNER ON LOGIN */}
          {!welcomeBannerDismissed && (
            <div className="p-4 sm:p-5 rounded-2xl border border-sky-200 dark:border-sky-900/70 bg-gradient-to-r from-sky-900 via-[#082238] to-teal-950 text-white shadow-sm flex flex-wrap items-center justify-between gap-4 no-print">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  {currentUser.profilePhoto ? (
                    <img
                      src={currentUser.profilePhoto}
                      alt={currentUser.fullName}
                      className="w-14 h-14 rounded-full object-cover border-2 border-teal-400 shadow-md"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-sky-700 border-2 border-teal-400 text-white font-bold text-base flex items-center justify-center shadow-md">
                      {currentUser.fullName
                        .split(' ')
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                  )}
                  <label
                    title="Update Profile Picture"
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-teal-400 hover:bg-teal-300 text-slate-950 flex items-center justify-center cursor-pointer shadow"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            handleUpdateProfilePhoto(reader.result);
                          }
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-teal-300 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>KMFRI AUTHENTICATED SCIENTIST SESSION</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">
                    {timeOfDayGreeting}, {currentUser.fullName}! Welcome back to KMFRI Research Workspace.
                  </h2>
                  <p className="text-xs text-sky-200/90">
                    {currentUser.position || 'Research Scientist'} ·{' '}
                    {data.directorates.find(
                      (d) => d.id === currentUser.directorateId
                    )?.name || 'Oceans & Coastal Systems'}{' '}
                    · Staff ID: <span className="font-mono">{currentUser.staffNumber}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInspectedScientistId(currentUser.id);
                    setDashboardMode('SCIENTIST');
                    setActiveModule('Dashboard');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  My Scientist Page &amp; Photo
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModule('AI Assistant')}
                  className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask AI Assistant</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWelcomeBannerDismissed(true)}
                  className="p-1.5 rounded-lg text-sky-300 hover:text-white"
                  title="Dismiss greeting banner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 1. DASHBOARD MODULE */}
          {activeModule === 'Dashboard' && (
            <DashboardsView
              data={data}
              dashboardMode={dashboardMode}
              setDashboardMode={setDashboardMode}
              inspectedScientistId={inspectedScientistId}
              setInspectedScientistId={setInspectedScientistId}
              onSelectProject={(p) => setSelectedProject(p)}
              onNavigateModule={(m) => setActiveModule(m as ModuleName)}
              onOpenNewProject={() => {
                setEditingProject(null);
                setModalType('PROJECT');
              }}
              onOpenNewReport={() => setModalType('REPORT')}
              onOpenNewLocation={(lat, lng, suggested) => {
                setPickedCoords({ lat, lng, ...suggested });
                setModalType('LOCATION');
              }}
              onUpdateProfilePhoto={handleUpdateProfilePhoto}
            />
          )}

          {/* 2. SCIENTISTS DIRECTORY MODULE */}
          {activeModule === 'Scientists' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    KMFRI Scientists & Research Personnel ({data.users.length})
                  </h1>
                  <p className="text-xs text-slate-500">
                    Click any scientist card to inspect their personal dashboard, projects, milestones, and publications.
                  </p>
                </div>
                {canManageUsers(currentUser.roleName, currentUser.permissions) && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUser(null);
                      setModalType('USER');
                    }}
                    className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Register Scientist Account</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.users
                  .filter(
                    (u) =>
                      !q ||
                      u.fullName.toLowerCase().includes(q) ||
                      u.email.toLowerCase().includes(q) ||
                      (u.staffNumber || '').toLowerCase().includes(q)
                  )
                  .map((sci) => {
                    const dir = data.directorates.find(
                      (d) => d.id === sci.directorateId
                    );
                    const area = data.researchAreas.find(
                      (a) => a.id === sci.researchAreaId
                    );
                    const ledCount = data.projects.filter(
                      (p) => p.principalInvestigatorId === sci.id
                    ).length;
                    const sciBsc = calculateScientistBalancedScorecard({
                      scientistId: sci.id,
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
                    const canEditThisPhoto =
                      sci.id === currentUser.id ||
                      canManageUsers(
                        currentUser.roleName,
                        currentUser.permissions
                      );
                    const sciInitials = (sci.fullName || 'KM')
                      .split(' ')
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    return (
                      <div
                        key={sci.id}
                        className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-4"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="relative shrink-0">
                                {sci.profilePhoto ? (
                                  <img
                                    src={sci.profilePhoto}
                                    alt={sci.fullName}
                                    className="w-12 h-12 rounded-full object-cover border-2 border-sky-600 dark:border-sky-400"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-full bg-sky-700 text-white font-bold text-sm flex items-center justify-center">
                                    {sciInitials}
                                  </div>
                                )}
                                {canEditThisPhoto && (
                                  <label
                                    title="Update Scientist Profile Picture"
                                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-sky-700 hover:bg-sky-800 text-white flex items-center justify-center cursor-pointer shadow"
                                  >
                                    <Camera className="w-3 h-3" />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = () => {
                                          if (typeof reader.result === 'string') {
                                            handleUpdateProfilePhoto(
                                              reader.result,
                                              sci.id
                                            );
                                          }
                                        };
                                        reader.readAsDataURL(file);
                                        e.target.value = '';
                                      }}
                                    />
                                  </label>
                                )}
                              </div>
                              <div>
                                <div className="font-mono text-xs font-semibold text-sky-700 dark:text-sky-400">
                                  {sci.staffNumber || 'KMFRI-STAFF'}
                                  {uploadingAvatarId === sci.id && (
                                    <span className="ml-2 text-[10px] text-teal-600">
                                      Saving photo...
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                  {sci.fullName}
                                </h3>
                                <div className="text-xs text-slate-500">
                                  {sci.position || 'Research Scientist'} ·{' '}
                                  {dir?.code || 'OCS'}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-slate-500">
                              {sci.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-3">
                            {area?.name || 'Marine & Fisheries Research'}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {sci.email} {sci.phone ? `· ${sci.phone}` : ''}
                          </div>
                          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                            <span className="font-mono font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                              <Award className="w-3.5 h-3.5 text-amber-500" />
                              <span>BSC Score: {sciBsc.totalScore}/100</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveModule('Balanced Scorecard')}
                              className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 hover:bg-sky-500/20 cursor-pointer"
                            >
                              {sciBsc.grade}
                            </button>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                          <span className="font-mono text-slate-500">
                            {ledCount} Led Project{ledCount === 1 ? '' : 's'}
                          </span>
                          <div className="flex items-center gap-3">
                            {canManageUsers(
                              currentUser.roleName,
                              currentUser.permissions
                            ) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUser(sci);
                                  setModalType('USER');
                                }}
                                className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
                              >
                                Edit / Password
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setInspectedScientistId(sci.id);
                                setDashboardMode('SCIENTIST');
                                setActiveModule('Dashboard');
                              }}
                              className="font-semibold text-sky-700 dark:text-sky-400 hover:underline"
                            >
                              Open Workspace →
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* 2B. SCIENTIST BALANCED SCORECARD & RELATED EVENTS MODULE */}
          {activeModule === 'Balanced Scorecard' && (
            <BalancedScorecardView
              data={data}
              searchQuery={globalSearch}
              onRefresh={refreshData}
              apiFetch={apiFetch}
              onSelectScientistProfile={(userId) => {
                setInspectedScientistId(userId);
                setDashboardMode('SCIENTIST');
                setActiveModule('Dashboard');
              }}
            />
          )}

          {/* 3. PROJECTS REGISTRY MODULE */}
          {activeModule === 'Projects' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Research Projects Portfolio ({data.projects.length})
                  </h1>
                  <p className="text-xs text-slate-500">
                    Click any project to open its 11-tab scientific management workspace (Overview, Team, Timeline, Budget, Funding, Locations, Collaborators, Milestones, Reports, Documents & Activity).
                  </p>
                </div>
                {currentUser.roleName !== 'VIEWER' && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProject(null);
                      setModalType('PROJECT');
                    }}
                    className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Research Project</span>
                  </button>
                )}
              </div>

              {data.projects.length === 0 ? (
                <div className="p-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-3">
                  <FolderKanban className="w-10 h-10 text-sky-700 dark:text-sky-400 mx-auto" />
                  <div className="text-base font-semibold text-slate-900 dark:text-white">
                    No Operational Research Projects Registered Yet
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Start by creating your first KMFRI marine or freshwater research project. It will be persisted directly to Cloud SQL PostgreSQL.
                  </p>
                  {currentUser.roleName !== 'VIEWER' && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProject(null);
                        setModalType('PROJECT');
                      }}
                      className="px-4 py-2 rounded-lg bg-sky-700 text-white text-xs font-medium"
                    >
                      + Create First KMFRI Project
                    </button>
                  )}
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500">
                        <th className="py-3 px-4">Code</th>
                        <th className="py-3 px-4">Project Title & Directorate</th>
                        <th className="py-3 px-4">Principal Investigator</th>
                        <th className="py-3 px-4">Status & Priority</th>
                        <th className="py-3 px-4 text-right">Budget</th>
                        <th className="py-3 px-4 text-right">Progress</th>
                        <th className="py-3 px-4 text-right">Workspace</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {data.projects
                        .filter(
                          (p) =>
                            !q ||
                            p.title.toLowerCase().includes(q) ||
                            p.projectCode.toLowerCase().includes(q)
                        )
                        .map((p) => {
                          const dir = data.directorates.find(
                            (d) => d.id === p.directorateId
                          );
                          const pi = data.users.find(
                            (u) => u.id === p.principalInvestigatorId
                          );
                          return (
                            <tr
                              key={p.id}
                              onClick={() => setSelectedProject(p)}
                              className="cursor-pointer hover:bg-slate-50/90 dark:hover:bg-slate-800/50"
                            >
                              <td className="py-3 px-4 font-mono font-semibold text-sky-700 dark:text-sky-400 whitespace-nowrap">
                                {p.projectCode}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {p.title}
                                </div>
                                <div className="text-slate-500">
                                  {dir?.name || 'Oceans & Coastal'} · {p.startDate} →{' '}
                                  {p.endDate}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                {pi?.fullName || 'Unassigned'}
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {p.status}
                                </span>{' '}
                                · <span className="text-slate-500">{p.priority}</span>
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums">
                                {p.currency} {Number(p.budget).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-teal-700 dark:text-teal-400">
                                {p.progressPercent}%
                              </td>
                              <td className="py-3 px-4 text-right font-medium text-sky-700 dark:text-sky-400">
                                Open 11 Tabs →
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 4. FUNDING & GRANTS MODULE */}
          {activeModule === 'Funding' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Grants, Donors & Financial Utilization
                  </h1>
                  <p className="text-xs text-slate-500">
                    Track funding sources, grant numbers, allocated vs spent amounts, and remaining balances across projects and directorates.
                  </p>
                </div>
                {currentUser.roleName !== 'VIEWER' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setModalType('FUNDER')}
                      className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
                    >
                      + Register Funder Agency
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalType('FUNDING')}
                      className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium"
                    >
                      + Record Grant Allocation
                    </button>
                  </div>
                )}
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500">
                      <th className="py-3 px-4">Grant Number</th>
                      <th className="py-3 px-4">Funder & Type</th>
                      <th className="py-3 px-4">Linked Project</th>
                      <th className="py-3 px-4 text-right">Award Amount</th>
                      <th className="py-3 px-4 text-right">Allocated</th>
                      <th className="py-3 px-4 text-right">Spent</th>
                      <th className="py-3 px-4 text-right">Remaining</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {data.funding.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          No grants recorded yet. Register a Funder Agency first, then click &ldquo;+ Record Grant Allocation&rdquo;.
                        </td>
                      </tr>
                    ) : (
                      data.funding
                        .filter(
                          (f) =>
                            !q ||
                            f.grantNumber.toLowerCase().includes(q) ||
                            f.status.toLowerCase().includes(q)
                        )
                        .map((f) => {
                        const funder = data.funders.find(
                          (fd) => fd.id === f.funderId
                        );
                        const proj = data.projects.find(
                          (p) => p.id === f.projectId
                        );
                        const rem = calculateRemainingFunding(
                          f.allocatedAmount,
                          f.spentAmount
                        );
                        const util = calculateUtilizationPercent(
                          f.allocatedAmount,
                          f.spentAmount
                        );
                        return (
                          <tr key={f.id}>
                            <td className="py-3 px-4 font-mono font-semibold text-sky-700 dark:text-sky-400">
                              {f.grantNumber}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {funder?.name || 'Donor'}
                              </div>
                              <div className="text-slate-500">
                                {funder?.type} · {funder?.country}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {proj?.projectCode} — {proj?.title}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">
                              {f.currency} {Number(f.amount).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">
                              {f.currency}{' '}
                              {Number(f.allocatedAmount).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">
                              {f.currency} {Number(f.spentAmount).toLocaleString()}{' '}
                              ({util}%)
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-teal-700 dark:text-teal-400">
                              {f.currency} {rem.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 font-medium">{f.status}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. REPORTS & REVIEW WORKFLOW MODULE */}
          {activeModule === 'Reports' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Technical & Progress Reports Workflow ({data.reports.length})
                  </h1>
                  <p className="text-xs text-slate-500">
                    Workflow pipeline: Draft → Submit → Under Review → Approved / Rejected with automated overdue detection.
                  </p>
                </div>
                {currentUser.roleName !== 'VIEWER' && (
                  <button
                    type="button"
                    onClick={() => setModalType('REPORT')}
                    className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium"
                  >
                    + Create / Submit Report
                  </button>
                )}
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500">
                      <th className="py-3 px-4">Report Title & Type</th>
                      <th className="py-3 px-4">Project</th>
                      <th className="py-3 px-4">Lead Scientist</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4">Workflow Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {data.reports.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          No reports submitted yet. Click &ldquo;+ Create / Submit Report&rdquo; to initiate a report workflow.
                        </td>
                      </tr>
                    ) : (
                      data.reports
                        .filter(
                          (r) =>
                            !q ||
                            r.title.toLowerCase().includes(q) ||
                            r.reportType.toLowerCase().includes(q) ||
                            (r.reportingPeriod || '').toLowerCase().includes(q)
                        )
                        .map((r) => {
                        const proj = data.projects.find(
                          (p) => p.id === r.projectId
                        );
                        const sci = data.users.find(
                          (u) => u.id === r.scientistId
                        );
                        const overdue = isReportOverdue(r.dueDate, r.status);
                        return (
                          <tr key={r.id}>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {r.title}
                              </div>
                              <div className="text-slate-500">
                                {r.reportType} · Period: {r.reportingPeriod} · v
                                {r.version}
                              </div>
                              {r.reviewComments && (
                                <div className="text-slate-600 dark:text-slate-400 mt-0.5 italic">
                                  Reviewer: &ldquo;{r.reviewComments}&rdquo;
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono">
                              {proj?.projectCode || 'N/A'}
                            </td>
                            <td className="py-3 px-4">
                              {sci?.fullName || 'Scientist'}
                            </td>
                            <td className="py-3 px-4 font-mono">{r.dueDate}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`font-semibold ${
                                  overdue
                                    ? 'text-rose-600'
                                    : r.status === 'Approved'
                                      ? 'text-emerald-600'
                                      : 'text-sky-700 dark:text-sky-400'
                                }`}
                              >
                                {r.status} {overdue ? '(OVERDUE)' : ''}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-2">
                              {r.status === 'Draft' &&
                                currentUser.roleName !== 'VIEWER' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await apiFetch(`/api/reports/${r.id}`, {
                                        method: 'PUT',
                                        body: JSON.stringify({
                                          status: 'Submitted',
                                        }),
                                      });
                                      await refreshData();
                                    }}
                                    className="text-sky-700 dark:text-sky-400 font-semibold hover:underline"
                                  >
                                    Submit for Review
                                  </button>
                                )}
                              {canReviewReport(
                                currentUser.roleName,
                                currentUser.permissions
                              ) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewingReport(r);
                                    setModalType('REVIEW_REPORT');
                                  }}
                                  className="text-teal-700 dark:text-teal-400 font-semibold hover:underline"
                                >
                                  Review / Approve
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. GIS PROJECT LOCATIONS MODULE */}
          {activeModule === 'Locations' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    GIS Marine, Coastal & Freshwater Research Stations ({data.locations.length})
                  </h1>
                  <p className="text-xs text-slate-500">
                    Click any point on the hydrographic map below or select a KMFRI Reference Station to pre-fill WGS84 coordinates and register a field site.
                  </p>
                </div>
                {currentUser.roleName !== 'VIEWER' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPickedCoords(null);
                      setModalType('LOCATION');
                    }}
                    className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium"
                  >
                    + Add GIS Location
                  </button>
                )}
              </div>

              <InteractiveMap
                locations={data.locations}
                projectLocations={data.projectLocations}
                projects={data.projects}
                onSelectProject={(pid) => {
                  const found = data.projects.find((p) => p.id === pid);
                  if (found) setSelectedProject(found);
                }}
                onPickCoordinates={
                  currentUser.roleName !== 'VIEWER'
                    ? (lat, lng, suggested) => {
                        setPickedCoords({ lat, lng, ...suggested });
                        setModalType('LOCATION');
                      }
                    : undefined
                }
              />
            </div>
          )}

          {/* 7. COLLABORATORS MODULE */}
          {activeModule === 'Collaborators' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Partner Organizations, Universities & BMU Collaborators ({data.collaborators.length})
                  </h1>
                  <p className="text-xs text-slate-500">
                    Institutional agreements, MOUs, and joint research partners.
                  </p>
                </div>
                {currentUser.roleName !== 'VIEWER' && (
                  <button
                    type="button"
                    onClick={() => setModalType('COLLABORATOR')}
                    className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium"
                  >
                    + Register Collaborator
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.collaborators.length === 0 ? (
                  <div className="col-span-full p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs text-slate-500">
                    No partner organizations registered yet. Click &ldquo;+ Register Collaborator&rdquo; to add an institutional partner.
                  </div>
                ) : (
                  data.collaborators.map((c) => (
                    <div
                      key={c.id}
                      className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
                    >
                      <div className="text-xs text-teal-700 dark:text-teal-400 font-medium">
                        {c.organizationType} · {c.country} · {c.collaborationType}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {c.organizationName}
                      </h3>
                      <div className="text-xs text-slate-500">
                        Contact: {c.contactPerson || 'N/A'} · {c.email || 'No email'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 8. PUBLICATIONS & RESEARCH OUTPUTS STUDIO MODULE */}
          {activeModule === 'Research Outputs' && (
            <PublicationsStudioView
              data={data}
              searchQuery={globalSearch}
              onRefresh={refreshData}
              apiFetch={apiFetch}
              onShareToChat={(out) => {
                setPendingChatShare({
                  type: 'publication',
                  name: out.title,
                  outputId: out.id,
                  url: out.fileUrl || undefined,
                });
                setActiveModule('Scientist Chatbox');
              }}
            />
          )}

          {/* 9. SHARED FOLDERS, FILES & SCIENTIFIC IMAGERY MODULE */}
          {activeModule === 'Documents' && (
            <SharedDriveView
              data={data}
              searchQuery={globalSearch}
              onRefresh={refreshData}
              apiFetch={apiFetch}
              onShareFileToChat={(doc) => {
                const isImg =
                  (doc.mimeType || '').startsWith('image/') ||
                  (doc.fileUrl || '').startsWith('data:image/') ||
                  /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(doc.name);
                setPendingChatShare({
                  type: isImg ? 'image' : 'file',
                  name: doc.name,
                  url: doc.fileUrl,
                });
                setActiveModule('Scientist Chatbox');
              }}
            />
          )}

          {/* 9B. REAL-TIME SCIENTIST CHATBOX & RESEARCH EXCHANGE MODULE */}
          {activeModule === 'Scientist Chatbox' && (
            <ScientistChatHub
              data={data}
              apiFetch={apiFetch}
              onSelectProject={(proj) => setSelectedProject(proj)}
              onNavigateModule={(mod) => setActiveModule(mod as ModuleName)}
              pendingShareAttachment={pendingChatShare}
              onClearPendingShare={() => setPendingChatShare(null)}
            />
          )}

          {/* 9C. KMFRI AI RESEARCH & GOVERNANCE ASSISTANT MODULE */}
          {activeModule === 'AI Assistant' && (
            <AiResearchAssistantView
              data={data}
              apiFetch={apiFetch}
              onShareInsightToChat={(textSnippet: string) => {
                setPendingChatShare({
                  type: 'publication',
                  name: `AI Synthesis: ${textSnippet.slice(0, 90)}...`,
                });
                setActiveModule('Scientist Chatbox');
              }}
              onNavigateModule={(mod) => setActiveModule(mod as ModuleName)}
            />
          )}

          {/* 10. NOTIFICATIONS MODULE */}
          {activeModule === 'Notifications' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Notifications & Workflow Alerts ({data.notifications.length})
                  </h1>
                  <p className="text-xs text-slate-500">
                    Account alerts, PI project assignments, approvals, report review decisions, and institutional announcements.
                  </p>
                </div>
                {unreadNotificationsCount > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch('/api/notifications/read-all', {
                        method: 'POST',
                      });
                      await refreshData();
                    }}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  >
                    Mark All as Read
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {data.notifications.length === 0 ? (
                  <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs text-slate-500">
                    You have no notifications at this time.
                  </div>
                ) : (
                  data.notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
                        n.readAt
                          ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-75'
                          : 'border-sky-300 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/30'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-mono text-sky-700 dark:text-sky-400">
                          {n.type} · {new Date(n.createdAt).toLocaleString()}
                        </div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                          {n.title}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          {n.message}
                        </p>
                      </div>
                      {!n.readAt && (
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/notifications/${n.id}/read`, {
                              method: 'PATCH',
                            });
                            await refreshData();
                          }}
                          className="text-xs text-sky-700 dark:text-sky-400 font-medium hover:underline shrink-0"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 11. ADMINISTRATION MODULE */}
          {activeModule === 'Administration' && (
            <AdministrationView
              data={data}
              onRefresh={refreshData}
              apiFetch={apiFetch}
              onOpenNewUser={() => {
                setEditingUser(null);
                setModalType('USER');
              }}
              onEditUser={(u) => {
                setEditingUser(u);
                setModalType('USER');
              }}
            />
          )}
        </main>
      </div>

      {/* 11-Tab Project Detail Workspace Modal */}
      {activeSyncedProject && (
        <ProjectDetailModal
          project={activeSyncedProject}
          data={data}
          onClose={() => setSelectedProject(null)}
          onRefresh={refreshData}
          apiFetch={apiFetch}
          onEditProject={(proj) => {
            setSelectedProject(null);
            setEditingProject(proj);
            setModalType('PROJECT');
          }}
          onSelectScientist={(uid) => {
            setInspectedScientistId(uid);
            setDashboardMode('SCIENTIST');
            setActiveModule('Dashboard');
          }}
        />
      )}

      {/* Operational Create/Edit Modals */}
      <OperationalModals
        activeModal={modalType}
        editingUser={editingUser}
        editingProject={editingProject}
        reviewingReport={reviewingReport}
        pickedCoords={pickedCoords}
        data={data}
        onClose={() => {
          setModalType(null);
          setEditingUser(null);
          setEditingProject(null);
          setReviewingReport(null);
        }}
        onRefresh={refreshData}
        apiFetch={apiFetch}
      />

      {/* Documentation & Automated Test Suite Modal */}
      {showDocsModal && (
        <DocsAndTestsModal onClose={() => setShowDocsModal(false)} />
      )}

      {/* Global Cross-Module Search Modal (Activated by Search Button or Enter) */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/65 backdrop-blur-xs p-4 pt-16">
          <div className="w-full max-w-3xl max-h-[82vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <Search className="w-4 h-4 text-sky-600 shrink-0" />
              <input
                type="text"
                autoFocus
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Type to search across Projects, Scientists, Publications, Reports, Files & GIS Stations..."
                className="flex-1 text-sm bg-transparent text-slate-900 dark:text-white focus:outline-none"
              />
              {globalSearch && (
                <button
                  type="button"
                  onClick={() => setGlobalSearch('')}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Matching Projects */}
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider font-bold text-sky-700 dark:text-sky-400 mb-2">
                  Research Projects (
                  {
                    data.projects.filter(
                      (p) =>
                        !q ||
                        p.title.toLowerCase().includes(q) ||
                        p.projectCode.toLowerCase().includes(q) ||
                        (p.description || '').toLowerCase().includes(q)
                    ).length
                  }
                  )
                </div>
                <div className="space-y-1.5">
                  {data.projects
                    .filter(
                      (p) =>
                        !q ||
                        p.title.toLowerCase().includes(q) ||
                        p.projectCode.toLowerCase().includes(q) ||
                        (p.description || '').toLowerCase().includes(q)
                    )
                    .slice(0, 5)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProject(p);
                          setShowSearchModal(false);
                        }}
                        className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-3"
                      >
                        <div>
                          <span className="font-mono font-bold text-sky-700 dark:text-sky-400 mr-2">
                            {p.projectCode}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {p.title}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-teal-700 dark:text-teal-400 shrink-0">
                          {p.status} · {p.progressPercent}% →
                        </span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Matching Scientists */}
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider font-bold text-teal-700 dark:text-teal-400 mb-2">
                  KMFRI Scientists (
                  {
                    data.users.filter(
                      (u) =>
                        !q ||
                        u.fullName.toLowerCase().includes(q) ||
                        u.email.toLowerCase().includes(q) ||
                        (u.staffNumber || '').toLowerCase().includes(q) ||
                        (u.position || '').toLowerCase().includes(q)
                    ).length
                  }
                  )
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {data.users
                    .filter(
                      (u) =>
                        !q ||
                        u.fullName.toLowerCase().includes(q) ||
                        u.email.toLowerCase().includes(q) ||
                        (u.staffNumber || '').toLowerCase().includes(q) ||
                        (u.position || '').toLowerCase().includes(q)
                    )
                    .slice(0, 6)
                    .map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setInspectedScientistId(u.id);
                          setDashboardMode('SCIENTIST');
                          setActiveModule('Dashboard');
                          setShowSearchModal(false);
                        }}
                        className="text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 bg-slate-50/70 dark:bg-slate-800/50 flex items-center gap-2.5"
                      >
                        {u.profilePhoto ? (
                          <img
                            src={u.profilePhoto}
                            alt={u.fullName}
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-sky-700 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                            {u.fullName
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">
                            {u.fullName}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {u.staffNumber} · {u.position || u.roleName}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>

              {/* Matching Publications & Research Outputs */}
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider font-bold text-sky-700 dark:text-sky-400 mb-2">
                  Publications &amp; Research Outputs (
                  {
                    data.researchOutputs.filter(
                      (o) =>
                        !q ||
                        o.title.toLowerCase().includes(q) ||
                        (o.journalOrEvent || '').toLowerCase().includes(q) ||
                        (o.keywords || '').toLowerCase().includes(q)
                    ).length
                  }
                  )
                </div>
                <div className="space-y-1.5">
                  {data.researchOutputs
                    .filter(
                      (o) =>
                        !q ||
                        o.title.toLowerCase().includes(q) ||
                        (o.journalOrEvent || '').toLowerCase().includes(q) ||
                        (o.keywords || '').toLowerCase().includes(q)
                    )
                    .slice(0, 4)
                    .map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setActiveModule('Research Outputs');
                          setShowSearchModal(false);
                        }}
                        className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {o.title}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {o.outputType} · {o.journalOrEvent || 'KMFRI Output'}
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-sky-600 shrink-0">
                          Open Studio →
                        </span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Matching Shared Files & GIS Stations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-wider font-bold text-slate-600 dark:text-slate-400 mb-2">
                    Shared Files &amp; Folders (
                    {
                      data.documents.filter(
                        (d) =>
                          !q ||
                          d.name.toLowerCase().includes(q) ||
                          d.type.toLowerCase().includes(q)
                      ).length
                    }
                    )
                  </div>
                  <div className="space-y-1.5">
                    {data.documents
                      .filter(
                        (d) =>
                          !q ||
                          d.name.toLowerCase().includes(q) ||
                          d.type.toLowerCase().includes(q)
                      )
                      .slice(0, 3)
                      .map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            setActiveModule('Documents');
                            setShowSearchModal(false);
                          }}
                          className="w-full text-left p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-sky-500 text-slate-800 dark:text-slate-200 truncate"
                        >
                          {d.name} ({d.type})
                        </button>
                      ))}
                  </div>
                </div>

                <div>
                  <div className="font-mono text-[11px] uppercase tracking-wider font-bold text-slate-600 dark:text-slate-400 mb-2">
                    GIS Hydrographic Stations (
                    {
                      data.locations.filter(
                        (l) =>
                          !q ||
                          l.name.toLowerCase().includes(q) ||
                          l.county.toLowerCase().includes(q) ||
                          (l.marineArea || '').toLowerCase().includes(q)
                      ).length
                    }
                    )
                  </div>
                  <div className="space-y-1.5">
                    {data.locations
                      .filter(
                        (l) =>
                          !q ||
                          l.name.toLowerCase().includes(q) ||
                          l.county.toLowerCase().includes(q) ||
                          (l.marineArea || '').toLowerCase().includes(q)
                      )
                      .slice(0, 3)
                      .map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            setActiveModule('Locations');
                            setShowSearchModal(false);
                          }}
                          className="w-full text-left p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-sky-500 text-slate-800 dark:text-slate-200 truncate"
                        >
                          {l.name} · {l.county}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Authenticated Scientist Password Reset Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Reset My KMFRI Account Password
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePasswordModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Signed in as <strong>{currentUser.fullName}</strong> (
              {currentUser.email}). Set a new password below for your future email &amp; password sign-ins.
            </p>
            {ownPasswordStatus && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  ownPasswordStatus.startsWith('SUCCESS')
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {ownPasswordStatus}
              </div>
            )}
            <form onSubmit={handleChangeOwnPassword} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  New Password (min. 6 characters) *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newOwnPassword}
                  onChange={(e) => setNewOwnPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmOwnPassword}
                  onChange={(e) => setConfirmOwnPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-semibold"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Quick-Access Scientist Chatbox Dock (Available Across All Modules) */}
      {activeModule !== 'Scientist Chatbox' && (
        <div className="fixed bottom-20 lg:bottom-5 right-3 sm:right-5 z-40 no-print">
          {floatingChatOpen ? (
            <div className="w-[calc(100vw-1.5rem)] sm:w-[680px] shadow-2xl rounded-2xl overflow-hidden border border-sky-500/40 bg-white dark:bg-slate-900">
              <div className="px-4 py-2 bg-[#082238] text-white flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live Scientist Chatbox &amp; Research Exchange</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFloatingChatOpen(false);
                      setActiveModule('Scientist Chatbox');
                    }}
                    className="text-sky-300 hover:text-white underline text-[11px]"
                  >
                    Expand Full View
                  </button>
                  <button
                    type="button"
                    onClick={() => setFloatingChatOpen(false)}
                    className="p-1 text-slate-300 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <ScientistChatHub
                data={data}
                apiFetch={apiFetch}
                onSelectProject={(proj) => setSelectedProject(proj)}
                onNavigateModule={(mod) => {
                  setFloatingChatOpen(false);
                  setActiveModule(mod as ModuleName);
                }}
                pendingShareAttachment={pendingChatShare}
                onClearPendingShare={() => setPendingChatShare(null)}
                compactMode={true}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFloatingChatOpen(true)}
              className="px-3.5 sm:px-4 py-2.5 rounded-2xl bg-sky-700 hover:bg-sky-800 text-white shadow-xl border border-sky-400/30 flex items-center gap-2 text-xs font-semibold cursor-pointer transition-transform hover:scale-105"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Scientist Live Chatbox</span>
              <span className="sm:hidden">Chat</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </button>
          )}
        </div>
      )}

      {/* MOBILE THUMB-ZONE BOTTOM NAVIGATION BAR (Phones & Tablets < lg) */}
      <nav
        aria-label="Mobile quick navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center h-16 px-1 no-print"
      >
        {(
          [
            {
              name: 'Dashboard' as ModuleName,
              label: 'Home',
              icon: LayoutDashboard,
            },
            {
              name: 'Projects' as ModuleName,
              label: 'Projects',
              icon: FolderKanban,
            },
            {
              name: 'Research Outputs' as ModuleName,
              label: 'Papers',
              icon: BookOpen,
            },
            {
              name: 'Scientist Chatbox' as ModuleName,
              label: 'Chatbox',
              icon: MessageSquare,
            },
            {
              name: 'AI Assistant' as ModuleName,
              label: 'AI Assist',
              icon: Sparkles,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeModule === tab.name;
          return (
            <button
              key={tab.name}
              type="button"
              onClick={() => setActiveModule(tab.name)}
              className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
                isActive
                  ? 'text-sky-700 dark:text-sky-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full px-1">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DashboardShell />
    </AuthProvider>
  );
}
