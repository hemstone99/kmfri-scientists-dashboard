import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Download,
  ExternalLink,
  FileText,
  Folder,
  Hash,
  Image as ImageIcon,
  Maximize2,
  MessageSquare,
  Minimize2,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { ChatAttachment, ChatMessage, UserProfile } from '../types/kmfri.ts';
import { UserAvatar } from './UserAvatar.tsx';

export const RESEARCH_CHANNELS = [
  {
    id: 'general-research',
    name: 'general-research',
    label: 'General Marine & Fisheries Lounge',
    description: 'Institution-wide scientific discussion, cruise updates, and announcements',
  },
  {
    id: 'oceans-coastal',
    name: 'oceans-coastal',
    label: 'Oceans & Coastal Systems (OCS)',
    description: 'Coral reefs, blue carbon mangroves, seagrass, and EEZ oceanography',
  },
  {
    id: 'freshwater-limnology',
    name: 'freshwater-limnology',
    label: 'Freshwater Systems & Lakes',
    description: 'Lake Victoria, Lake Turkana, Baringo, Naivasha, and riverine basins',
  },
  {
    id: 'aquaculture-mariculture',
    name: 'aquaculture-mariculture',
    label: 'Aquaculture & Mariculture R&D',
    description: 'Sagana hatchery, seaweed farming, cage culture, and aquatic health',
  },
  {
    id: 'publications-ideas',
    name: 'publications-ideas',
    label: 'Publications & Research Ideas',
    description: 'Co-authoring manuscripts, peer review feedback, and grant concepts',
  },
];

export function getDmChannelId(uidA: string, uidB: string): string {
  const sorted = [uidA, uidB].sort();
  return `dm:${sorted[0]}:${sorted[1]}`;
}

export function ChatModule() {
  const {
    db,
    user,
    activeChatChannel,
    setActiveChatChannel,
    onlineUserIds,
    apiFetch,
    refreshData,
    setActiveModule,
    setSelectedScientistId,
    showToast,
  } = useAuth();

  const [messageText, setMessageText] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [sharePickerMode, setSharePickerMode] = useState<'folder' | 'publication' | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);
  const [mobileRosterOpen, setMobileRosterOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const channelMessages = useMemo(() => {
    if (!db) return [];
    return db.chat_messages.filter((m) => m.channel_id === activeChatChannel);
  }, [db, activeChatChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages.length, activeChatChannel]);

  if (!db || !user) return null;

  const allParticipants = db.users.filter((u) => u.id !== user.id);

  // Resolve current channel title & subtitle
  const activeChannelMeta = useMemo(() => {
    const std = RESEARCH_CHANNELS.find((c) => c.id === activeChatChannel);
    if (std) {
      return {
        isDm: false,
        title: `#${std.name}`,
        subtitle: std.description,
        dmPartner: null as UserProfile | null,
      };
    }
    if (activeChatChannel.startsWith('dm:')) {
      const parts = activeChatChannel.split(':');
      const partnerId = parts.find((p) => p !== 'dm' && p !== user.id);
      const partner = db.users.find((u) => u.id === partnerId) || null;
      return {
        isDm: true,
        title: partner ? `${partner.title} ${partner.full_name}` : 'Direct Scientist Chat',
        subtitle: partner
          ? `${partner.position} · ${partner.office_station} (${partner.staff_number})`
          : '1-on-1 Direct Research Conversation',
        dmPartner: partner,
      };
    }
    return {
      isDm: false,
      title: `#${activeChatChannel}`,
      subtitle: 'KMFRI Live Research Collaboration Stream',
      dmPartner: null,
    };
  }, [activeChatChannel, db.users, user.id]);

  const handleFileUploadSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (file.size > 15 * 1024 * 1024) {
        showToast(`"${file.name}" exceeds 15 MB chat attachment limit.`, 'error');
        continue;
      }

      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        const isImg = file.type.startsWith('image/');
        const att: ChatAttachment = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: isImg ? 'image' : 'file',
          title: file.name.replace(/\.[^/.]+$/, ''),
          file_name: file.name,
          mime_type: file.type || 'application/octet-stream',
          data_url: dataUrl,
          size_bytes: file.size,
        };
        setPendingAttachments((prev) => [...prev, att]);
      } catch {
        showToast('Could not attach selected file.', 'error');
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!messageText.trim() && pendingAttachments.length === 0) || sending) return;

    setSending(true);
    try {
      // Also persist any newly uploaded file/image into the Documents repository for institutional sharing
      for (const att of pendingAttachments) {
        if ((att.type === 'image' || att.type === 'file') && att.data_url) {
          await apiFetch('/documents', {
            method: 'POST',
            body: JSON.stringify({
              title: att.title,
              file_name: att.file_name || `${att.title}.dat`,
              mime_type: att.mime_type || 'application/octet-stream',
              file_size_bytes: att.size_bytes || 0,
              data_url: att.data_url,
              category: att.type === 'image' ? 'Shared Image' : 'Dataset File',
              metadata: { shared_in_channel: activeChatChannel },
            }),
          }).catch(() => {});
        }
      }

      await apiFetch<ChatMessage>('/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          channel_id: activeChatChannel,
          content: messageText.trim(),
          attachments: pendingAttachments,
        }),
      });

      setMessageText('');
      setPendingAttachments([]);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      await apiFetch(`/chat/messages/${msgId}`, { method: 'DELETE' });
      await refreshData();
      showToast('Message removed');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDownloadAttachment = (att: ChatAttachment) => {
    if (att.data_url) {
      const a = document.createElement('a');
      a.href = att.data_url;
      a.download = att.file_name || `${att.title}.dat`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      showToast('Attachment metadata opened', 'info');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-sky-600" />
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              Live Scientist Collaboration &amp; Research Chat Hub
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time WebSocket communication — discuss research ideas, co-author publications, and share files, folders, and field imagery across KMFRI stations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-xs font-mono text-emerald-700 dark:text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{Math.max(1, onlineUserIds.length)} Online Now</span>
          </span>

          <button
            type="button"
            onClick={() => setMobileRosterOpen((prev) => !prev)}
            className="lg:hidden px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5 text-sky-600" />
            <span>Channels &amp; Scientists ({allParticipants.length + 1})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('ai_assistant')}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#0A2540] to-sky-700 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask KMFRI AI Assistant</span>
          </button>
        </div>
      </div>

      {/* Main Split Chat Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-220px)] min-h-[540px]">
        {/* Left Sidebar: Channels & Direct Message Scientists Roster */}
        <div
          className={`${
            mobileRosterOpen ? 'block' : 'hidden lg:flex'
          } lg:col-span-4 xl:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex-col overflow-hidden`}
        >
          {/* Research Channels */}
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
              Research Channels
            </div>
            <div className="space-y-1">
              {RESEARCH_CHANNELS.map((ch) => {
                const count = db.chat_messages.filter((m) => m.channel_id === ch.id).length;
                const isSelected = activeChatChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setActiveChatChannel(ch.id);
                      setMobileRosterOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-[#0A2540] dark:bg-sky-600 text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Hash className="w-3.5 h-3.5 shrink-0 opacity-75" />
                      <span className="truncate">{ch.name}</span>
                    </span>
                    {count > 0 && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Direct Messages & Registered Scientists Roster */}
          <div className="flex-1 p-3.5 overflow-y-auto">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Scientists &amp; Staff Direct Chat
              </span>
              <span className="text-[11px] font-mono text-sky-600">
                {allParticipants.length + 1} Registered
              </span>
            </div>

            {/* Current User Card */}
            <div className="p-2.5 mb-2 rounded-lg bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-900/50 flex items-center gap-2.5">
              <UserAvatar user={user} size="sm" isOnline={true} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {user.title} {user.full_name} (You)
                </div>
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 truncate">
                  ● Online · {user.role_code}
                </div>
              </div>
            </div>

            {allParticipants.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                No other scientists registered yet. Register scientists in the Scientists module to start 1-on-1 direct chats.
              </div>
            ) : (
              <div className="space-y-1">
                {allParticipants.map((person) => {
                  const dmId = getDmChannelId(user.id, person.id);
                  const isSelected = activeChatChannel === dmId;
                  const isPersonOnline = onlineUserIds.includes(person.id);
                  const dmCount = db.chat_messages.filter((m) => m.channel_id === dmId).length;
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => {
                        setActiveChatChannel(dmId);
                        setMobileRosterOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-[#0A2540] dark:bg-sky-600 text-white'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar user={person} size="sm" isOnline={isPersonOnline} />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">
                            {person.title} {person.full_name}
                          </div>
                          <div
                            className={`text-[10px] font-mono truncate ${
                              isSelected ? 'text-sky-100' : 'text-slate-500'
                            }`}
                          >
                            {isPersonOnline ? '● Online' : 'Offline'} · {person.position}
                          </div>
                        </div>
                      </div>
                      {dmCount > 0 && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}
                        >
                          {dmCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Active Channel / Direct Message Stream & Composer */}
        <div className="lg:col-span-8 xl:col-span-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden">
          {/* Channel Header */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-950/50">
            <div className="flex items-center gap-3 min-w-0">
              {activeChannelMeta.dmPartner ? (
                <UserAvatar
                  user={activeChannelMeta.dmPartner}
                  size="sm"
                  isOnline={onlineUserIds.includes(activeChannelMeta.dmPartner.id)}
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 shrink-0">
                  <Hash className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {activeChannelMeta.title}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {activeChannelMeta.subtitle}
                </div>
              </div>
            </div>

            {activeChannelMeta.dmPartner && (
              <button
                type="button"
                onClick={() => {
                  setSelectedScientistId(activeChannelMeta.dmPartner!.id);
                  setActiveModule('scientists');
                }}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              >
                View Profile
              </button>
            )}
          </div>

          {/* Scrollable Message Thread */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {channelMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 mb-3">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Start the Scientific Conversation in {activeChannelMeta.title}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mt-1">
                  Share research observations, upload field images or datasets, link shared folders, or discuss publications in real time.
                </p>
              </div>
            ) : (
              channelMessages.map((msg) => {
                const isMe = msg.sender_id === user.id;
                const liveSender = db.users.find((u) => u.id === msg.sender_id);
                const senderAvatar = liveSender?.avatar_url || msg.sender_avatar;
                const isSenderOnline = onlineUserIds.includes(msg.sender_id);

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (liveSender?.is_operational_scientist) {
                          setSelectedScientistId(liveSender.id);
                          setActiveModule('scientists');
                        }
                      }}
                      className="shrink-0 focus:outline-none"
                      title={`View ${msg.sender_title} ${msg.sender_name}`}
                    >
                      <UserAvatar
                        name={msg.sender_name}
                        avatarUrl={senderAvatar}
                        size="md"
                        isOnline={isSenderOnline}
                      />
                    </button>

                    <div
                      className={`max-w-[82%] sm:max-w-[70%] rounded-2xl p-3.5 border ${
                        isMe
                          ? 'bg-[#0A2540] text-white border-sky-800/80'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div
                        className={`flex flex-wrap items-center justify-between gap-2 text-[11px] mb-1 ${
                          isMe ? 'text-sky-200' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <span className="font-semibold">
                          {msg.sender_title} {msg.sender_name}{' '}
                          <span className="font-mono opacity-80">({msg.sender_role})</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px]">
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {isMe && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="opacity-70 hover:opacity-100 text-rose-300"
                              title="Delete message"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {msg.content && (
                        <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      )}

                      {/* Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2.5 space-y-2">
                          {msg.attachments.map((att) => {
                            if (att.type === 'image' && att.data_url) {
                              return (
                                <div
                                  key={att.id}
                                  className="rounded-xl overflow-hidden border border-white/15 bg-black/20"
                                >
                                  <img
                                    src={att.data_url}
                                    alt={att.title}
                                    onClick={() =>
                                      setLightboxImage({ url: att.data_url!, title: att.title })
                                    }
                                    className="max-h-60 w-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                  />
                                  <div className="px-3 py-1.5 flex items-center justify-between text-[11px]">
                                    <span className="truncate font-mono">{att.file_name || att.title}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadAttachment(att)}
                                      className="flex items-center gap-1 underline ml-2 shrink-0"
                                    >
                                      <Download className="w-3 h-3" />
                                      <span>Save</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            if (att.type === 'folder') {
                              return (
                                <div
                                  key={att.id}
                                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                                    isMe
                                      ? 'bg-sky-950/60 border-sky-700 text-white'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold truncate">
                                        Shared Folder: {att.title}
                                      </div>
                                      <div className="text-[10px] opacity-75">
                                        Click to open in Shared Files &amp; Folders
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setActiveModule('documents')}
                                    className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-[11px] font-semibold shrink-0"
                                  >
                                    Open Folder
                                  </button>
                                </div>
                              );
                            }

                            if (att.type === 'publication') {
                              return (
                                <div
                                  key={att.id}
                                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                                    isMe
                                      ? 'bg-teal-950/60 border-teal-700 text-white'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <BookOpen className="w-4 h-4 text-teal-400 shrink-0" />
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold truncate">
                                        Publication: {att.title}
                                      </div>
                                      <div className="text-[10px] opacity-75">
                                        Research Output / Manuscript
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setActiveModule('outputs')}
                                    className="px-2.5 py-1 rounded-lg bg-teal-600 text-white text-[11px] font-semibold shrink-0"
                                  >
                                    Read
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={att.id}
                                className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                                  isMe
                                    ? 'bg-sky-950/60 border-sky-700 text-white'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold truncate">
                                      {att.file_name || att.title}
                                    </div>
                                    {att.size_bytes && (
                                      <div className="text-[10px] font-mono opacity-75">
                                        {(att.size_bytes / 1024).toFixed(1)} KB
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadAttachment(att)}
                                  className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-[11px] font-semibold flex items-center gap-1 shrink-0"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Download</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Pending Attachments Preview Strip */}
          {pendingAttachments.length > 0 && (
            <div className="px-4 py-2 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
              {pendingAttachments.map((att) => (
                <div
                  key={att.id}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs"
                >
                  {att.type === 'image' ? (
                    <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
                  ) : att.type === 'folder' ? (
                    <Folder className="w-3.5 h-3.5 text-amber-500" />
                  ) : att.type === 'publication' ? (
                    <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-sky-600" />
                  )}
                  <span className="truncate max-w-[160px]">{att.title}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingAttachments((prev) => prev.filter((p) => p.id !== att.id))
                    }
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Share Folder / Publication Quick Picker */}
          {sharePickerMode && (
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold">
                  {sharePickerMode === 'folder'
                    ? 'Select a Shared Folder to Attach:'
                    : 'Select a Publication / Manuscript to Share:'}
                </span>
                <button
                  type="button"
                  onClick={() => setSharePickerMode(null)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Close
                </button>
              </div>
              {sharePickerMode === 'folder' ? (
                db.shared_folders.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No folders created yet. Create folders in the Documents &amp; Folders module.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                    {db.shared_folders.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setPendingAttachments((prev) => [
                            ...prev,
                            {
                              id: `folder-${f.id}`,
                              type: 'folder',
                              title: f.name,
                              reference_id: f.id,
                            },
                          ]);
                          setSharePickerMode(null);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs flex items-center gap-1.5 hover:border-sky-500"
                      >
                        <Folder className="w-3.5 h-3.5 text-amber-500" />
                        <span>{f.name}</span>
                      </button>
                    ))}
                  </div>
                )
              ) : db.research_outputs.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No publications catalogued yet. Write a manuscript in the Research Outputs module.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                  {db.research_outputs.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setPendingAttachments((prev) => [
                          ...prev,
                          {
                            id: `pub-${o.id}`,
                            type: 'publication',
                            title: o.title,
                            reference_id: o.id,
                          },
                        ]);
                        setSharePickerMode(null);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs flex items-center gap-1.5 hover:border-teal-500"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                      <span className="truncate max-w-[220px]">{o.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Composer Form */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-2"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.docx,.xlsx,.csv,.geojson,.txt"
                onChange={handleFileUploadSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
              >
                <Paperclip className="w-3.5 h-3.5 text-sky-600" />
                <span>Attach File / Image</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setSharePickerMode((prev) => (prev === 'folder' ? null : 'folder'))
                }
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
              >
                <Folder className="w-3.5 h-3.5 text-amber-500" />
                <span>Share Folder</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setSharePickerMode((prev) => (prev === 'publication' ? null : 'publication'))
                }
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
              >
                <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                <span>Share Publication</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={`Message ${activeChannelMeta.title} — share ideas, files, or research notes...`}
                className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={sending || (!messageText.trim() && pendingAttachments.length === 0)}
                className="px-4 py-2.5 rounded-xl bg-[#0A2540] dark:bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-slate-800 flex items-center justify-between text-white text-xs">
              <span className="font-semibold truncate">{lightboxImage.title}</span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-[75vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// FLOATING DOCKABLE LIVE CHATBOX WIDGET (ACCESSIBLE FROM ANY PAGE)
// =============================================================================

export function FloatingChatWidget() {
  const {
    db,
    user,
    activeModule,
    setActiveModule,
    floatingChatOpen,
    setFloatingChatOpen,
    activeChatChannel,
    onlineUserIds,
    apiFetch,
    refreshData,
  } = useAuth();

  const [quickText, setQuickText] = useState('');
  const [sending, setSending] = useState(false);

  if (!db || !user || activeModule === 'chat') return null;

  const recentMessages = db.chat_messages
    .filter((m) => m.channel_id === activeChatChannel)
    .slice(-15);

  const handleQuickSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickText.trim() || sending) return;
    setSending(true);
    try {
      await apiFetch('/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          channel_id: activeChatChannel,
          content: quickText.trim(),
          attachments: [],
        }),
      });
      setQuickText('');
      await refreshData();
    } catch {
      // handled
    } finally {
      setSending(false);
    }
  };

  if (!floatingChatOpen) {
    return (
      <button
        type="button"
        onClick={() => setFloatingChatOpen(true)}
        className="fixed bottom-5 right-5 z-40 px-4 py-3 rounded-full bg-[#0A2540] dark:bg-sky-600 text-white shadow-xl border border-sky-400/30 flex items-center gap-2.5 hover:scale-105 transition-transform no-print"
      >
        <div className="relative">
          <MessageSquare className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
        </div>
        <span className="text-xs font-semibold">Scientist Chat</span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/15">
          {Math.max(1, onlineUserIds.length)} online
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-96 h-[460px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden no-print">
      {/* Top Bar */}
      <div className="px-4 py-3 bg-[#0A2540] text-white flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-4 h-4 text-sky-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-bold truncate">KMFRI Live Scientist Chat</div>
            <div className="text-[10px] text-sky-300 font-mono truncate">
              #{activeChatChannel} · {Math.max(1, onlineUserIds.length)} Online
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setFloatingChatOpen(false);
              setActiveModule('chat');
            }}
            className="p-1.5 rounded hover:bg-white/10 text-sky-200"
            title="Expand Full Chat Hub"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFloatingChatOpen(false)}
            className="p-1.5 rounded hover:bg-white/10 text-sky-200"
            title="Minimize Chatbox"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-slate-50/50 dark:bg-slate-950/50">
        {recentMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-xs text-slate-500">
            <p>No messages in #{activeChatChannel} yet. Say hello to fellow KMFRI researchers!</p>
          </div>
        ) : (
          recentMessages.map((m) => {
            const isMe = m.sender_id === user.id;
            const liveSender = db.users.find((u) => u.id === m.sender_id);
            return (
              <div
                key={m.id}
                className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : ''}`}
              >
                <UserAvatar
                  name={m.sender_name}
                  avatarUrl={liveSender?.avatar_url || m.sender_avatar}
                  size="xs"
                  isOnline={onlineUserIds.includes(m.sender_id)}
                />
                <div
                  className={`max-w-[78%] px-3 py-2 rounded-xl text-xs ${
                    isMe
                      ? 'bg-[#0A2540] text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="text-[10px] opacity-75 font-semibold mb-0.5">
                    {m.sender_title} {m.sender_name}
                  </div>
                  {m.content && <div className="break-words">{m.content}</div>}
                  {m.attachments?.length > 0 && (
                    <div className="mt-1 text-[10px] font-mono text-sky-400">
                      📎 {m.attachments.length} attachment(s) shared
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Input */}
      <form
        onSubmit={handleQuickSend}
        className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2"
      >
        <input
          type="text"
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
          placeholder="Write a message or idea..."
          className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !quickText.trim()}
          className="p-2 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
