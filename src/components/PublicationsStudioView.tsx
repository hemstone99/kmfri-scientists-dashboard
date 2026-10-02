import React, { useState, useMemo } from 'react';
import {
  BootstrapData,
  ResearchOutputRecord,
} from '../types.ts';
import {
  BookOpen,
  PenTool,
  Plus,
  FileText,
  Sparkles,
  CheckCircle2,
  Clock,
  Share2,
  Printer,
  Edit3,
  Trash2,
  ExternalLink,
  Upload,
} from 'lucide-react';

interface PublicationsStudioViewProps {
  data: BootstrapData;
  searchQuery: string;
  onRefresh: () => Promise<void>;
  apiFetch: <T = any>(path: string, options?: RequestInit) => Promise<T>;
  onShareToChat?: (output: ResearchOutputRecord) => void;
}

const SCIENTIFIC_MANUSCRIPT_TEMPLATE = `## 1. INTRODUCTION & STUDY AREA
Describe the marine, coastal, or freshwater ecosystem context within Kenya's Exclusive Economic Zone (EEZ) or inland lake basins (Lake Victoria, Lake Turkana, Lake Naivasha). State the primary research hypothesis and alignment with KMFRI's strategic mandate.

## 2. MATERIALS, METHODOLOGY & HYDROGRAPHIC SAMPLING
Detail the sampling stations (WGS84 coordinates), RV Mtafiti or inshore transect protocols, water quality parameters (SST, dissolved oxygen, chlorophyll-a, salinity), and statistical models utilized.

## 3. RESULTS, DATA ANALYSIS & KEY FINDINGS
Summarize quantitative observations, stock biomass estimates, biodiversity indices, or blue carbon sequestration rates recorded across sampling periods.

## 4. DISCUSSION & BLUE ECONOMY POLICY RECOMMENDATIONS
Interpret the ecological and socio-economic implications for Beach Management Units (BMUs), county fisheries governance, and national conservation policy.

## 5. REFERENCES & DATA AVAILABILITY
1. KMFRI Hydrographic & Oceanographic Telemetry Repository (2026).
2. Western Indian Ocean Journal of Marine Science (WIOJMS) Standard Citation Format.`;

export const PublicationsStudioView: React.FC<PublicationsStudioViewProps> = ({
  data,
  searchQuery,
  onRefresh,
  apiFetch,
  onShareToChat,
}) => {
  const currentUser = data.currentUser;
  const isViewer = currentUser.roleName === 'VIEWER';

  const [mode, setMode] = useState<'STUDIO' | 'REPOSITORY' | 'READER'>('REPOSITORY');
  const [editingOutput, setEditingOutput] = useState<ResearchOutputRecord | null>(
    null
  );
  const [readingOutput, setReadingOutput] = useState<ResearchOutputRecord | null>(
    null
  );

  // Authoring Studio State
  const [title, setTitle] = useState('');
  const [outputType, setOutputType] = useState('Peer-Reviewed Publication');
  const [projectId, setProjectId] = useState<string>('');
  const [journalOrEvent, setJournalOrEvent] = useState(
    'Western Indian Ocean Journal of Marine Science (WIOJMS)'
  );
  const [doi, setDoi] = useState('');
  const [url, setUrl] = useState('');
  const [publicationDate, setPublicationDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [keywords, setKeywords] = useState(
    'Marine Ecology, Kenyan EEZ, KMFRI, Blue Economy, Hydrography'
  );
  const [abstract, setAbstract] = useState('');
  const [manuscriptBody, setManuscriptBody] = useState(
    SCIENTIFIC_MANUSCRIPT_TEMPLATE
  );
  const [status, setStatus] = useState<'Draft' | 'In Press' | 'Published'>(
    'Published'
  );
  const [fileUrl, setFileUrl] = useState('');
  const [coAuthorIds, setCoAuthorIds] = useState<string[]>([currentUser.id]);
  const [saving, setSaving] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const openEditorForNew = () => {
    setEditingOutput(null);
    setTitle('');
    setOutputType('Peer-Reviewed Publication');
    setProjectId(data.projects[0]?.id || '');
    setJournalOrEvent('Western Indian Ocean Journal of Marine Science (WIOJMS)');
    setDoi('');
    setUrl('');
    setPublicationDate(new Date().toISOString().slice(0, 10));
    setKeywords('Marine Ecology, Kenyan EEZ, KMFRI, Blue Economy');
    setAbstract('');
    setManuscriptBody(SCIENTIFIC_MANUSCRIPT_TEMPLATE);
    setStatus('Published');
    setFileUrl('');
    setCoAuthorIds([currentUser.id]);
    setStatusBanner(null);
    setMode('STUDIO');
  };

  const openEditorForExisting = (out: ResearchOutputRecord) => {
    setEditingOutput(out);
    setTitle(out.title);
    setOutputType(out.outputType);
    setProjectId(out.projectId || '');
    setJournalOrEvent(out.journalOrEvent || '');
    setDoi(out.doi || '');
    setUrl(out.url || '');
    setPublicationDate(out.publicationDate);
    setKeywords(out.keywords || '');
    setAbstract(out.abstract || '');
    setManuscriptBody(out.manuscriptBody || SCIENTIFIC_MANUSCRIPT_TEMPLATE);
    setStatus((out.status as any) || 'Published');
    setFileUrl(out.fileUrl || '');
    const existingAuthors = data.outputAuthors
      .filter((oa) => oa.outputId === out.id)
      .sort((a, b) => a.authorOrder - b.authorOrder)
      .map((oa) => oa.userId);
    setCoAuthorIds(
      existingAuthors.length > 0
        ? existingAuthors
        : out.leadScientistId
          ? [out.leadScientistId]
          : [currentUser.id]
    );
    setStatusBanner(null);
    setMode('STUDIO');
  };

  const wordCount = useMemo(() => {
    const combined = `${abstract} ${manuscriptBody}`.trim();
    if (!combined) return 0;
    return combined.split(/\s+/).length;
  }, [abstract, manuscriptBody]);

  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));

  const handleAttachmentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFileUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveManuscript = async (targetStatus: 'Draft' | 'In Press' | 'Published') => {
    if (!title.trim()) {
      setStatusBanner('Please provide a publication / manuscript title.');
      return;
    }
    setSaving(true);
    setStatusBanner(null);
    try {
      const payload = {
        title: title.trim(),
        outputType,
        projectId: projectId || null,
        leadScientistId: editingOutput?.leadScientistId || currentUser.id,
        journalOrEvent: journalOrEvent.trim(),
        doi: doi.trim(),
        url: url.trim(),
        publicationDate,
        abstract: abstract.trim(),
        manuscriptBody,
        keywords: keywords.trim(),
        fileUrl: fileUrl || null,
        status: targetStatus,
        authorUserIds: coAuthorIds.length > 0 ? coAuthorIds : [currentUser.id],
      };

      if (editingOutput) {
        await apiFetch(`/api/outputs/${editingOutput.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/outputs', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      await onRefresh();
      setMode('REPOSITORY');
    } catch (err: any) {
      setStatusBanner(err.message || 'Failed to save publication manuscript.');
    } finally {
      setSaving(false);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredOutputs = data.researchOutputs.filter(
    (o) =>
      !q ||
      o.title.toLowerCase().includes(q) ||
      (o.keywords || '').toLowerCase().includes(q) ||
      (o.journalOrEvent || '').toLowerCase().includes(q) ||
      o.outputType.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-sky-700 dark:text-sky-400">
            <BookOpen className="w-4 h-4" />
            <span>KMFRI SCIENTIFIC MANUSCRIPT &amp; PUBLICATIONS STUDIO</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
            Write Publications, Peer-Reviewed Papers &amp; Datasets ({data.researchOutputs.length})
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Compose full multi-section manuscripts, manage co-authors, save drafts, publish to the KMFRI repository, and share papers directly in the Scientist Chatbox.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-slate-200/80 dark:bg-slate-800 border border-slate-300/60 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setMode('REPOSITORY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                mode === 'REPOSITORY'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Publications Repository ({data.researchOutputs.length})
            </button>
            {!isViewer && (
              <button
                type="button"
                onClick={openEditorForNew}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  mode === 'STUDIO'
                    ? 'bg-sky-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Write New Publication</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MODE 1: MANUSCRIPT AUTHORING STUDIO */}
      {mode === 'STUDIO' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 8-Column Full Manuscript Composer */}
          <div className="lg:col-span-8 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingOutput
                    ? `Editing Manuscript: ${editingOutput.title}`
                    : 'Compose New Scientific Manuscript'}
                </h2>
                <p className="text-xs text-slate-500">
                  Lead Author: {currentUser.fullName} ({currentUser.staffNumber})
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono text-slate-500">
                <span>{wordCount.toLocaleString()} words</span>
                <span>·</span>
                <span>~{readingMinutes} min read</span>
              </div>
            </div>

            {statusBanner && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200">
                {statusBanner}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Publication / Manuscript Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Spatio-Temporal Dynamics of Blue Carbon Sequestration in Gazi Bay Mangrove Ecosystems, Kenya"
                  className="w-full px-3.5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Executive Abstract
                </label>
                <textarea
                  rows={4}
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
                  placeholder="Provide a structured 150-300 word scientific abstract summarizing background, hydrographic/ecological methods, key quantitative results, and policy conclusions..."
                  className="w-full px-3.5 py-2.5 text-xs leading-relaxed rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Full Manuscript Body (Introduction, Methodology, Results, Discussion &amp; References)
                  </label>
                  <button
                    type="button"
                    onClick={() => setManuscriptBody(SCIENTIFIC_MANUSCRIPT_TEMPLATE)}
                    className="text-[11px] font-medium text-sky-700 dark:text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Reset to Standard WIOJMS Template</span>
                  </button>
                </div>
                <textarea
                  rows={16}
                  value={manuscriptBody}
                  onChange={(e) => setManuscriptBody(e.target.value)}
                  className="w-full px-4 py-3 text-xs font-mono leading-relaxed rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setMode('REPOSITORY')}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveManuscript('Draft')}
                  className="px-4 py-2 rounded-xl border border-sky-600/40 bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Save as Draft</span>
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveManuscript('In Press')}
                  className="px-4 py-2 rounded-xl border border-teal-600/40 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 text-xs font-semibold"
                >
                  Submit In Press
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveManuscript('Published')}
                  className="px-5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Publish to KMFRI Repository'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right 4-Column Metadata, Co-Authors & Attachment Panel */}
          <div className="lg:col-span-4 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-xs h-fit">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2.5">
              Publication Metadata &amp; Co-Authors
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Output Classification
              </label>
              <select
                value={outputType}
                onChange={(e) => setOutputType(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="Peer-Reviewed Publication">Peer-Reviewed Journal Article</option>
                <option value="Technical Report">KMFRI Technical Report</option>
                <option value="Oceanographic Dataset">Oceanographic / Fisheries Dataset</option>
                <option value="Policy Brief">Blue Economy Policy Brief</option>
                <option value="Conference Presentation">Symposium / Conference Paper</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Linked Research Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="">Institutional / General KMFRI Output</option>
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode} — {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Journal, Publisher or Symposium
              </label>
              <input
                type="text"
                value={journalOrEvent}
                onChange={(e) => setJournalOrEvent(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  DOI Identifier
                </label>
                <input
                  type="text"
                  value={doi}
                  onChange={(e) => setDoi(e.target.value)}
                  placeholder="10.4314/wiojms..."
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Publication Date
                </label>
                <input
                  type="date"
                  value={publicationDate}
                  onChange={(e) => setPublicationDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Scientific Keywords (comma-separated)
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Attach PDF / Figure Image from Device
              </label>
              <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-sky-500/50 bg-sky-50/40 dark:bg-sky-950/30 text-xs font-medium text-sky-700 dark:text-sky-300 cursor-pointer hover:bg-sky-50">
                <Upload className="w-3.5 h-3.5" />
                <span>{fileUrl ? 'Attachment Ready (Click to Replace)' : 'Upload PDF / Figure Image'}</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.csv"
                  onChange={handleAttachmentFileSelect}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Co-Authors ({coAuthorIds.length} selected)
              </label>
              <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                {data.users.map((u) => {
                  const checked = coAuthorIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 text-xs py-1 px-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setCoAuthorIds((prev) =>
                            checked
                              ? prev.filter((id) => id !== u.id)
                              : [...prev, u.id]
                          );
                        }}
                      />
                      <span className="truncate font-medium">{u.fullName}</span>
                      <span className="text-[10px] font-mono text-slate-400 ml-auto">
                        {u.staffNumber}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: MANUSCRIPT READER & PRINTABLE VIEW */}
      {mode === 'READER' && readingOutput && (
        <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 no-print">
            <button
              type="button"
              onClick={() => setMode('REPOSITORY')}
              className="text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline"
            >
              ← Back to Publications Repository
            </button>
            <div className="flex items-center gap-2">
              {onShareToChat && (
                <button
                  type="button"
                  onClick={() => onShareToChat(readingOutput)}
                  className="px-3 py-1.5 rounded-lg border border-teal-500/40 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share in Scientist Chatbox</span>
                </button>
              )}
              {!isViewer && (
                <button
                  type="button"
                  onClick={() => openEditorForExisting(readingOutput)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Manuscript</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Export PDF</span>
              </button>
            </div>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            <div className="space-y-2">
              <div className="text-xs font-mono font-semibold text-sky-700 dark:text-sky-400">
                {readingOutput.outputType.toUpperCase()} · {readingOutput.publicationDate} ·{' '}
                {readingOutput.status.toUpperCase()}
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
                {readingOutput.title}
              </h2>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                <strong>Journal / Venue:</strong> {readingOutput.journalOrEvent || 'KMFRI Institutional Press'}
                {readingOutput.doi ? ` · DOI: ${readingOutput.doi}` : ''}
              </div>
              {readingOutput.keywords && (
                <div className="text-xs text-teal-700 dark:text-teal-400 font-mono">
                  Keywords: {readingOutput.keywords}
                </div>
              )}
            </div>

            {readingOutput.abstract && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Abstract
                </div>
                <p className="text-xs md:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  {readingOutput.abstract}
                </p>
              </div>
            )}

            <div className="prose dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                {readingOutput.manuscriptBody ||
                  'No extended manuscript body recorded for this publication yet. Click "Edit Manuscript" above to compose full sections.'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: PUBLICATIONS REPOSITORY LIST */}
      {mode === 'REPOSITORY' && (
        <div className="space-y-3">
          {filteredOutputs.length === 0 ? (
            <div className="p-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-3">
              <FileText className="w-10 h-10 text-sky-700 dark:text-sky-400 mx-auto" />
              <div className="text-base font-bold text-slate-900 dark:text-white">
                No Publications or Manuscripts Recorded Yet
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click &ldquo;Write New Publication&rdquo; to open the KMFRI Manuscript Authoring Studio and write your first scientific paper, policy brief, or technical report.
              </p>
              {!isViewer && (
                <button
                  type="button"
                  onClick={openEditorForNew}
                  className="px-4 py-2 rounded-xl bg-sky-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Write New Publication</span>
                </button>
              )}
            </div>
          ) : (
            filteredOutputs.map((out) => {
              const lead = data.users.find((u) => u.id === out.leadScientistId);
              const proj = data.projects.find((p) => p.id === out.projectId);
              const authors = data.outputAuthors
                .filter((oa) => oa.outputId === out.id)
                .sort((a, b) => a.authorOrder - b.authorOrder)
                .map((oa) => data.users.find((u) => u.id === oa.userId)?.fullName)
                .filter(Boolean);

              return (
                <div
                  key={out.id}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-start justify-between gap-4 hover:border-sky-500/40 transition-colors"
                >
                  <div className="space-y-1.5 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-sky-700 dark:text-sky-400">
                        {out.outputType}
                      </span>
                      <span>·</span>
                      <span className="font-mono text-slate-500">{out.publicationDate}</span>
                      <span>·</span>
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        {out.journalOrEvent || 'KMFRI Institutional Repository'}
                      </span>
                    </div>

                    <h3
                      onClick={() => {
                        setReadingOutput(out);
                        setMode('READER');
                      }}
                      className="text-base font-bold text-slate-900 dark:text-white hover:text-sky-700 dark:hover:text-sky-400 cursor-pointer"
                    >
                      {out.title}
                    </h3>

                    {out.abstract && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {out.abstract}
                      </p>
                    )}

                    <div className="text-xs text-slate-500 pt-1">
                      <strong>Authors:</strong>{' '}
                      {authors.length > 0
                        ? authors.join(', ')
                        : lead?.fullName || 'KMFRI Research Team'}
                      {proj ? ` · Project: ${proj.projectCode}` : ''}
                      {out.doi ? ` · DOI: ${out.doi}` : ''}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`text-xs font-mono font-semibold ${
                        out.status === 'Published'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : out.status === 'Draft'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-sky-600 dark:text-sky-400'
                      }`}
                    >
                      {out.status}
                    </span>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setReadingOutput(out);
                          setMode('READER');
                        }}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:border-sky-500"
                      >
                        Read Manuscript
                      </button>

                      {onShareToChat && (
                        <button
                          type="button"
                          onClick={() => onShareToChat(out)}
                          className="px-2.5 py-1 rounded-lg border border-teal-500/40 text-teal-700 dark:text-teal-400 text-xs font-medium flex items-center gap-1"
                          title="Share Manuscript in Scientist Chatbox"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>Share</span>
                        </button>
                      )}

                      {!isViewer && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditorForExisting(out)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-sky-600"
                            title="Edit Manuscript"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/outputs/${out.id}`, {
                                method: 'DELETE',
                              });
                              await onRefresh();
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600"
                            title="Delete Output"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {out.fileUrl && (
                        <a
                          href={out.fileUrl}
                          download={`${out.title.slice(0, 32)}.pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sky-700 dark:text-sky-400"
                          title="Open / Download Attachment"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
