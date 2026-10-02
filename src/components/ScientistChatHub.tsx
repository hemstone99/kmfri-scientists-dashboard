import React, { useState, useEffect, useRef } from 'react';
import {
  BootstrapData,
  ChatMessageRecord,
  OnlineScientistPresence,
  ProjectRecord,
  ResearchOutputRecord,
  DocumentRecord,
} from '../types.ts';
import {
  MessageSquare,
  Send,
  Hash,
  Users,
  Paperclip,
  BookOpen,
  FolderKanban,
  ExternalLink,
  X,
  Radio,
} from 'lucide-react';

interface ScientistChatHubProps {
  data: BootstrapData;
  apiFetch: <T = any>(path: string, options?: RequestInit) => Promise<T>;
  onSelectProject?: (proj: ProjectRecord) => void;
  onNavigateModule?: (moduleName: string) => void;
  pendingShareAttachment?: {
    type: 'file' | 'image' | 'publication' | 'project';
    name: string;
    url?: string;
    outputId?: string;
    projectId?: string;
  } | null;
  onClearPendingShare?: () => void;
  compactMode?: boolean;
}

const RESEARCH_CHANNELS = [
  {
    id: 'general-research',
    label: 'general-research',
    topic: 'Institution-Wide Scientific Discussion & Announcements',
  },
  {
    id: 'oceans-coastal-systems',
    label: 'oceans-coastal-systems',
    topic: 'Marine Ecology, Coral Reefs, Mangroves & RV Mtafiti EEZ Telemetry',
  },
  {
    id: 'freshwater-lakes',
    label: 'freshwater-lakes',
    topic: 'Lake Victoria, Lake Turkana, Naivasha & Catchment Limnology',
  },
  {
    id: 'publications-peer-review',
    label: 'publications-peer-review',
    topic: 'Co-Authoring Manuscripts, Datasets & WIOJMS Peer Review',
  },
];

export const ScientistChatHub: React.FC<ScientistChatHubProps> = ({
  data,
  apiFetch,
  onSelectProject,
  onNavigateModule,
  pendingShareAttachment,
  onClearPendingShare,
  compactMode = false,
}) => {
  const currentUser = data.currentUser;
  const [activeChannelId, setActiveChannelId] = useState<string>('general-research');
  const [directRecipientId, setDirectRecipientId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>(
    () => data.chatMessages || []
  );
  const [onlineUsers, setOnlineUsers] = useState<OnlineScientistPresence[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  const [messageInput, setMessageInput] = useState('');
  const [attachment, setAttachment] = useState<{
    type: 'file' | 'image' | 'publication' | 'project';
    name: string;
    url?: string;
    outputId?: string;
    projectId?: string;
  } | null>(null);
  const [showSharePicker, setShowSharePicker] = useState<
    null | 'PUBLICATION' | 'PROJECT' | 'FILE'
  >(null);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Sync incoming initial messages from bootstrap
  useEffect(() => {
    if (data.chatMessages) {
      setMessages((prev) => {
        const map = new Map<string, ChatMessageRecord>();
        prev.forEach((m) => map.set(m.id, m));
        data.chatMessages.forEach((m) => map.set(m.id, m));
        return Array.from(map.values()).sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt)
        );
      });
    }
  }, [data.chatMessages]);

  // Apply pending attachment shared from Publications Studio or Shared Drive
  useEffect(() => {
    if (pendingShareAttachment) {
      setAttachment(pendingShareAttachment);
      if (onClearPendingShare) onClearPendingShare();
    }
  }, [pendingShareAttachment, onClearPendingShare]);

  // Connect to Real-Time WebSocket Server (/ws/chat) with Auto-Reconnect
  useEffect(() => {
    let isMounted = true;
    let reconnectTimer: number | undefined;

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setWsConnected(true);
          ws.send(
            JSON.stringify({
              type: 'presence:join',
              payload: {
                userId: currentUser.id,
                fullName: currentUser.fullName,
                staffNumber: currentUser.staffNumber || 'KMFRI',
                roleName: currentUser.roleName || 'SCIENTIST/RESEARCHER',
                directorateCode: currentUser.directorateCode || 'OCS',
                profilePhoto: currentUser.profilePhoto || null,
              },
            })
          );
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'presence:update' && Array.isArray(parsed.payload)) {
              setOnlineUsers(parsed.payload);
            } else if (parsed.type === 'chat:message' && parsed.payload?.id) {
              const incoming: ChatMessageRecord = parsed.payload;
              // Idempotent message reconciliation per real-time guidelines
              setMessages((prev) => {
                if (prev.some((m) => m.id === incoming.id)) return prev;
                return [...prev, incoming];
              });
            }
          } catch {
            // ignore malformed frame
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setWsConnected(false);
          reconnectTimer = window.setTimeout(connectWebSocket, 3000);
        };
      } catch {
        reconnectTimer = window.setTimeout(connectWebSocket, 4000);
      }
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [
    currentUser.id,
    currentUser.fullName,
    currentUser.staffNumber,
    currentUser.roleName,
    currentUser.directorateCode,
    currentUser.profilePhoto,
  ]);

  const computeDmChannelId = (u1: string, u2: string) => {
    const sorted = [u1, u2].sort();
    return `dm:${sorted[0]}:${sorted[1]}`;
  };

  const effectiveChannelId = directRecipientId
    ? computeDmChannelId(currentUser.id, directRecipientId)
    : activeChannelId;

  const channelMessages = messages.filter(
    (m) => m.channelId === effectiveChannelId
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages.length, effectiveChannelId]);

  const handleFileAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImg = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachment({
          type: isImg ? 'image' : 'file',
          name: file.name,
          url: reader.result,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = messageInput.trim();
    if (!text && !attachment) return;

    const contentToSend =
      text ||
      (attachment
        ? `Shared ${attachment.type}: ${attachment.name}`
        : '');

    const payload = {
      channelId: effectiveChannelId,
      recipientId: directRecipientId || null,
      content: contentToSend,
      attachmentUrl: attachment?.url || null,
      attachmentName: attachment?.name || null,
      attachmentType: attachment?.type || null,
      linkedOutputId: attachment?.outputId || null,
      linkedProjectId: attachment?.projectId || null,
    };

    setMessageInput('');
    setAttachment(null);

    try {
      const saved = await apiFetch<ChatMessageRecord>('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMessages((prev) => {
        if (prev.some((m) => m.id === saved.id)) return prev;
        return [...prev, saved];
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const onlineUserIds = new Set(onlineUsers.map((u) => u.userId));
  // Ensure current user always shows as online
  onlineUserIds.add(currentUser.id);

  const activeChannelMeta = RESEARCH_CHANNELS.find(
    (c) => c.id === activeChannelId
  );
  const directRecipientUser = directRecipientId
    ? data.users.find((u) => u.id === directRecipientId)
    : null;

  const [mobileRosterOpen, setMobileRosterOpen] = useState(false);

  return (
    <div
      className={`border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-xs overflow-hidden flex flex-col ${
        compactMode
          ? 'h-[72vh] max-h-[520px] sm:h-[520px]'
          : 'min-h-[560px] md:h-[680px]'
      }`}
    >
      {/* Top Real-Time Online Telemetry Bar */}
      <div className="px-3.5 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                KMFRI Live Scientist Chatbox &amp; Research Exchange
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {onlineUserIds.size} Online {wsConnected ? '· LIVE' : ''}
                </span>
              </span>
            </div>
            <div className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Instant messaging, direct scientist-to-scientist chat, and live sharing of publications, projects, files &amp; marine imagery
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileRosterOpen((prev) => !prev)}
          className="md:hidden px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-sky-700 dark:text-sky-400 flex items-center gap-1.5"
        >
          <Users className="w-3.5 h-3.5" />
          <span>{mobileRosterOpen ? 'Hide Channels' : 'Channels & DMs'}</span>
        </button>
      </div>

      {/* Main Split Chat Layout */}
      <div className="flex-1 flex flex-col md:grid md:grid-cols-12 min-h-0">
        {/* Left 4-Column Channels & Online Scientists Directory */}
        <div
          className={`${
            mobileRosterOpen ? 'block max-h-64 border-b' : 'hidden'
          } md:block md:max-h-none md:col-span-4 lg:col-span-3 md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 p-3.5 overflow-y-auto space-y-5`}
        >
          {/* Thematic Research Channels */}
          <div>
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
              Research Channels
            </div>
            <div className="space-y-1">
              {RESEARCH_CHANNELS.map((ch) => {
                const isSelected =
                  !directRecipientId && activeChannelId === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setDirectRecipientId(null);
                      setActiveChannelId(ch.id);
                      setMobileRosterOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors ${
                      isSelected
                        ? 'bg-sky-700 text-white font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    <span className="truncate">{ch.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scientists Directory (Online & Offline Direct Messaging) */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Direct Message Scientists ({data.users.length})
              </span>
              <Users className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="space-y-1">
              {data.users.map((sci) => {
                const isOnline = onlineUserIds.has(sci.id);
                const isSelected = directRecipientId === sci.id;
                const dir = data.directorates.find(
                  (d) => d.id === sci.directorateId
                );
                const livePresence = onlineUsers.find(
                  (o) => o.userId === sci.id
                );
                const avatarUrl =
                  livePresence?.profilePhoto || sci.profilePhoto || null;
                const initials = sci.fullName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <button
                    key={sci.id}
                    type="button"
                    onClick={() => {
                      setDirectRecipientId(sci.id);
                      setMobileRosterOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-colors ${
                      isSelected
                        ? 'bg-teal-700 text-white font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={sci.fullName}
                            referrerPolicy="no-referrer"
                            className="w-7 h-7 rounded-full object-cover border border-sky-500/40"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-sky-800 text-white text-[10px] font-bold flex items-center justify-center">
                            {initials}
                          </div>
                        )}
                        <span
                          className={`w-2.5 h-2.5 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-white dark:border-slate-950 ${
                            isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                          title={isOnline ? 'Online Now' : 'Offline'}
                        />
                      </div>
                      <span className="truncate">
                        {sci.fullName}
                        {sci.id === currentUser.id ? ' (You)' : ''}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-mono shrink-0 ${
                        isSelected ? 'text-teal-100' : 'text-slate-400'
                      }`}
                    >
                      {dir?.code || 'OCS'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 8-Column Active Conversation Stream & Composer */}
        <div className="flex-1 md:col-span-8 lg:col-span-9 flex flex-col min-h-0 bg-white dark:bg-slate-900">
          {/* Active Room Subheader */}
          <div className="px-3.5 sm:px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            {directRecipientUser ? (
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    onlineUserIds.has(directRecipientUser.id)
                      ? 'bg-emerald-500'
                      : 'bg-slate-400'
                  }`}
                />
                <span className="font-bold text-slate-900 dark:text-white">
                  Direct Conversation with {directRecipientUser.fullName}
                </span>
                <span className="font-mono text-slate-400">
                  ({directRecipientUser.staffNumber || 'KMFRI'})
                </span>
              </div>
            ) : (
              <div>
                <span className="font-bold text-slate-900 dark:text-white">
                  #{activeChannelMeta?.label}
                </span>
                <span className="text-slate-400 mx-2">·</span>
                <span className="text-slate-500">{activeChannelMeta?.topic}</span>
              </div>
            )}

            {/* Quick Share Research Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setShowSharePicker(
                    showSharePicker === 'PUBLICATION' ? null : 'PUBLICATION'
                  )
                }
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium hover:border-sky-500 flex items-center gap-1"
              >
                <BookOpen className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                <span>Share Publication</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setShowSharePicker(
                    showSharePicker === 'PROJECT' ? null : 'PROJECT'
                  )
                }
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium hover:border-teal-500 flex items-center gap-1"
              >
                <FolderKanban className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                <span>Share Project</span>
              </button>
            </div>
          </div>

          {/* Optional Quick Picker Drawer for Sharing a Publication or Project */}
          {showSharePicker && (
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-sky-50/50 dark:bg-slate-950 max-h-40 overflow-y-auto space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>
                  Select a{' '}
                  {showSharePicker === 'PUBLICATION'
                    ? 'Publication / Manuscript'
                    : 'Research Project'}{' '}
                  to attach to your message:
                </span>
                <button
                  type="button"
                  onClick={() => setShowSharePicker(null)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {showSharePicker === 'PUBLICATION' ? (
                data.researchOutputs.length === 0 ? (
                  <div className="text-xs text-slate-500">
                    No publications registered yet.
                  </div>
                ) : (
                  data.researchOutputs.map((out) => (
                    <button
                      key={out.id}
                      type="button"
                      onClick={() => {
                        setAttachment({
                          type: 'publication',
                          name: out.title,
                          outputId: out.id,
                          url: out.fileUrl || undefined,
                        });
                        setShowSharePicker(null);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs hover:border-sky-500 flex items-center justify-between"
                    >
                      <span className="font-medium truncate">{out.title}</span>
                      <span className="font-mono text-[10px] text-sky-600">
                        {out.outputType}
                      </span>
                    </button>
                  ))
                )
              ) : data.projects.length === 0 ? (
                <div className="text-xs text-slate-500">
                  No projects registered yet.
                </div>
              ) : (
                data.projects.map((proj) => (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => {
                      setAttachment({
                        type: 'project',
                        name: `${proj.projectCode} — ${proj.title}`,
                        projectId: proj.id,
                      });
                      setShowSharePicker(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs hover:border-teal-500 flex items-center justify-between"
                  >
                    <span className="font-medium truncate">
                      {proj.projectCode} — {proj.title}
                    </span>
                    <span className="font-mono text-[10px] text-teal-600">
                      {proj.status}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Message Feed */}
          <div className="flex-1 p-5 overflow-y-auto space-y-3.5">
            {channelMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-500">
                <Radio className="w-8 h-8 text-sky-600 dark:text-sky-400" />
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  No messages in this channel yet
                </div>
                <p className="text-xs max-w-md">
                  Start the scientific discussion by posting a research observation, sharing a manuscript from the Publications Studio, or attaching field imagery below.
                </p>
              </div>
            ) : (
              channelMessages.map((msg) => {
                const sender = data.users.find((u) => u.id === msg.senderId);
                const liveSender = onlineUsers.find(
                  (o) => o.userId === msg.senderId
                );
                const senderAvatar =
                  liveSender?.profilePhoto || sender?.profilePhoto || null;
                const senderInitials = (
                  sender?.fullName ||
                  liveSender?.fullName ||
                  'KS'
                )
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                const isMe = msg.senderId === currentUser.id;
                const linkedProj = msg.linkedProjectId
                  ? data.projects.find((p) => p.id === msg.linkedProjectId)
                  : null;
                const linkedOut = msg.linkedOutputId
                  ? data.researchOutputs.find((o) => o.id === msg.linkedOutputId)
                  : null;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${
                      isMe ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {/* Sender Profile Picture Avatar in Chat */}
                    <div className="shrink-0 mt-1">
                      {senderAvatar ? (
                        <img
                          src={senderAvatar}
                          alt={sender?.fullName || 'Scientist'}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover border border-sky-500/40 shadow-2xs"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-sky-800 text-white text-xs font-bold flex items-center justify-center shadow-2xs">
                          {senderInitials}
                        </div>
                      )}
                    </div>

                    <div
                      className={`flex flex-col ${
                        isMe ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-1 px-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {sender?.fullName || 'KMFRI Scientist'}
                        </span>
                        <span className="font-mono">
                          {sender?.staffNumber || ''}
                        </span>
                        <span>·</span>
                        <span className="font-mono">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div
                        className={`max-w-xl rounded-2xl px-4 py-2.5 text-xs space-y-2 ${
                          isMe
                            ? 'bg-sky-700 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                      <p className="leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>

                      {/* Inline Image Attachment Preview */}
                      {msg.attachmentType === 'image' && msg.attachmentUrl && (
                        <div className="pt-1">
                          <img
                            src={msg.attachmentUrl}
                            alt={msg.attachmentName || 'Shared marine image'}
                            referrerPolicy="no-referrer"
                            className="max-h-52 rounded-xl border border-white/20 object-cover"
                          />
                          <a
                            href={msg.attachmentUrl}
                            download={msg.attachmentName || 'kmfri-image.jpg'}
                            className="inline-flex items-center gap-1 text-[11px] underline mt-1 opacity-90"
                          >
                            <span>Download {msg.attachmentName}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      {/* Inline File Attachment */}
                      {msg.attachmentType === 'file' && msg.attachmentUrl && (
                        <div className="p-2.5 rounded-xl bg-slate-950/20 border border-white/15 flex items-center justify-between gap-3">
                          <span className="font-mono truncate">
                            📎 {msg.attachmentName || 'Shared Research File'}
                          </span>
                          <a
                            href={msg.attachmentUrl}
                            download={msg.attachmentName || 'kmfri-file'}
                            className="underline font-semibold shrink-0"
                          >
                            Download →
                          </a>
                        </div>
                      )}

                      {/* Inline Linked Publication Card */}
                      {(msg.attachmentType === 'publication' || linkedOut) && (
                        <div className="p-2.5 rounded-xl bg-slate-950/20 border border-white/15 space-y-1">
                          <div className="text-[10px] font-mono uppercase opacity-80">
                            📄 Shared KMFRI Manuscript / Publication
                          </div>
                          <div className="font-bold">
                            {linkedOut?.title || msg.attachmentName}
                          </div>
                          {onNavigateModule && (
                            <button
                              type="button"
                              onClick={() => onNavigateModule('Research Outputs')}
                              className="underline text-[11px] font-semibold"
                            >
                              Open in Publications Studio →
                            </button>
                          )}
                        </div>
                      )}

                      {/* Inline Linked Project Card */}
                      {(msg.attachmentType === 'project' || linkedProj) && (
                        <div className="p-2.5 rounded-xl bg-slate-950/20 border border-white/15 space-y-1">
                          <div className="text-[10px] font-mono uppercase opacity-80">
                            🧭 Shared KMFRI Research Project
                          </div>
                          <div className="font-bold">
                            {linkedProj
                              ? `${linkedProj.projectCode} — ${linkedProj.title}`
                              : msg.attachmentName}
                          </div>
                          {linkedProj && onSelectProject && (
                            <button
                              type="button"
                              onClick={() => onSelectProject(linkedProj)}
                              className="underline text-[11px] font-semibold"
                            >
                              Inspect Project Workspace →
                            </button>
                          )}
                        </div>
                      )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Pending Attachment Preview Banner */}
          {attachment && (
            <div className="px-4 py-2 bg-sky-50 dark:bg-sky-950/60 border-t border-sky-200 dark:border-sky-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="font-mono font-semibold text-sky-700 dark:text-sky-400 uppercase">
                  [{attachment.type}]
                </span>
                <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                  {attachment.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="text-slate-400 hover:text-rose-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Bottom Message Input Composer */}
          <form
            onSubmit={handleSendMessage}
            className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center gap-2.5"
          >
            <label
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-sky-500 cursor-pointer shrink-0"
              title="Attach File or Image from Device"
            >
              <Paperclip className="w-4 h-4" />
              <input
                type="file"
                onChange={handleFileAttachmentSelect}
                className="hidden"
              />
            </label>

            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={
                directRecipientUser
                  ? `Message ${directRecipientUser.fullName}...`
                  : `Share research ideas, station updates, or manuscripts in #${activeChannelMeta?.label}...`
              }
              className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-sky-600"
            />

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
