import React, { useState, useMemo, useRef } from 'react';
import {
  Bell,
  BookOpen,
  Camera,
  ChevronDown,
  FileText,
  Folder,
  FolderKanban,
  KeyRound,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Moon,
  Search,
  Sparkles,
  Sun,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { RoleCode } from '../types/kmfri.ts';
import { UserAvatar } from './UserAvatar.tsx';
import { KmfriLogo } from './KmfriLogo.tsx';

export const TopBar: React.FC = () => {
  const {
    user,
    db,
    logout,
    quickRoleAccess,
    setActiveModule,
    setSelectedProjectId,
    setSelectedScientistId,
    refreshData,
    apiFetch,
    showToast,
    greetingBanner,
    onlineUserIds,
    setMobileNavOpen,
    floatingChatOpen,
    setFloatingChatOpen,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const darkMode = theme === 'dark';

  const [globalSearch, setGlobalSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchCategory, setSearchCategory] = useState<
    'all' | 'projects' | 'scientists' | 'outputs' | 'files' | 'locations' | 'chat'
  >('all');
  const [notifOpen, setNotifOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  const unreadNotifications = useMemo(() => {
    if (!db || !user) return [];
    return db.notifications.filter(
      (n) => (!n.recipient_user_id || n.recipient_user_id === user.id) && !n.is_read
    );
  }, [db, user]);

  const allNotifications = useMemo(() => {
    if (!db || !user) return [];
    return db.notifications
      .filter((n) => !n.recipient_user_id || n.recipient_user_id === user.id)
      .slice(0, 15);
  }, [db, user]);

  const searchResults = useMemo(() => {
    if (!db) {
      return {
        projects: [],
        scientists: [],
        outputs: [],
        folders: [],
        documents: [],
        locations: [],
        chats: [],
      };
    }
    const q = globalSearch.trim().toLowerCase();

    const projects = db.projects
      .filter((p) =>
        !q
          ? true
          : p.title.toLowerCase().includes(q) ||
            p.project_code.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q)
      )
      .slice(0, 5);

    const scientists = db.users
      .filter((u) =>
        !q
          ? true
          : u.full_name.toLowerCase().includes(q) ||
            u.staff_number.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            u.position.toLowerCase().includes(q)
      )
      .slice(0, 5);

    const outputs = db.research_outputs
      .filter((o) =>
        !q
          ? true
          : o.title.toLowerCase().includes(q) ||
            o.journal_or_event.toLowerCase().includes(q) ||
            o.keywords.some((k) => k.toLowerCase().includes(q))
      )
      .slice(0, 5);

    const folders = (db.shared_folders || [])
      .filter((f) =>
        !q
          ? true
          : f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
      )
      .slice(0, 4);

    const documents = db.documents
      .filter((d) =>
        !q
          ? true
          : d.title.toLowerCase().includes(q) ||
            d.file_name.toLowerCase().includes(q) ||
            d.category.toLowerCase().includes(q)
      )
      .slice(0, 5);

    const locations = db.locations
      .filter((l) =>
        !q
          ? true
          : l.site_name.toLowerCase().includes(q) ||
            l.county.toLowerCase().includes(q) ||
            l.marine_coastal_area.toLowerCase().includes(q)
      )
      .slice(0, 4);

    const chats = (db.chat_messages || [])
      .filter((m) =>
        !q
          ? false
          : m.content.toLowerCase().includes(q) || m.sender_name.toLowerCase().includes(q)
      )
      .slice(-4)
      .reverse();

    return { projects, scientists, outputs, folders, documents, locations, chats };
  }, [db, globalSearch]);

  const handleActivateSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchOpen(true);
    setNotifOpen(false);
    setRoleMenuOpen(false);
    setProfileMenuOpen(false);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 30);
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'POST' });
      await refreshData();
      showToast('All notifications marked as read', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleQuickAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await apiFetch(`/users/${user.id}/avatar`, {
          method: 'POST',
          body: JSON.stringify({ avatar_url: String(reader.result || '') }),
        });
        await refreshData();
        showToast('Your profile photo has been updated across the platform and live chat!');
      } catch (err: any) {
        showToast(err.message || 'Failed to upload photo', 'error');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleQuickPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.trim().length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword.trim() }),
      });
      showToast('Password updated successfully!');
      setPasswordModalOpen(false);
      setNewPassword('');
      setConfirmPassword('');
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Password reset failed', 'error');
    }
  };

  const totalMatches =
    searchResults.projects.length +
    searchResults.scientists.length +
    searchResults.outputs.length +
    searchResults.folders.length +
    searchResults.documents.length +
    searchResults.locations.length +
    searchResults.chats.length;

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      {/* Main TopBar Row */}
      <div className="min-h-16 px-3 sm:px-6 py-2 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Mobile Menu Button + Greeting + Search */}
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          {/* Mobile Hamburger Menu Button */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Personalized Greeting Banner (Desktop & Tablet) */}
          {user && (
            <div className="hidden xl:flex flex-col shrink-0 border-r border-slate-200 dark:border-slate-800 pr-4">
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{greetingBanner}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {user.staff_number} · {onlineUserIds.length} scientist
                {onlineUserIds.length === 1 ? '' : 's'} online
              </div>
            </div>
          )}

          {/* Functional Global Search Bar + Search Button */}
          <div className="relative flex-1 max-w-xl">
            <form onSubmit={handleActivateSearch} className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={globalSearch}
                  onFocus={() => setSearchOpen(true)}
                  onChange={(e) => {
                    setGlobalSearch(e.target.value);
                    setSearchOpen(true);
                  }}
                  placeholder="Search projects, scientists, publications, folders, files, GIS..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                {globalSearch && (
                  <button
                    type="button"
                    onClick={() => setGlobalSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                onClick={() => handleActivateSearch()}
                className="px-3 py-2 rounded-lg bg-[#0A2540] hover:bg-sky-900 dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-xs transition-colors"
                title="Search across KMFRI system"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Search</span>
              </button>
            </form>

            {/* Interactive Global Search Results Dropdown */}
            {searchOpen && (
              <div className="fixed sm:absolute left-2 right-2 sm:left-0 sm:right-0 top-16 sm:top-full sm:mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[80vh] flex flex-col">
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'projects', label: 'Projects' },
                        { id: 'scientists', label: 'Scientists' },
                        { id: 'outputs', label: 'Publications' },
                        { id: 'files', label: 'Files & Folders' },
                        { id: 'locations', label: 'GIS Sites' },
                        { id: 'chat', label: 'Chat' },
                      ] as const
                    ).map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSearchCategory(cat.id)}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                          searchCategory === cat.id
                            ? 'bg-sky-600 text-white'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSearchOpen(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 overflow-y-auto space-y-4 text-xs">
                  {totalMatches === 0 ? (
                    <div className="py-8 text-center text-slate-500">
                      No matching KMFRI records found for "{globalSearch}". Try another keyword or
                      ask the KMFRI AI Assistant.
                    </div>
                  ) : (
                    <>
                      {/* Projects */}
                      {(searchCategory === 'all' || searchCategory === 'projects') &&
                        searchResults.projects.length > 0 && (
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1 flex items-center gap-1.5">
                              <FolderKanban className="w-3 h-3 text-sky-500" />
                              <span>Research Projects ({searchResults.projects.length})</span>
                            </div>
                            {searchResults.projects.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setSelectedProjectId(p.id);
                                  setActiveModule('projects');
                                  setSearchOpen(false);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
                              >
                                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                  {p.title}
                                </span>
                                <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400 shrink-0">
                                  {p.project_code} · {p.status}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                      {/* Scientists */}
                      {(searchCategory === 'all' || searchCategory === 'scientists') &&
                        searchResults.scientists.length > 0 && (
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1 flex items-center gap-1.5">
                              <Users className="w-3 h-3 text-teal-500" />
                              <span>Scientists &amp; Personnel ({searchResults.scientists.length})</span>
                            </div>
                            {searchResults.scientists.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setSelectedScientistId(s.id);
                                  setActiveModule('scientists');
                                  setSearchOpen(false);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <UserAvatar
                                    user={s}
                                    size="xs"
                                    showOnline={true}
                                    isOnline={onlineUserIds.includes(s.id)}
                                  />
                                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                    {s.title} {s.full_name}
                                  </span>
                                </div>
                                <span className="font-mono text-[10px] text-teal-600 dark:text-teal-400 shrink-0">
                                  {s.staff_number}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                      {/* Publications & Outputs */}
                      {(searchCategory === 'all' || searchCategory === 'outputs') &&
                        searchResults.outputs.length > 0 && (
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1 flex items-center gap-1.5">
                              <BookOpen className="w-3 h-3 text-indigo-500" />
                              <span>Publications &amp; Outputs ({searchResults.outputs.length})</span>
                            </div>
                            {searchResults.outputs.map((o) => (
                              <button
                                key={o.id}
                                type="button"
                                onClick={() => {
                                  setActiveModule('outputs');
                                  setSearchOpen(false);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
                              >
                                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                  {o.title}
                                </span>
                                <span className="font-mono text-[10px] text-slate-500 shrink-0">
                                  {o.output_type}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                      {/* Shared Folders & Documents */}
                      {(searchCategory === 'all' || searchCategory === 'files') &&
                        (searchResults.folders.length > 0 || searchResults.documents.length > 0) && (
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1 flex items-center gap-1.5">
                              <Folder className="w-3 h-3 text-amber-500" />
                              <span>
                                Shared Folders &amp; Files (
                                {searchResults.folders.length + searchResults.documents.length})
                              </span>
                            </div>
                            {searchResults.folders.map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => {
                                  setActiveModule('documents');
                                  setSearchOpen(false);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
                              >
                                <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
                                  <Folder className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                  <span>{f.name}</span>
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">Folder</span>
                              </button>
                            ))}
                            {searchResults.documents.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => {
                                  setActiveModule('documents');
                                  setSearchOpen(false);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
                              >
                                <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
                                  <FileText className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                                  <span>{d.title}</span>
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {d.category}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                      {/* GIS Locations */}
                      {(searchCategory === 'all' || searchCategory === 'locations') &&
                        searchResults.locations.length > 0 && (
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1 flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 text-emerald-500" />
                              <span>Marine &amp; Inland GIS Sites ({searchResults.locations.length})</span>
                            </div>
                            {searchResults.locations.map((l) => (
                              <button
                                key={l.id}
                                type="button"
                                onClick={() => {
                                  setActiveModule('locations');
                                  setSearchOpen(false);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
                              >
                                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                  {l.site_name} ({l.county})
                                </span>
                                <span className="text-[10px] font-mono text-emerald-600 shrink-0">
                                  {l.marine_coastal_area}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                      {/* Live Chat Messages */}
                      {(searchCategory === 'all' || searchCategory === 'chat') &&
                        searchResults.chats.length > 0 && (
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1 flex items-center gap-1.5">
                              <MessageSquare className="w-3 h-3 text-sky-500" />
                              <span>Live Chat Discussions ({searchResults.chats.length})</span>
                            </div>
                            {searchResults.chats.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setActiveModule('chat');
                                  setSearchOpen(false);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
                              >
                                <span className="text-slate-800 dark:text-slate-200 truncate">
                                  <strong className="font-semibold">{m.sender_name}:</strong>{' '}
                                  {m.content}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                  #{m.channel_id}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick BSC, AI, Chat, Role Switcher, Notifications, Theme, User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Balanced Scorecard Shortcut Button */}
          <button
            type="button"
            onClick={() => setActiveModule('balanced_scorecard')}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            title="Open KMFRI Scientific Balanced Scorecard (BSC)"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden xl:inline">Balanced Scorecard</span>
          </button>

          {/* AI Assistant Shortcut Button */}
          <button
            type="button"
            onClick={() => setActiveModule('ai_assistant')}
            className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-500 hover:to-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            title="Open KMFRI Scientific AI Assistant"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden md:inline">AI Assistant</span>
          </button>

          {/* Live Chat Shortcut Button */}
          <button
            type="button"
            onClick={() => setFloatingChatOpen(!floatingChatOpen)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 relative"
            title="Toggle Live Scientist Chatbox"
          >
            <MessageSquare className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
          </button>

          {/* Quick Role Verification Switcher */}
          <div className="relative hidden md:block">
            <button
              type="button"
              onClick={() => {
                setRoleMenuOpen(!roleMenuOpen);
                setNotifOpen(false);
                setProfileMenuOpen(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30 hover:bg-teal-500/20 transition-colors"
              title="Switch RBAC Role to test role-aware dashboards & permissions"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">RBAC:</span>
              <span className="font-semibold">{user?.role_code}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {roleMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 z-50">
                <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  Switch Active Session Role (RBAC Enforced)
                </div>
                <div className="mt-1 space-y-0.5">
                  {Object.values(RoleCode).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        quickRoleAccess(role);
                        setRoleMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-mono flex items-center justify-between ${
                        user?.role_code === role
                          ? 'bg-sky-600 text-white font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{role}</span>
                      {user?.role_code === role && <span className="text-[10px]">ACTIVE</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dark / Light Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifOpen(!notifOpen);
                setRoleMenuOpen(false);
                setProfileMenuOpen(false);
              }}
              className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                  {unreadNotifications.length}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-full sm:mt-2 w-[calc(100vw-1rem)] sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    System &amp; Research Notifications
                  </span>
                  <div className="flex items-center gap-2">
                    {unreadNotifications.length > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModule('notifications');
                        setNotifOpen(false);
                      }}
                      className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      View all
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {allNotifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No notifications at this time.
                    </div>
                  ) : (
                    allNotifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 text-xs ${
                          !n.is_read ? 'bg-sky-50/60 dark:bg-sky-950/30' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {n.title}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(n.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mt-0.5">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile & Avatar Menu */}
          <div className="relative pl-1.5 sm:pl-3 border-l border-slate-200 dark:border-slate-800">
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleQuickAvatarUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(!profileMenuOpen);
                setNotifOpen(false);
                setRoleMenuOpen(false);
              }}
              className="flex items-center gap-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded-lg transition-colors"
            >
              <UserAvatar
                user={user}
                size="sm"
                showOnline={true}
                isOnline={user ? onlineUserIds.includes(user.id) : true}
              />
              <div className="hidden md:block">
                <div className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                  {user?.title} {user?.full_name}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {user?.staff_number}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </button>

            {profileMenuOpen && user && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-xs">
                <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                  <UserAvatar user={user} size="md" showOnline={true} isOnline={true} />
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      {user.title} {user.full_name}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                  </div>
                </div>

                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule('profile');
                      setProfileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium"
                  >
                    <Users className="w-3.5 h-3.5 text-sky-600" />
                    <span>My Scientist Profile &amp; Security</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      avatarFileInputRef.current?.click();
                      setProfileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium"
                  >
                    <Camera className="w-3.5 h-3.5 text-teal-600" />
                    <span>Update Profile Picture</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPasswordModalOpen(true);
                      setProfileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                    <span>Reset / Change Password</span>
                  </button>
                </div>

                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 text-rose-600 font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile / Compact Welcome Back Greeting Strip */}
      {user && (
        <div className="xl:hidden px-3 sm:px-6 py-1.5 bg-slate-50/90 dark:bg-slate-950/70 border-t border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-2 text-[11px]">
          <div className="font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">{greetingBanner}</span>
          </div>
          <div className="font-mono text-[10px] text-teal-600 dark:text-teal-400 shrink-0">
            {onlineUserIds.length} online
          </div>
        </div>
      )}

      {/* Quick Self-Service Password Reset Modal from TopBar */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-500" />
                <span>Reset Your Account Password</span>
              </h3>
              <button type="button" onClick={() => setPasswordModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleQuickPasswordChange} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
