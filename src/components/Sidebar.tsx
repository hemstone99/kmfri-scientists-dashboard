import React from 'react';
import {
  Bell,
  BookOpen,
  Building2,
  ClipboardCheck,
  Coins,
  Compass,
  FileText,
  FolderKanban,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { NavigationModule } from '../types/kmfri.ts';
import { KmfriLogo } from './KmfriLogo.tsx';

interface NavItem {
  key: string;
  id: NavigationModule;
  label: string;
  icon: React.FC<{ className?: string }>;
  badge?: string;
  onSelect?: () => void;
  isSelected?: boolean;
}

export const Sidebar: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    dashboardMode,
    setDashboardMode,
    db,
    user,
    setSelectedProjectId,
    setSelectedScientistId,
    mobileNavOpen,
    setMobileNavOpen,
    onlineUserIds,
  } = useAuth();

  const unreadCount =
    db?.notifications.filter(
      (n) => (!n.recipient_user_id || n.recipient_user_id === user?.id) && !n.is_read
    ).length || 0;

  const chatCount = db?.chat_messages?.length || 0;

  const navItems: NavItem[] = [
    {
      key: 'inst_dashboard',
      id: 'dashboard',
      label: 'Institution Dashboard',
      icon: LayoutDashboard,
      isSelected: activeModule === 'dashboard' && dashboardMode === 'institution',
      onSelect: () => {
        setDashboardMode('institution');
        setActiveModule('dashboard');
      },
    },
    {
      key: 'ocs_dashboard',
      id: 'dashboard',
      label: 'Oceans & Coastal Hub',
      icon: Compass,
      badge: 'OCS',
      isSelected: activeModule === 'dashboard' && dashboardMode === 'ocs',
      onSelect: () => {
        setDashboardMode('ocs');
        setActiveModule('dashboard');
      },
    },
    {
      key: 'scientists',
      id: 'scientists',
      label: 'Scientists & Registry',
      icon: Users,
    },
    {
      key: 'profile',
      id: 'profile',
      label: 'My Profile & Security',
      icon: User,
      badge: 'Account',
    },
    {
      key: 'balanced_scorecard',
      id: 'balanced_scorecard',
      label: 'Balanced Scorecard (BSC)',
      icon: Trophy,
      badge: 'BSC',
    },
    {
      key: 'chat',
      id: 'chat',
      label: 'Live Scientist Chat',
      icon: MessageSquare,
      badge: `${onlineUserIds.length} online`,
    },
    {
      key: 'ai_assistant',
      id: 'ai_assistant',
      label: 'KMFRI AI Assistant',
      icon: Sparkles,
      badge: 'AI',
    },
    {
      key: 'projects',
      id: 'projects',
      label: 'Research Projects',
      icon: FolderKanban,
    },
    {
      key: 'outputs',
      id: 'outputs',
      label: 'Publications Studio',
      icon: BookOpen,
    },
    {
      key: 'documents',
      id: 'documents',
      label: 'SharePoint & Word Docs',
      icon: FileText,
      badge: 'Collab',
    },
    {
      key: 'funding',
      id: 'funding',
      label: 'Grants & Funding',
      icon: Coins,
    },
    {
      key: 'reports',
      id: 'reports',
      label: 'Reports & Reviews',
      icon: ClipboardCheck,
    },
    {
      key: 'locations',
      id: 'locations',
      label: 'GIS & Marine Sites',
      icon: MapPin,
      badge: 'WGS84',
    },
    {
      key: 'collaborators',
      id: 'collaborators',
      label: 'Collaborators & MOUs',
      icon: Building2,
    },
    {
      key: 'notifications',
      id: 'notifications',
      label: 'Notifications Center',
      icon: Bell,
      badge: unreadCount > 0 ? String(unreadCount) : undefined,
    },
    {
      key: 'administration',
      id: 'administration',
      label: 'Admin & Audit Logs',
      icon: ShieldAlert,
    },
  ];

  const handleNavigate = (item: NavItem) => {
    setSelectedProjectId(null);
    if (item.id !== 'scientists') {
      setSelectedScientistId(null);
    }
    if (item.onSelect) {
      item.onSelect();
    } else {
      setActiveModule(item.id);
    }
    setMobileNavOpen(false);
  };

  const sidebarContent = (
    <aside className="w-64 shrink-0 bg-[#0A2540] text-slate-200 flex flex-col border-r border-slate-800/80 select-none h-full">
      {/* Institutional Branding Header with Official KMFRI Logo */}
      <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between gap-2">
        <div className="bg-white/95 rounded-xl px-2.5 py-1.5 shadow-sm max-w-[200px]">
          <KmfriLogo variant="full" size="sm" subtitleClassName="text-[8px]" />
        </div>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
          aria-label="Close Sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Navigation */}
      <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1">
        <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Research &amp; Performance
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.isSelected !== undefined ? item.isSelected : activeModule === item.id;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleNavigate(item)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-sky-600/90 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-sky-400/80'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : item.badge === 'BSC'
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                      : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Quick My Researcher Profile Shortcut */}
      {user && (
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/50 space-y-2">
          <button
            type="button"
            onClick={() => {
              setSelectedScientistId(user.id);
              setActiveModule('scientists');
              setMobileNavOpen(false);
            }}
            className="w-full text-left px-3 py-2 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700/70 transition-colors"
          >
            <div className="text-[10px] uppercase tracking-wider text-teal-400 font-mono">
              My Researcher Hub
            </div>
            <div className="text-xs font-semibold text-white truncate mt-0.5">
              {user.title} {user.full_name}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {user.staff_number} · {user.role_code}
            </div>
          </button>
          <div className="px-1 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Live Chat</span>
            <span className="text-teal-400 font-bold">{chatCount} msgs</span>
          </div>
        </div>
      )}
    </aside>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <div className="hidden lg:block h-screen sticky top-0">{sidebarContent}</div>

      {/* Mobile & Tablet Slide-over Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
