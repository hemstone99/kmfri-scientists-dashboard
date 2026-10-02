import React, { useState, useRef, useEffect } from 'react';
import { BootstrapData } from '../types.ts';
import {
  Sparkles,
  Send,
  BookOpen,
  Compass,
  FileText,
  BarChart3,
  Copy,
  Check,
  Trash2,
  Share2,
} from 'lucide-react';

interface AiMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  taskMode: string;
  timestamp: string;
}

interface AiResearchAssistantViewProps {
  data: BootstrapData;
  apiFetch: <T = any>(path: string, options?: RequestInit) => Promise<T>;
  onShareInsightToChat?: (text: string) => void;
  onNavigateModule?: (moduleName: string) => void;
}

const AI_TASK_MODES = [
  {
    id: 'Manuscript & Abstract Co-Pilot',
    label: 'Manuscript & WIOJMS Co-Pilot',
    icon: BookOpen,
    description: 'Draft abstracts, methodology sections, and peer-review responses',
  },
  {
    id: 'Hydrographic & Sampling Advisor',
    label: 'EEZ & Freshwater Sampling Advisor',
    icon: Compass,
    description: 'Protocols for Mombasa, Gazi Bay, Lamu EEZ, Lake Victoria & Turkana',
  },
  {
    id: 'Portfolio & Grant Analytics',
    label: 'Portfolio & Grant Analytics',
    icon: BarChart3,
    description: 'Analyze active KMFRI projects, budget utilization & report status',
  },
  {
    id: 'Blue Economy Policy Brief',
    label: 'Blue Economy Policy Briefs',
    icon: FileText,
    description: 'Synthesize findings for BMUs & Ministry policy decision-makers',
  },
];

const QUICK_SCIENTIFIC_PROMPTS = [
  {
    mode: 'Manuscript & Abstract Co-Pilot',
    title: 'Draft WIOJMS Structured Abstract',
    prompt:
      'Draft a rigorous 250-word structured abstract (Background, Methodology, Results, Conclusion) for a KMFRI study on Blue Carbon sequestration and mangrove biomass dynamics in Gazi Bay and Lamu Archipelago, Kenya.',
  },
  {
    mode: 'Hydrographic & Sampling Advisor',
    title: 'RV Mtafiti CTD & Plankton Protocol',
    prompt:
      'Design a standard hydrographic and zooplankton sampling protocol for an RV Mtafiti offshore transect across the North Kenya Banks and Malindi-Watamu Marine Reserve, specifying WGS84 depth strata and water quality parameters.',
  },
  {
    mode: 'Portfolio & Grant Analytics',
    title: 'Executive Summary of Current KMFRI Portfolio',
    prompt:
      'Analyze our current KMFRI institutional research portfolio, active projects, publications, and reporting compliance, and recommend 3 strategic priorities for the upcoming quarter.',
  },
  {
    mode: 'Blue Economy Policy Brief',
    title: 'BMU Artisanal Fisheries Co-Management Brief',
    prompt:
      'Write an executive Blue Economy Policy Brief for coastal Beach Management Units (BMUs) and County Fisheries Directors on sustainable artisanal reef fishery co-management along the Kenyan coast.',
  },
];

export const AiResearchAssistantView: React.FC<AiResearchAssistantViewProps> = ({
  data,
  apiFetch,
  onShareInsightToChat,
  onNavigateModule,
}) => {
  const currentUser = data.currentUser;
  const [taskMode, setTaskMode] = useState<string>(AI_TASK_MODES[0].id);
  const [promptInput, setPromptInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<AiMessage[]>([
    {
      id: 'welcome-ai-msg',
      role: 'model',
      taskMode: 'System Ready',
      timestamp: new Date().toISOString(),
      text: `Hello **${currentUser.fullName}** (${currentUser.staffNumber || 'KMFRI Researcher'}). I am your **KMFRI Scientific & Research Governance AI Assistant**, connected to your live institutional workspace (**${data.projects.length} projects**, **${data.researchOutputs.length} publications**, and **${data.locations.length} mapped GIS stations**).\n\nSelect a specialized scientific mode above or choose a quick prompt below to draft manuscripts, design hydrographic sampling protocols, analyze grant utilization, or prepare Blue Economy policy briefs.`,
    },
  ]);

  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  const handleSendPrompt = async (customPrompt?: string, customMode?: string) => {
    const textToSend = (customPrompt !== undefined ? customPrompt : promptInput).trim();
    const activeMode = customMode || taskMode;
    if (!textToSend || loading) return;

    const userMsg: AiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: textToSend,
      taskMode: activeMode,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (customPrompt === undefined) {
      setPromptInput('');
    }
    setLoading(true);
    setErrorBanner(null);

    try {
      const historyPayload = messages
        .filter((m) => m.id !== 'welcome-ai-msg')
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await apiFetch<{
        reply: string;
        model: string;
        timestamp: string;
      }>('/api/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({
          prompt: textToSend,
          taskMode: activeMode,
          history: historyPayload,
        }),
      });

      const modelMsg: AiMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: res.reply,
        taskMode: activeMode,
        timestamp: res.timestamp || new Date().toISOString(),
      };
      setMessages((prev) => [...prev, modelMsg]);
    } catch (err: any) {
      setErrorBanner(
        err.message ||
          'Failed to generate response from KMFRI AI Research Assistant.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-sky-700 dark:text-teal-400">
            <Sparkles className="w-4 h-4" />
            <span>KMFRI SCIENTIFIC &amp; RESEARCH GOVERNANCE AI ASSISTANT</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
            AI Research Co-Pilot &amp; Oceanographic Analyst
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Powered by server-side Gemini AI with live awareness of KMFRI projects, publications, hydrographic stations, and reporting workflows.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateModule && (
            <button
              type="button"
              onClick={() => onNavigateModule('Research Outputs')}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:border-sky-500 flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Open Publications Studio</span>
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              setMessages((prev) => prev.slice(0, 1))
            }
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Session</span>
          </button>
        </div>
      </div>

      {/* 4 Task Mode Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {AI_TASK_MODES.map((m) => {
          const Icon = m.icon;
          const active = taskMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setTaskMode(m.id)}
              className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                active
                  ? 'border-sky-600 bg-sky-50/70 dark:bg-sky-950/50 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    active
                      ? 'bg-sky-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-sky-700 dark:text-sky-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                {active && (
                  <span className="text-[10px] font-mono font-bold uppercase text-sky-700 dark:text-sky-400">
                    Active Mode
                  </span>
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  {m.label}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {m.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Split Interface: Left Conversation Stream + Right Quick Scientific Prompts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 8-Column AI Conversation Workspace */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-[580px] overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              <span className="font-bold text-slate-900 dark:text-white">
                Active Mode: {taskMode}
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-500">
              Context: {data.projects.length} Projects · {data.researchOutputs.length} Outputs
            </span>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isUser ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-1 px-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {isUser ? currentUser.fullName : 'KMFRI Gemini AI Assistant'}
                    </span>
                    <span>·</span>
                    <span className="font-mono">{msg.taskMode}</span>
                  </div>

                  <div
                    className={`max-w-2xl rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-2.5 ${
                      isUser
                        ? 'bg-sky-700 text-white'
                        : 'bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

                    {!isUser && msg.id !== 'welcome-ai-msg' && (
                      <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-medium flex items-center gap-1 hover:border-sky-500"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Text</span>
                            </>
                          )}
                        </button>
                        {onShareInsightToChat && (
                          <button
                            type="button"
                            onClick={() => onShareInsightToChat(msg.text)}
                            className="px-2.5 py-1 rounded-lg border border-teal-500/40 bg-teal-50/60 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 text-[11px] font-medium flex items-center gap-1"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>Share in Scientist Chatbox</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2.5 text-xs text-sky-700 dark:text-sky-400 font-medium p-3 rounded-xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/50 w-fit">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Synthesizing KMFRI scientific response...</span>
              </div>
            )}

            {errorBanner && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200">
                {errorBanner}
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Prompt Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt();
            }}
            className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center gap-2.5"
          >
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder={`Ask KMFRI AI Assistant (${taskMode})...`}
              className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-sky-600"
            />
            <button
              type="submit"
              disabled={loading || !promptInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask AI</span>
            </button>
          </form>
        </div>

        {/* 4-Column Quick Scientific Prompts & Live Context Summary */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              One-Click Scientific Templates
            </h3>
            <p className="text-xs text-slate-500">
              Click any template below to generate structured scientific drafts or portfolio insights immediately:
            </p>
            <div className="space-y-2.5">
              {QUICK_SCIENTIFIC_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setTaskMode(item.mode);
                    handleSendPrompt(item.prompt, item.mode);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500/60 bg-slate-50/70 dark:bg-slate-800/50 transition-colors space-y-1"
                >
                  <div className="text-[10px] font-mono font-semibold text-sky-700 dark:text-sky-400">
                    {item.mode}
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-500 line-clamp-2">
                    {item.prompt}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
