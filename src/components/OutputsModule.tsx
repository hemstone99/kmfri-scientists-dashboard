import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  BookOpen,
  Download,
  Edit3,
  ExternalLink,
  FileEdit,
  Image as ImageIcon,
  MessageSquareShare,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  outputFormSchema,
  OutputType,
  ResearchOutput,
} from '../types/kmfri.ts';
import { exportToCSV, exportToExcel, exportToInstitutionalReportHTML } from '../utils/exportUtils.ts';
import { UserAvatar } from './UserAvatar.tsx';

type OutputFormValues = z.infer<typeof outputFormSchema>;

const DEFAULT_MANUSCRIPT_TEMPLATE = `## 1. Introduction & Background
State the marine or freshwater research problem, Western Indian Ocean or Kenyan inland water context, and study objectives.

## 2. Materials & Study Area (GIS Stations)
Describe the sampling stations, RV Mtafiti cruise transects or laboratory analytical methods, and study dates.

## 3. Results & Key Findings
Summarize hydrographic, ecological, stock assessment, or socio-economic observations and statistical outcomes.

## 4. Discussion & Policy Implications
Discuss findings in relation to Blue Economy governance, ecosystem conservation, and sustainable fisheries management.

## 5. References
1. KMFRI Technical Report Series (2026).`;

export function OutputsModule() {
  const {
    db,
    user,
    apiFetch,
    refreshData,
    shareToLiveChat,
    showToast,
  } = useAuth();

  const [activeSubView, setActiveSubView] = useState<'registry' | 'studio'>('registry');
  const [editingOutput, setEditingOutput] = useState<ResearchOutput | null>(null);
  const [readingOutput, setReadingOutput] = useState<ResearchOutput | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [formError, setFormError] = useState<string | null>(null);
  const [coAuthors, setCoAuthors] = useState<Array<{ name: string; affiliation: string }>>([]);
  const [manuscriptBody, setManuscriptBody] = useState<string>(DEFAULT_MANUSCRIPT_TEMPLATE);
  const [figureUrls, setFigureUrls] = useState<string[]>([]);
  const [aiDrafting, setAiDrafting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OutputFormValues>({
    resolver: zodResolver(outputFormSchema),
    defaultValues: {
      title: '',
      output_type: OutputType.PUBLICATION,
      project_id: '',
      lead_scientist_id: '',
      journal_or_event: '',
      doi_or_url: '',
      publication_date: new Date().toISOString().split('T')[0],
      abstract: '',
      keywords_text: '',
      status: 'Published',
    },
  });

  const watchedTitle = watch('title');
  const watchedAbstract = watch('abstract');

  const filteredOutputs = useMemo(() => {
    if (!db) return [];
    return db.research_outputs.filter((o) => {
      if (typeFilter !== 'all' && o.output_type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          o.title.toLowerCase().includes(q) ||
          o.journal_or_event.toLowerCase().includes(q) ||
          o.abstract.toLowerCase().includes(q) ||
          o.keywords.some((k) => k.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [db, typeFilter, searchQuery]);

  if (!db) return null;

  const operationalScientists = db.users.filter((u) => u.is_operational_scientist);
  const selectableScientists =
    operationalScientists.length > 0 ? operationalScientists : db.users;

  const openNewPublicationStudio = () => {
    setEditingOutput(null);
    setFormError(null);
    setCoAuthors([]);
    setManuscriptBody(DEFAULT_MANUSCRIPT_TEMPLATE);
    setFigureUrls([]);
    reset({
      title: '',
      output_type: OutputType.PUBLICATION,
      project_id: db.projects[0]?.id || '',
      lead_scientist_id: user?.id || selectableScientists[0]?.id || '',
      journal_or_event: 'Western Indian Ocean Journal of Marine Science (WIOJMS)',
      doi_or_url: '',
      publication_date: new Date().toISOString().split('T')[0],
      abstract: '',
      keywords_text: 'Marine Ecology, Western Indian Ocean, KMFRI, Blue Economy',
      status: 'Draft',
    });
    setActiveSubView('studio');
  };

  const openEditPublicationStudio = (out: ResearchOutput) => {
    setEditingOutput(out);
    setFormError(null);
    const existingCo = db.output_authors
      .filter((oa) => oa.output_id === out.id && oa.author_order > 1)
      .sort((a, b) => a.author_order - b.author_order)
      .map((oa) => ({ name: oa.external_author_name, affiliation: oa.affiliation }));
    setCoAuthors(existingCo);
    setManuscriptBody(out.manuscript_body || DEFAULT_MANUSCRIPT_TEMPLATE);
    setFigureUrls(out.figure_urls || []);
    reset({
      title: out.title,
      output_type: out.output_type,
      project_id: out.project_id || '',
      lead_scientist_id: out.lead_scientist_id,
      journal_or_event: out.journal_or_event,
      doi_or_url: out.doi_or_url,
      publication_date: out.publication_date,
      abstract: out.abstract,
      keywords_text: out.keywords.join(', '),
      status: out.status,
    });
    setActiveSubView('studio');
  };

  const handleFigureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('Figure image must be under 10 MB', 'error');
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(file);
      });
      setFigureUrls((prev) => [...prev, dataUrl]);
      showToast('Attached figure image to manuscript');
    } catch {
      showToast('Failed to load figure image', 'error');
    }
  };

  const handleAiAssistManuscript = async () => {
    if (!watchedTitle.trim()) {
      showToast('Enter a publication title first so the AI Assistant can generate relevant content.', 'info');
      return;
    }
    setAiDrafting(true);
    try {
      const res = await apiFetch<{ reply: string }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'search',
          messages: [
            {
              role: 'user',
              text: `I am a KMFRI scientist writing a research publication titled "${watchedTitle}".
Current abstract notes: "${watchedAbstract || 'Not yet written'}".
Please provide:
1) A concise, rigorous 150-word scientific abstract.
2) Structured manuscript sections (Introduction, Materials & Methods in Kenya/WIO context, Key Expected Results, Policy Implications, and 3 real peer-reviewed literature references).`,
            },
          ],
        }),
      });
      if (!watchedAbstract.trim()) {
        setValue(
          'abstract',
          `Scientific investigation of ${watchedTitle} conducted under the Kenya Marine and Fisheries Research Institute (KMFRI) mandate.`
        );
      }
      setManuscriptBody((prev) => `${prev}\n\n---\n### AI Literature & Manuscript Draft Suggestions\n${res.reply}`);
      showToast('Inserted AI-grounded manuscript sections and literature notes!');
    } catch (err: any) {
      showToast(err.message || 'AI Assistant request failed', 'error');
    } finally {
      setAiDrafting(false);
    }
  };

  const onSubmitOutput = async (values: OutputFormValues) => {
    setFormError(null);
    try {
      if (editingOutput) {
        await apiFetch(`/outputs/${editingOutput.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...values,
            manuscript_body: manuscriptBody,
            figure_urls: figureUrls,
            co_authors: coAuthors.filter((c) => c.name.trim()),
          }),
        });
        showToast(`Updated publication "${values.title}"`);
      } else {
        await apiFetch('/outputs', {
          method: 'POST',
          body: JSON.stringify({
            ...values,
            manuscript_body: manuscriptBody,
            figure_urls: figureUrls,
            co_authors: coAuthors.filter((c) => c.name.trim()),
          }),
        });
        showToast(`Saved ${values.output_type}: "${values.title}"`);
      }
      await refreshData();
      setActiveSubView('registry');
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleDeleteOutput = async (out: ResearchOutput) => {
    try {
      await apiFetch(`/outputs/${out.id}`, { method: 'DELETE' });
      await refreshData();
      showToast(`Deleted "${out.title}"`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleExportOutputs = (format: 'csv' | 'excel' | 'pdf') => {
    const rows = filteredOutputs.map((o) => {
      const lead = db.users.find((u) => u.id === o.lead_scientist_id);
      const authors = db.output_authors
        .filter((oa) => oa.output_id === o.id)
        .sort((a, b) => a.author_order - b.author_order)
        .map((oa) => `${oa.author_order}. ${oa.external_author_name}`)
        .join('; ');
      return {
        Title: o.title,
        Type: o.output_type,
        Lead_Scientist: lead ? `${lead.title} ${lead.full_name}` : '—',
        Authors_Ordered: authors,
        Journal_Or_Event: o.journal_or_event,
        Publication_Date: o.publication_date,
        DOI_URL: o.doi_or_url || '—',
        Status: o.status,
      };
    });
    if (format === 'csv') exportToCSV('kmfri_research_outputs', rows);
    if (format === 'excel') exportToExcel('kmfri_research_outputs', 'Outputs', rows);
    if (format === 'pdf') {
      exportToInstitutionalReportHTML(
        'kmfri_research_outputs',
        'KMFRI Peer-Reviewed Publications, Datasets & Research Outputs',
        `Generated by ${user?.full_name}`,
        rows
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            Publications Authoring Studio, Research Outputs &amp; Datasets
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Write and co-author full scientific manuscripts, attach figures, use AI literature grounding, and share publications across the platform
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubView('registry')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
              activeSubView === 'registry'
                ? 'bg-[#0A2540] dark:bg-sky-600 text-white'
                : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Publications Registry ({db.research_outputs.length})</span>
          </button>

          <button
            type="button"
            onClick={openNewPublicationStudio}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
              activeSubView === 'studio'
                ? 'bg-teal-600 text-white'
                : 'bg-[#0A2540] dark:bg-sky-600 text-white'
            }`}
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Write New Publication / Manuscript</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* VIEW 1: DEDICATED SCIENTIFIC PUBLICATION WRITING STUDIO               */}
      {/* ===================================================================== */}
      {activeSubView === 'studio' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-teal-600" />
                <span>
                  {editingOutput
                    ? `Editing Publication: ${editingOutput.title}`
                    : 'KMFRI Scientific Manuscript & Publication Authoring Studio'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Draft full peer-reviewed articles, technical reports, or datasets with ordered co-authors and embedded figures
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={aiDrafting}
                onClick={handleAiAssistManuscript}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#0A2540] to-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {aiDrafting ? 'Generating with Gemini Search...' : 'AI Draft & Literature Assist'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubView('registry')}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
              >
                Back to Registry
              </button>
            </div>
          </div>

          {formError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 text-xs text-rose-700">{formError}</div>
          )}

          <form onSubmit={handleSubmit(onSubmitOutput)} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Publication / Manuscript Title *</label>
                <input
                  type="text"
                  {...register('title')}
                  placeholder="Blue Carbon Sequestration and Sediment Accretion Rates in Gazi Bay Mangroves, Kenya"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-medium"
                />
                {errors.title && <p className="text-rose-600 mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <label className="block font-semibold mb-1">Output Type *</label>
                <select
                  {...register('output_type')}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  {Object.values(OutputType).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold mb-1">Lead Scientist (Author #1) *</label>
                <select
                  {...register('lead_scientist_id')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  {selectableScientists.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} {s.full_name} ({s.staff_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Linked Research Project</label>
                <select
                  {...register('project_id')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="">Institutional / General Research</option>
                  {db.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.project_code} — {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Workflow Status *</label>
                <select
                  {...register('status')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="Draft">Draft Manuscript</option>
                  <option value="Under Peer Review">Under Peer Review</option>
                  <option value="Published">Published</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold mb-1">
                  Target Journal / Conference / Repository *
                </label>
                <input
                  type="text"
                  {...register('journal_or_event')}
                  placeholder="Western Indian Ocean Journal of Marine Science"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">DOI or Repository URL</label>
                <input
                  type="text"
                  {...register('doi_or_url')}
                  placeholder="10.4314/wiojms.v25i1.4"
                  className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Publication / Draft Date *</label>
                <input
                  type="date"
                  {...register('publication_date')}
                  className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>

            {/* Ordered Co-Authors Builder */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  Ordered Co-Authors (Author #2, #3, ...)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCoAuthors((prev) => [...prev, { name: '', affiliation: 'KMFRI' }])
                  }
                  className="text-sky-700 dark:text-sky-400 font-semibold hover:underline"
                >
                  + Add Co-Author
                </button>
              </div>
              {coAuthors.map((co, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <span className="font-mono text-slate-400">#{idx + 2}</span>
                  <input
                    type="text"
                    placeholder="Co-author full name"
                    value={co.name}
                    onChange={(e) => {
                      const next = [...coAuthors];
                      next[idx].name = e.target.value;
                      setCoAuthors(next);
                    }}
                    className="flex-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <input
                    type="text"
                    placeholder="Affiliation"
                    value={co.affiliation}
                    onChange={(e) => {
                      const next = [...coAuthors];
                      next[idx].affiliation = e.target.value;
                      setCoAuthors(next);
                    }}
                    className="flex-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setCoAuthors(coAuthors.filter((_, i) => i !== idx))}
                    className="text-rose-600 self-end sm:self-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Abstract */}
            <div>
              <label className="block font-semibold mb-1">Executive Abstract *</label>
              <textarea
                rows={3}
                {...register('abstract')}
                placeholder="Summarize the background, sampling methodology, primary findings, and conservation or policy implications..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              {errors.abstract && (
                <p className="text-rose-600 mt-1">{errors.abstract.message}</p>
              )}
            </div>

            {/* Full Manuscript Editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold">
                  Full Publication Manuscript Body (Markdown Supported)
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {manuscriptBody.length} characters
                </span>
              </div>
              <textarea
                rows={12}
                value={manuscriptBody}
                onChange={(e) => setManuscriptBody(e.target.value)}
                className="w-full px-4 py-3 font-mono text-xs leading-relaxed rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            {/* Figures & Scientific Images Uploader */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-teal-600" />
                  <span className="font-semibold">
                    Manuscript Figures, Charts &amp; Field Imagery ({figureUrls.length})
                  </span>
                </div>
                <label className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer hover:border-sky-500">
                  + Attach Figure Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFigureUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {figureUrls.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {figureUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-black h-28"
                    >
                      <img
                        src={url}
                        alt={`Figure ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFigureUrls((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600 text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <span className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono">
                        Fig. {idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold mb-1">Keywords (comma-separated)</label>
              <input
                type="text"
                {...register('keywords_text')}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveSubView('registry')}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white font-semibold"
              >
                {editingOutput ? 'Update Publication' : 'Save & Catalogue Publication'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 2: PUBLICATIONS & RESEARCH OUTPUTS REGISTRY                      */}
      {/* ===================================================================== */}
      {activeSubView === 'registry' && (
        <>
          {/* Filters & Export Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row gap-3 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, journal, DOI, or keyword..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', ...Object.values(OutputType)] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    typeFilter === t
                      ? 'bg-[#0A2540] dark:bg-sky-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t === 'all' ? 'All Output Types' : `${t}s`}
                </button>
              ))}

              <button
                type="button"
                onClick={() => handleExportOutputs('csv')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportOutputs('pdf')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>
          </div>

          {/* Outputs List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {filteredOutputs.length === 0 ? (
              <div className="py-14 px-6 text-center">
                <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  No Publications or Research Outputs Yet
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                  Write full scientific manuscripts, catalogue peer-reviewed publications, or share oceanographic datasets with ordered author lists.
                </p>
                <button
                  type="button"
                  onClick={openNewPublicationStudio}
                  className="px-4 py-2 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Write First Publication</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredOutputs.map((out) => {
                  const proj = db.projects.find((p) => p.id === out.project_id);
                  const lead = db.users.find((u) => u.id === out.lead_scientist_id);
                  const authors = db.output_authors
                    .filter((oa) => oa.output_id === out.id)
                    .sort((a, b) => a.author_order - b.author_order);

                  return (
                    <div
                      key={out.id}
                      className="p-4 sm:p-5 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-sky-700 dark:text-sky-400">
                          <span className="px-2 py-0.5 rounded bg-sky-500/10 font-bold">
                            {out.output_type}
                          </span>
                          <span>·</span>
                          <span>{out.status}</span>
                          <span>·</span>
                          <span>{out.publication_date}</span>
                          {proj && (
                            <>
                              <span>·</span>
                              <span>Project: {proj.project_code}</span>
                            </>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReadingOutput(out)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            Read Manuscript
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditPublicationStudio(out)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              shareToLiveChat({
                                id: `pub-${out.id}`,
                                type: 'publication',
                                title: out.title,
                                reference_id: out.id,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-teal-600 text-white text-xs font-semibold flex items-center gap-1"
                          >
                            <MessageSquareShare className="w-3 h-3" />
                            <span>Share to Chat</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOutput(out)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Delete output"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        {out.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                        {lead && (
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <UserAvatar user={lead} size="xs" />
                            <span>
                              Lead: {lead.title} {lead.full_name}
                            </span>
                          </span>
                        )}
                        <span>
                          <strong>Journal / Venue:</strong> {out.journal_or_event}
                        </span>
                        {out.doi_or_url && (
                          <span className="font-mono text-teal-600 flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            <span>{out.doi_or_url}</span>
                          </span>
                        )}
                      </div>

                      {/* Ordered Multi-Author List */}
                      <div className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Authors (Ordered):{' '}
                        </span>
                        {authors.map((a, idx) => (
                          <span key={a.id}>
                            [{a.author_order}] {a.external_author_name} ({a.affiliation})
                            {idx < authors.length - 1 ? ' · ' : ''}
                          </span>
                        ))}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {out.abstract}
                      </p>

                      {out.figure_urls && out.figure_urls.length > 0 && (
                        <div className="flex items-center gap-2 pt-1 overflow-x-auto">
                          {out.figure_urls.map((fig, fIdx) => (
                            <img
                              key={fIdx}
                              src={fig}
                              alt={`Fig ${fIdx + 1}`}
                              className="h-16 w-24 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                            />
                          ))}
                        </div>
                      )}

                      {out.keywords.length > 0 && (
                        <div className="text-[11px] font-mono text-slate-400">
                          Keywords: {out.keywords.join(' · ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Full Manuscript Reader Modal */}
      {readingOutput && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 my-8 max-h-[88vh] flex flex-col">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-xs font-mono text-sky-600">
                  {readingOutput.output_type} · {readingOutput.status} ·{' '}
                  {readingOutput.publication_date}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {readingOutput.title}
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  {readingOutput.journal_or_event}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReadingOutput(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-white mb-1">Abstract</div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {readingOutput.abstract}
                </p>
              </div>

              {readingOutput.manuscript_body && (
                <div className="space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white">
                    Full Manuscript Text
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200 font-sans">
                    {readingOutput.manuscript_body}
                  </div>
                </div>
              )}

              {readingOutput.figure_urls && readingOutput.figure_urls.length > 0 && (
                <div className="space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white">
                    Attached Figures ({readingOutput.figure_urls.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {readingOutput.figure_urls.map((url, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800"
                      >
                        <img
                          src={url}
                          alt={`Figure ${idx + 1}`}
                          className="w-full h-48 object-cover"
                        />
                        <div className="p-2 text-[11px] font-mono text-slate-500">
                          Figure {idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  const target = readingOutput;
                  setReadingOutput(null);
                  openEditPublicationStudio(target);
                }}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold"
              >
                Edit Manuscript
              </button>
              <button
                type="button"
                onClick={() => {
                  shareToLiveChat({
                    id: `pub-${readingOutput.id}`,
                    type: 'publication',
                    title: readingOutput.title,
                    reference_id: readingOutput.id,
                  });
                  setReadingOutput(null);
                }}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold flex items-center gap-1.5"
              >
                <MessageSquareShare className="w-3.5 h-3.5" />
                <span>Share to Live Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
