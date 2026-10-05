import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  ChatAttachment,
  ChatMessage,
  DatabaseSnapshot,
  NavigationModule,
  PermissionCode,
  RoleCode,
  UserProfile,
} from '../types/kmfri.ts';

export function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

interface AuthContextValue {
  user: UserProfile | null;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  token: string | null;
  db: DatabaseSnapshot | null;
  loading: boolean;
  activeModule: NavigationModule;
  setActiveModule: (mod: NavigationModule) => void;
  selectedScientistId: string | null;
  setSelectedScientistId: (id: string | null) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  dashboardMode: 'institution' | 'ocs' | 'scientist';
  setDashboardMode: (mode: 'institution' | 'ocs' | 'scientist') => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  floatingChatOpen: boolean;
  setFloatingChatOpen: (open: boolean) => void;
  activeChatChannel: string;
  setActiveChatChannel: (channel: string) => void;
  onlineUserIds: string[];
  greetingBanner: string;
  loginWithEmail: (email: string, password: string) => Promise<{ user: UserProfile }>;
  quickRoleAccess: (roleCode: RoleCode) => Promise<{ user: UserProfile }>;
  logout: () => Promise<void>;
  refreshData: () => Promise<void>;
  apiFetch: <T = any>(path: string, options?: RequestInit) => Promise<T>;
  hasPermission: (perm: PermissionCode) => boolean;
  shareToLiveChat: (
    attachment: ChatAttachment,
    customMessage?: string,
    channelId?: string
  ) => Promise<void>;
  toastMessage: { type: 'success' | 'error' | 'info'; text: string } | null;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('kmfri_session_token');
    } catch {
      return null;
    }
  });
  const [db, setDb] = useState<DatabaseSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeModule, setActiveModuleState] = useState<NavigationModule>('dashboard');
  const [selectedScientistId, setSelectedScientistId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [dashboardMode, setDashboardMode] = useState<'institution' | 'ocs' | 'scientist'>('institution');
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [floatingChatOpen, setFloatingChatOpen] = useState<boolean>(false);
  const [activeChatChannel, setActiveChatChannel] = useState<string>('general-research');
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const setActiveModule = useCallback((mod: NavigationModule) => {
    setActiveModuleState(mod);
    setMobileNavOpen(false);
  }, []);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const applyRoleAwareRedirect = useCallback((loggedInUser: UserProfile) => {
    if (loggedInUser.role_code === RoleCode.HEAD_OCS) {
      setActiveModuleState('dashboard');
      setDashboardMode('ocs');
    } else if (loggedInUser.role_code === RoleCode.SCIENTIST) {
      setActiveModuleState('dashboard');
      setDashboardMode('scientist');
      if (loggedInUser.is_operational_scientist) {
        setSelectedScientistId(loggedInUser.id);
      }
    } else {
      setActiveModuleState('dashboard');
      setDashboardMode('institution');
    }
  }, []);

  const apiFetch = useCallback(
    async <T = any>(path: string, options: RequestInit = {}): Promise<T> => {
      const headers = new Headers(options.headers || {});
      headers.set('Content-Type', 'application/json');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const res = await fetch(`/api${path}`, {
        ...options,
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }
      return data as T;
    },
    [token]
  );

  const refreshData = useCallback(async () => {
    if (!token) return;
    try {
      const snapshot = await apiFetch<DatabaseSnapshot>('/snapshot');
      setDb(snapshot);
      setUser((prevUser) => {
        if (!prevUser) return null;
        const updatedMe = snapshot.users.find((u) => u.id === prevUser.id);
        return updatedMe || prevUser;
      });
    } catch (err) {
      console.error('Failed to refresh database snapshot:', err);
    }
  }, [token, apiFetch]);

  // Real-time WebSocket Connection for Live Chat & Presence
  useEffect(() => {
    if (!user || !token) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connectWs() {
      if (cancelled || !user) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'auth:identify',
            userId: user.id,
            userName: `${user.title} ${user.full_name}`,
          })
        );
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.event === 'presence:update' && Array.isArray(msg.payload?.onlineUserIds)) {
            setOnlineUserIds(msg.payload.onlineUserIds);
          } else if (msg.event === 'chat:message_created' && msg.payload) {
            const incoming = msg.payload as ChatMessage;
            setDb((prevDb) => {
              if (!prevDb) return prevDb;
              // Idempotent check per real-time skill rules
              if (prevDb.chat_messages.some((m) => m.id === incoming.id)) {
                return prevDb;
              }
              return {
                ...prevDb,
                chat_messages: [...prevDb.chat_messages, incoming],
              };
            });
          } else if (msg.event === 'chat:message_deleted' && msg.payload?.id) {
            const deletedId = String(msg.payload.id);
            setDb((prevDb) => {
              if (!prevDb) return prevDb;
              return {
                ...prevDb,
                chat_messages: prevDb.chat_messages.filter((m) => m.id !== deletedId),
              };
            });
          } else if (msg.event === 'db:updated') {
            refreshData();
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!cancelled) {
          reconnectTimer = setTimeout(connectWs, 3000);
        }
      };
    }

    connectWs();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user?.id, token, refreshData]);

  useEffect(() => {
    let mounted = true;
    async function verifyInitialSession() {
      if (!token) {
        if (mounted) setLoading(false);
        return;
      }
      try {
        const sessionRes = await apiFetch<{ user: UserProfile }>('/auth/session');
        const snapshot = await apiFetch<DatabaseSnapshot>('/snapshot');
        if (mounted) {
          setUser(sessionRes.user);
          setDb(snapshot);
        }
      } catch {
        if (mounted) {
          setToken(null);
          setUser(null);
          setDb(null);
          try {
            sessionStorage.removeItem('kmfri_session_token');
          } catch {
            // ignore
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    verifyInitialSession();
    return () => {
      mounted = false;
    };
  }, [token, apiFetch]);

  const loginWithEmail = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Authentication failed');
    }
    setToken(data.token);
    try {
      sessionStorage.setItem('kmfri_session_token', data.token);
    } catch {
      // ignore
    }
    const snapRes = await fetch('/api/snapshot', {
      headers: { Authorization: `Bearer ${data.token}` },
    });
    if (snapRes.ok) {
      const snap = await snapRes.json();
      setDb(snap);
    }
    setUser(data.user);
    applyRoleAwareRedirect(data.user);
    const greet = getTimeOfDayGreeting();
    showToast(
      `${greet}, ${data.user.title} ${data.user.full_name} — Welcome back to KMFRI!`,
      'info'
    );
    return { user: data.user };
  };

  const quickRoleAccess = async (roleCode: RoleCode) => {
    const res = await fetch('/api/auth/quick-role-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_code: roleCode }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Role session switch failed');
    }
    setToken(data.token);
    try {
      sessionStorage.setItem('kmfri_session_token', data.token);
    } catch {
      // ignore
    }
    const snapRes = await fetch('/api/snapshot', {
      headers: { Authorization: `Bearer ${data.token}` },
    });
    if (snapRes.ok) {
      const snap = await snapRes.json();
      setDb(snap);
    }
    setUser(data.user);
    applyRoleAwareRedirect(data.user);
    const greet = getTimeOfDayGreeting();
    showToast(
      `${greet}, ${data.user.title} ${data.user.full_name} — Welcome back (${data.user.role_code})!`,
      'info'
    );
    return { user: data.user };
  };

  const logout = async () => {
    try {
      if (token) {
        await apiFetch('/auth/logout', { method: 'POST' });
      }
    } catch {
      // ignore
    }
    setToken(null);
    setUser(null);
    setDb(null);
    try {
      sessionStorage.removeItem('kmfri_session_token');
    } catch {
      // ignore
    }
  };

  const hasPermission = useCallback(
    (perm: PermissionCode): boolean => {
      if (!user || !db) return false;
      if (user.role_code === RoleCode.SUPER_ADMIN) return true;
      const permObj = db.permissions.find((p) => p.code === perm);
      if (!permObj) return false;
      return db.role_permissions.some(
        (rp) => rp.role_id === user.role_id && rp.permission_id === permObj.id
      );
    },
    [user, db]
  );

  const shareToLiveChat = useCallback(
    async (
      attachment: ChatAttachment,
      customMessage?: string,
      channelId = 'general-research'
    ) => {
      try {
        await apiFetch('/chat/messages', {
          method: 'POST',
          body: JSON.stringify({
            channel_id: channelId,
            content:
              customMessage ||
              `Shared ${attachment.type}: "${attachment.title}" with the research team.`,
            attachments: [attachment],
          }),
        });
        await refreshData();
        setActiveChatChannel(channelId);
        showToast(`Shared "${attachment.title}" to Live Scientist Chat!`);
      } catch (err: any) {
        showToast(err.message || 'Failed to share to chat', 'error');
      }
    },
    [apiFetch, refreshData, showToast]
  );

  const greetingBanner = user
    ? `${getTimeOfDayGreeting()}, ${user.title} ${user.full_name} — Welcome back`
    : 'Welcome to KMFRI';

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        token,
        db,
        loading,
        activeModule,
        setActiveModule,
        selectedScientistId,
        setSelectedScientistId,
        selectedProjectId,
        setSelectedProjectId,
        dashboardMode,
        setDashboardMode,
        mobileNavOpen,
        setMobileNavOpen,
        floatingChatOpen,
        setFloatingChatOpen,
        activeChatChannel,
        setActiveChatChannel,
        onlineUserIds,
        greetingBanner,
        loginWithEmail,
        quickRoleAccess,
        logout,
        refreshData,
        apiFetch,
        hasPermission,
        shareToLiveChat,
        toastMessage,
        showToast,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
