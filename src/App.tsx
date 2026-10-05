/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  BookOpen,
  Camera,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Sparkles,
  Users,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { TopBar } from './components/TopBar.tsx';
import { DashboardModule } from './components/DashboardModule.tsx';
import { ScientistsModule } from './components/ScientistsModule.tsx';
import { ProjectsModule } from './components/ProjectsModule.tsx';
import { FundingModule } from './components/FundingModule.tsx';
import { ReportsModule } from './components/ReportsModule.tsx';
import { LocationsModule } from './components/LocationsModule.tsx';
import { CollaboratorsModule } from './components/CollaboratorsModule.tsx';
import { OutputsModule } from './components/OutputsModule.tsx';
import { DocumentsModule } from './components/DocumentsModule.tsx';
import { NotificationsModule } from './components/NotificationsModule.tsx';
import { AdminModule } from './components/AdminModule.tsx';
import { BalancedScorecardModule } from './components/BalancedScorecardModule.tsx';
import { ChatModule, FloatingChatWidget } from './components/ChatModule.tsx';
import { AiAssistantModule } from './components/AiAssistantModule.tsx';
import { ProfileModule } from './components/ProfileModule.tsx';
import { UserAvatar } from './components/UserAvatar.tsx';

const MainShell: React.FC = () => {
  const {
    user,
    db,
    loading,
    activeModule,
    setActiveModule,
    setSelectedScientistId,
    toastMessage,
    greetingBanner,
    onlineUserIds,
  } = useAuth();

  if (loading || (user && !db)) {
    return (
      <div className="min-h-screen bg-[#0A2540] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-teal-400 border-t-transparent animate-spin mx-auto" />
          <div className="text-xs font-mono text-sky-200 tracking-wider uppercase">
            Initializing KMFRI Research Management System...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        <TopBar />

        <main className="flex-1 p-3 sm:p-6 overflow-y-auto max-w-[1600px] w-full mx-auto space-y-5">
          {/* Welcome Back / Good Morning-Afternoon-Evening Scientist Banner */}
          <div className="bg-gradient-to-r from-[#0A2540] via-sky-900 to-teal-900 text-white rounded-xl p-4 sm:p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <UserAvatar
                user={user}
                size="lg"
                isOnline={onlineUserIds.includes(user.id)}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-400/30">
                    KMFRI Scientist Portal
                  </span>
                  <span className="text-[11px] font-mono text-sky-200">
                    ● {onlineUserIds.length} Scientist{onlineUserIds.length === 1 ? '' : 's'} Online
                  </span>
                </div>
                <h2 className="text-base sm:text-xl font-bold tracking-tight mt-1 truncate">
                  {greetingBanner}!
                </h2>
                <p className="text-xs text-sky-200/90 mt-0.5 truncate">
                  {user.position} · {user.office_station} · Staff No: {user.staff_number}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveModule('profile')}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-teal-300" />
                <span>My Profile &amp; Security</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModule('outputs')}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5 text-sky-300" />
                <span>Write Publication</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModule('balanced_scorecard')}
                className="px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/40 text-amber-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <span>🏆 Scorecard</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModule('documents')}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <FolderKanban className="w-3.5 h-3.5 text-amber-300" />
                <span>Share Files &amp; Folders</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModule('chat')}
                className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Live Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModule('ai_assistant')}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Assistant</span>
              </button>
            </div>
          </div>

          {/* Active Module Content */}
          {activeModule === 'dashboard' && <DashboardModule />}
          {activeModule === 'scientists' && <ScientistsModule />}
          {activeModule === 'projects' && <ProjectsModule />}
          {activeModule === 'funding' && <FundingModule />}
          {activeModule === 'reports' && <ReportsModule />}
          {activeModule === 'locations' && <LocationsModule />}
          {activeModule === 'collaborators' && <CollaboratorsModule />}
          {activeModule === 'outputs' && <OutputsModule />}
          {activeModule === 'documents' && <DocumentsModule />}
          {activeModule === 'balanced_scorecard' && <BalancedScorecardModule />}
          {activeModule === 'notifications' && <NotificationsModule />}
          {activeModule === 'administration' && <AdminModule />}
          {activeModule === 'chat' && <ChatModule />}
          {activeModule === 'ai_assistant' && <AiAssistantModule />}
          {activeModule === 'profile' && <ProfileModule />}
        </main>
      </div>

      {/* Persistent Floating Chatbox Widget for Instant Scientist Collaboration */}
      <FloatingChatWidget />

      {/* Mobile Bottom Navigation Bar for Phones & Small Screens */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around">
        {(
          [
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'scientists', label: 'Scientists', icon: Users },
            { id: 'outputs', label: 'Publications', icon: BookOpen },
            { id: 'chat', label: 'Live Chat', icon: MessageSquare },
            { id: 'ai_assistant', label: 'AI Advisor', icon: Sparkles },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveModule(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                isActive
                  ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Non-blocking Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-16 lg:bottom-5 left-5 z-50 max-w-sm animate-in fade-in slide-in-from-bottom-4">
          <div
            className={`px-4 py-3 rounded-xl shadow-xl border text-xs font-medium flex items-center gap-2.5 ${
              toastMessage.type === 'error'
                ? 'bg-rose-950 text-rose-100 border-rose-700'
                : toastMessage.type === 'info'
                ? 'bg-slate-900 text-slate-100 border-slate-700'
                : 'bg-[#0A2540] text-teal-200 border-teal-500/40'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
