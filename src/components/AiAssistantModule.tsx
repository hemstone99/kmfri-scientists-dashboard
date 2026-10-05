import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Compass,
  ExternalLink,
  Globe,
  MapPin,
  MessageSquareShare,
  RotateCcw,
  Send,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';

type AssistantMode = 'general' | 'fast' | 'complex' | 'search' | 'maps';

interface AiThreadMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  mode: AssistantMode;
  modelUsed?: string;
  webSources?: Array<{ uri: string; title: string }>;
  mapSources?: Array<{ uri: string; title: string; reviewSnippets?: string[] }>;
  timestamp: string;
}

const MODE_CONFIGS: Array<{
  id: AssistantMode;
  label: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'general',
    label: 'General Research',
    badge: 'gemini-3.5-flash',
    description: 'Balanced scientific synthesis, report drafting & KMFRI portfolio Q&A',
    icon: Sparkles,
  },
  {
    id: 'search',
    label: 'Google Search Grounding',
    badge: 'gemini-3.5-flash + Search',
    description: 'Live web & scientific literature citations across the Western Indian Ocean',
    icon: Globe,
  },
  {
    id: 'maps',
    label: 'Google Maps Grounding',
    badge: 'gemini-3.5-flash + Maps',
    description: 'Accurate geographic, coastal station & marine landmark intelligence',
    icon: MapPin,
  },
  {
    id: 'complex',
    label: 'Deep Scientific Reasoning',
    badge: 'gemini-3.1-pro-preview',
    description: 'Complex oceanographic modeling, statistical design & manuscript review',
    icon: Compass,
  },
  {
    id: 'fast',
    label: 'Fast Field Lookup',
    badge: 'gemini-3.1-flash-lite',
    description: 'Instant species taxonomy, unit conversions & rapid field checks',
    icon: Zap,
  },
];

const QUICK_PROMPTS: Array<{ text: string; mode: AssistantMode }> = [
  {
    text: 'Search recent scientific findings on Blue Carbon sequestration in Gazi Bay and Vanga mangroves in Kenya.',
    mode: 'search',
  },
  {
    text: 'Locate key marine conservation sites, ports, and research landmarks around Mombasa, Kisite-Mpunguti, and Malindi using Google Maps.',
    mode: 'maps',
  },
  {
    text: 'Design a rigorous statistical sampling methodology and manuscript outline for coral reef thermal bleaching resilience in the Western Indian Ocean.',
    mode: 'complex',
  },
  {
    text: 'Summarize the current KMFRI directorates, research areas, and active projects in our institutional database.',
    mode: 'general',
  },
];

export function AiAssistantModule() {
  const { user, apiFetch, shareToLiveChat, showToast } = useAuth();

  const [mode, setMode] = useState<AssistantMode>('general');
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: -4.0547, // KMFRI English Point Mombasa HQ
    lng: 39.6636,
  });

  const [messages, setMessages] = useState<AiThreadMessage[]>([
    {
      id: 'welcome-ai',
      role: 'model',
      mode: 'general',
      modelUsed: 'gemini-3.5-flash',
      text: `Welcome to the **KMFRI Scientific AI Research Assistant**. I am configured with context on KMFRI's directorates (Oceans & Coastal Systems, Freshwater Systems, Aquaculture, Socio-Economics, and Laboratories), research areas, projects, and publications.\n\nYou can switch modes above to use **Google Search Grounding** for live scientific literature, **Google Maps Grounding** for coastal/inland station geography, **Deep Reasoning (gemini-3.1-pro-preview)** for complex research tasks, or **Fast Lookup (gemini-3.1-flash-lite)**.`,
      timestamp: new Date().toISOString(),
    },
  ]);

  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  // Attempt to get browser geolocation when user switches to Maps Grounding mode
  useEffect(() => {
    if (mode === 'maps' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: Number(pos.coords.latitude.toFixed(5)),
            lng: Number(pos.coords.longitude.toFixed(5)),
          });
        },
        () => {
          // Keep default KMFRI Mombasa HQ coordinates
        }
      );
    }
  }, [mode]);

  const handleSendPrompt = async (customText?: string, customMode?: AssistantMode) => {
    const promptToUse = (customText ?? inputPrompt).trim();
    const activeMode = customMode ?? mode;
    if (!promptToUse || loading) return;

    if (customMode) setMode(customMode);
    if (!customText) setInputPrompt('');

    const userMsg: AiThreadMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: promptToUse,
      mode: activeMode,
      timestamp: new Date().toISOString(),
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setLoading(true);

    try {
      const apiHistory = updatedHistory
        .filter((m) => m.id !== 'welcome-ai')
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const res = await apiFetch<{
        reply: string;
        modelUsed: string;
        mode: AssistantMode;
        webSources?: Array<{ uri: string; title: string }>;
        mapSources?: Array<{ uri: string; title: string; reviewSnippets?: string[] }>;
      }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: apiHistory,
          mode: activeMode,
          latitude: coords.lat,
          longitude: coords.lng,
        }),
      });

      const assistantMsg: AiThreadMessage = {
        id: `ai-${Date.now()}`,
        role: 'model',
        text: res.reply,
        mode: activeMode,
        modelUsed: res.modelUsed,
        webSources: res.webSources,
        mapSources: res.mapSources,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errMsg: AiThreadMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        text: `⚠️ **AI Assistant Notice:** ${err.message || 'Unable to reach Gemini service.'}`,
        mode: activeMode,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Mode Selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0A2540] to-teal-600 text-white flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  KMFRI Gemini AI Research Assistant
                </h1>
                <p className="text-xs text-slate-500">
                  Multi-turn scientific advisor with Google Search Grounding, Google Maps Grounding, and Deep Reasoning
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setMessages([
                {
                  id: 'welcome-ai',
                  role: 'model',
                  mode,
                  modelUsed: 'gemini-3.5-flash',
                  text: 'Conversation history cleared. How can I assist with your KMFRI marine or freshwater research today?',
                  timestamp: new Date().toISOString(),
                },
              ])
            }
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Thread</span>
          </button>
        </div>

        {/* Mode Selector Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          {MODE_CONFIGS.map((cfg) => {
            const Icon = cfg.icon;
            const active = mode === cfg.id;
            return (
              <button
                key={cfg.id}
                type="button"
                onClick={() => setMode(cfg.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  active
                    ? 'bg-[#0A2540] text-white border-sky-500 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-sky-500/50'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-teal-300' : 'text-sky-600'}`} />
                    <span className="truncate">{cfg.label}</span>
                  </span>
                </div>
                <div
                  className={`text-[10px] font-mono mb-1 ${
                    active ? 'text-sky-300' : 'text-sky-700 dark:text-sky-400'
                  }`}
                >
                  {cfg.badge}
                </div>
                <p
                  className={`text-[11px] line-clamp-2 ${
                    active ? 'text-slate-200' : 'text-slate-500'
                  }`}
                >
                  {cfg.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat Thread Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col h-[calc(100vh-330px)] min-h-[480px] overflow-hidden">
        {/* Quick Prompts Bar */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-semibold text-slate-500 shrink-0">Quick Prompts:</span>
          {QUICK_PROMPTS.map((qp, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendPrompt(qp.text, qp.mode)}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300 hover:border-sky-500 whitespace-nowrap transition-colors"
            >
              {qp.text.slice(0, 68)}...
            </button>
          ))}
        </div>

        {/* Scrollable Messages */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-5">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
              >
                {isUser ? (
                  <UserAvatar user={user} size="md" isOnline={true} />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0A2540] via-sky-700 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Bot className="w-5 h-5" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] sm:max-w-[78%] rounded-2xl p-4 border ${
                    isUser
                      ? 'bg-[#0A2540] text-white border-sky-800'
                      : 'bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 text-[11px] mb-2 ${
                      isUser ? 'text-sky-200' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <span className="font-semibold">
                      {isUser
                        ? `${user?.title || ''} ${user?.full_name || 'Scientist'}`
                        : 'KMFRI Scientific AI Advisor'}
                    </span>
                    <div className="flex items-center gap-2">
                      {m.modelUsed && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-300">
                          {m.modelUsed}
                        </span>
                      )}
                      {!isUser && m.id !== 'welcome-ai' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await shareToLiveChat(
                              {
                                id: `ai-note-${Date.now()}`,
                                type: 'file',
                                title: 'AI Research Brief',
                              },
                              `🤖 Shared KMFRI AI Research Insight:\n\n${m.text.slice(0, 600)}${
                                m.text.length > 600 ? '...' : ''
                              }`
                            );
                          }}
                          className="text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-medium"
                          title="Share AI insight to Live Scientist Chat"
                        >
                          <MessageSquareShare className="w-3 h-3" />
                          <span>Share to Chat</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                    {m.text}
                  </div>

                  {/* Google Search Grounding Sources */}
                  {m.webSources && m.webSources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <div className="text-[11px] font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5 mb-2">
                        <Globe className="w-3.5 h-3.5" />
                        <span>Google Search Grounding Citations ({m.webSources.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {m.webSources.map((src, i) => (
                          <a
                            key={i}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-sky-700 dark:text-sky-300 hover:border-sky-500"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[240px]">{src.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Google Maps Grounding Sources */}
                  {m.mapSources && m.mapSources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <div className="text-[11px] font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1.5 mb-2">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Google Maps Grounded Locations ({m.mapSources.length})</span>
                      </div>
                      <div className="space-y-2">
                        {m.mapSources.map((loc, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                          >
                            <a
                              href={loc.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-teal-700 dark:text-teal-300 hover:underline flex items-center gap-1.5"
                            >
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span>{loc.title}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            {loc.reviewSnippets && loc.reviewSnippets.length > 0 && (
                              <div className="mt-1 text-[11px] text-slate-500 space-y-1">
                                {loc.reviewSnippets.map((snip, sIdx) => (
                                  <p key={sIdx} className="italic">
                                    "{snip}"
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
              <div className="w-8 h-8 rounded-full bg-sky-500/15 flex items-center justify-center text-sky-600 animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <span>
                KMFRI AI Assistant is analyzing with{' '}
                {MODE_CONFIGS.find((c) => c.id === mode)?.badge}...
              </span>
            </div>
          )}
          <div ref={threadEndRef} />
        </div>

        {/* Input Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt();
          }}
          className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
        >
          {mode === 'maps' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-[11px] font-mono text-teal-700 dark:text-teal-300 shrink-0">
              <MapPin className="w-3.5 h-3.5" />
              <span>
                Ref: {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}
              </span>
            </div>
          )}

          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder={
              mode === 'search'
                ? 'Ask a question grounded in live Google Search & scientific web data...'
                : mode === 'maps'
                ? 'Ask about coastal stations, marine parks, lakes, or geography with Google Maps...'
                : 'Ask about marine science, manuscript drafting, project analytics, or grant proposals...'
            }
            className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-sky-500"
          />

          <button
            type="submit"
            disabled={loading || !inputPrompt.trim()}
            className="px-4 py-2.5 rounded-xl bg-[#0A2540] dark:bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ask AI</span>
          </button>
        </form>
      </div>
    </div>
  );
}
