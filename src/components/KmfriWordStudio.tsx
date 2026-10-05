import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  BookOpen,
  Check,
  ChevronDown,
  Columns,
  Copy,
  Download,
  Eye,
  FileCheck,
  FileDown,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  HelpCircle,
  Highlighter,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Lock,
  Maximize2,
  MessageSquare,
  Minimize2,
  Paperclip,
  Printer,
  Quote,
  Redo2,
  Save,
  Share2,
  Sigma,
  Sparkles,
  Strikethrough,
  Table as TableIcon,
  Underline,
  Unlock,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import { DocumentRecord, UserProfile } from '../types/kmfri.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import { KmfriLogo } from './KmfriLogo.tsx';

interface KmfriWordStudioProps {
  document: DocumentRecord;
  onClose: () => void;
  onSave: (updatedDoc: Partial<DocumentRecord>) => Promise<void>;
}

interface DocComment {
  id: string;
  author_name: string;
  author_avatar?: string;
  created_at: string;
  text: string;
  resolved: boolean;
}

export const KmfriWordStudio: React.FC<KmfriWordStudioProps> = ({
  document: doc,
  onClose,
  onSave,
}) => {
  const { user, onlineUserIds, db, showToast } = useAuth();

  // Active Ribbon Tab
  const [activeTab, setActiveTab] = useState<'home' | 'insert' | 'review' | 'view' | 'file'>('home');

  // Document metadata
  const [docTitle, setDocTitle] = useState(doc.title);
  const [content, setContent] = useState(
    doc.word_content ||
      `<h1>${doc.title}</h1>\n<p class="subtitle">Kenya Marine and Fisheries Research Institute (KMFRI) · Technical Research Manuscript</p>\n<hr/>\n<h2>1. Executive Summary</h2>\n<p>This technical report documents coastal oceanographic and fisheries assessment observations undertaken under KMFRI research governance protocols in accordance with the Kenya Blue Economy strategic framework.</p>\n<h2>2. Objectives &amp; Study Area</h2>\n<p>Research surveys were conducted within the Kenyan Exclusive Economic Zone (EEZ) and coastal fringing reef systems. Hydrographic stations recorded temperature, salinity, chlorophyll-a, and benthic substrate coverage.</p>\n<div class="callout-box"><strong>Key Finding:</strong> Preliminary CTD casts reveal strong seasonal thermocline stratification influenced by the East African Coastal Current (EACC).</div>\n<h2>3. Marine Data &amp; Observations</h2>\n<table class="scientific-table">\n<thead><tr><th>Station ID</th><th>Latitude (°S)</th><th>Longitude (°E)</th><th>Depth (m)</th><th>Salinity (PSU)</th></tr></thead>\n<tbody>\n<tr><td>KMFRI-STN-01</td><td>-4.0583</td><td>39.6833</td><td>28.5</td><td>35.2</td></tr>\n<tr><td>KMFRI-STN-02</td><td>-4.6472</td><td>39.3811</td><td>42.0</td><td>35.4</td></tr>\n<tr><td>KMFRI-STN-03</td><td>-3.2215</td><td>40.1264</td><td>18.0</td><td>34.9</td></tr>\n</tbody>\n</table>\n<h2>4. Conclusion &amp; Management Recommendations</h2>\n<p>Continued long-term acoustic and visual census surveys are recommended to sustain national marine spatial planning and artisanal fisherfolk livelihoods.</p>`
  );

  // Formatting state
  const [fontFamily, setFontFamily] = useState('Calibri');
  const [fontSize, setFontSize] = useState('11');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>('Just now');
  const [trackChanges, setTrackChanges] = useState(false);
  const [showCommentsSidebar, setShowCommentsSidebar] = useState(true);

  // Comments
  const [comments, setComments] = useState<DocComment[]>([
    {
      id: 'c-1',
      author_name: 'Dr. James Kairo, OGW',
      created_at: '10:45 AM',
      text: 'Please confirm whether the Gazi Bay CTD depth casts were calibrated with the Shimoni acoustic tide gauge.',
      resolved: false,
    },
    {
      id: 'c-2',
      author_name: 'Dr. Amina Mohamed',
      created_at: 'Yesterday',
      text: 'Section 3 Table aligns with Western Indian Ocean Marine Science Association (WIOMSA) reporting standards.',
      resolved: true,
    },
  ]);
  const [newCommentText, setNewCommentText] = useState('');

  // Co-authors currently in document
  const coAuthors = useMemo(() => {
    if (!db) return [];
    return db.users.filter((u) => u.id !== user?.id && onlineUserIds.includes(u.id)).slice(0, 3);
  }, [db, user, onlineUserIds]);

  const editorRef = useRef<HTMLDivElement | null>(null);

  // Calculate live statistics
  const stats = useMemo(() => {
    const textOnly = content.replace(/<[^>]*>/g, ' ');
    const words = textOnly.trim().split(/\s+/).filter(Boolean).length;
    const characters = textOnly.length;
    const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, characters, readingTimeMinutes };
  }, [content]);

  // Execute formatting command on rich text editor
  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
    }
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
    }
  };

  const handleSaveDocument = async (isNewVersion: boolean = false) => {
    setIsSaving(true);
    try {
      const nextVersion = isNewVersion ? Number((doc.version + 0.1).toFixed(1)) : doc.version;
      const history = doc.version_history || [];
      const updatedHistory = isNewVersion
        ? [
            ...history,
            {
              version: nextVersion,
              updated_at: new Date().toISOString(),
              updated_by_name: user ? `${user.title} ${user.full_name}` : 'Scientist',
              summary: `Co-authoring revision saved by ${user?.full_name}`,
            },
          ]
        : history;

      await onSave({
        title: docTitle,
        word_content: content,
        version: nextVersion,
        version_history: updatedHistory,
      });

      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      showToast(isNewVersion ? `Saved as new revision v${nextVersion}` : 'Changes saved to KMFRI Cloud');
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    const newC: DocComment = {
      id: `c-${Date.now()}`,
      author_name: user ? `${user.title} ${user.full_name}` : 'Researcher',
      created_at: 'Just now',
      text: newCommentText.trim(),
      resolved: false,
    };
    setComments([newC, ...comments]);
    setNewCommentText('');
    showToast('Peer review comment added to document margin');
  };

  const toggleResolveComment = (id: string) => {
    setComments(
      comments.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c))
    );
  };

  const insertScientificTable = () => {
    const tableHtml = `
      <table class="scientific-table">
        <thead>
          <tr><th>Parameter</th><th>Sampling Unit</th><th>Baseline</th><th>Current Finding</th></tr>
        </thead>
        <tbody>
          <tr><td>Sea Surface Temp (SST)</td><td>°Celsius</td><td>26.4</td><td>28.1</td></tr>
          <tr><td>Dissolved Oxygen</td><td>mg/L</td><td>6.8</td><td>6.5</td></tr>
          <tr><td>Turbidity</td><td>NTU</td><td>1.2</td><td>2.4</td></tr>
        </tbody>
      </table>
      <p><br/></p>
    `;
    execCmd('insertHTML', tableHtml);
  };

  const insertCalloutBox = () => {
    const calloutHtml = `
      <div class="callout-box">
        <strong>Scientific Notice:</strong> Data verified according to UNESCO IOC / KMFRI Oceanographic Standard Operating Procedures.
      </div>
      <p><br/></p>
    `;
    execCmd('insertHTML', calloutHtml);
  };

  const insertCitation = () => {
    const citationHtml = `
      <span class="citation-badge">[KMFRI-TechReport-2026-04; DOI: 10.1016/j.kmfri.2026.004]</span>
    `;
    execCmd('insertHTML', citationHtml);
  };

  const insertFormula = () => {
    const formulaHtml = `
      <div class="formula-box">
        <em>Biomass Index</em>: <strong>B = &sum; (N<sub>i</sub> &times; W<sub>i</sub>) &plusmn; &sigma; / &radic;n</strong>
      </div>
      <p><br/></p>
    `;
    execCmd('insertHTML', formulaHtml);
  };

  const handleExportDocx = () => {
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${docTitle}</title></head><body>`;
    const footer = `</body></html>`;
    const sourceHTML = header + content + footer;
    const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${docTitle.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported "${docTitle}.doc"`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col overflow-hidden text-slate-900 select-none">
      {/* 1. Word Studio Top Header (Classic Microsoft Word Blue Header) */}
      <header className="bg-[#185ABD] text-white px-4 py-2 flex items-center justify-between gap-3 shadow-md shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold font-serif text-white shrink-0 shadow-inner">
            W
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="bg-transparent text-white font-bold text-sm tracking-tight border-b border-transparent hover:border-white/50 focus:border-white focus:outline-none px-1 py-0.5 max-w-sm truncate"
                placeholder="Document Title..."
              />
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/20 text-white shrink-0">
                v{doc.version}
              </span>
              <span className="text-[10px] text-sky-200 hidden sm:inline">
                Saved: {lastSavedTime}
              </span>
            </div>
            <div className="text-[11px] text-sky-200/90 truncate">
              KMFRI Word Collaborative Studio · {doc.category}
            </div>
          </div>
        </div>

        {/* Right Header Actions: Co-authors, Save, Close */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live Co-author Avatars */}
          <div className="hidden sm:flex items-center -space-x-2 mr-2">
            {user && <UserAvatar user={user} size="xs" showOnline={true} isOnline={true} />}
            {coAuthors.map((ca: UserProfile) => (
              <UserAvatar key={ca.id} user={ca} size="xs" showOnline={true} isOnline={true} />
            ))}
            <span className="pl-3 text-[11px] text-sky-200 font-medium">
              {coAuthors.length + 1} collaborating
            </span>
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSaveDocument(false)}
            className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{isSaving ? 'Saving...' : 'Save'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveDocument(true)}
            className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-xs"
            title="Increment version revision and log to SharePoint version history"
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Save New Version</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
            title="Close Word Studio"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. Ribbon Tabs Row (File, Home, Insert, Review, View) */}
      <div className="bg-[#f3f4f6] dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 px-3 flex items-center gap-1 shrink-0 text-xs font-medium">
        {(
          [
            { id: 'home', label: 'Home' },
            { id: 'insert', label: 'Insert' },
            { id: 'review', label: 'Review' },
            { id: 'view', label: 'View' },
            { id: 'file', label: 'File & Export' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-3.5 py-2 border-b-2 font-semibold transition-colors ${
              activeTab === t.id
                ? 'border-[#185ABD] text-[#185ABD] bg-white dark:bg-slate-900 rounded-t'
                : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}

        <div className="ml-auto text-[11px] font-mono text-slate-500 hidden sm:block">
          {stats.words} words · {stats.characters} chars · {stats.readingTimeMinutes} min read
        </div>
      </div>

      {/* 3. Ribbon Toolbar Controls */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700 px-4 py-2 flex flex-wrap items-center gap-2 shrink-0 text-xs shadow-xs">
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="flex flex-wrap items-center gap-1.5 w-full">
            {/* Font Family & Size */}
            <select
              value={fontFamily}
              onChange={(e) => {
                setFontFamily(e.target.value);
                execCmd('fontName', e.target.value);
              }}
              className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs"
            >
              <option value="Calibri">Calibri</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
              <option value="'Inter', sans-serif">Inter</option>
              <option value="Arial">Arial</option>
              <option value="monospace">Courier New</option>
            </select>

            <select
              value={fontSize}
              onChange={(e) => {
                setFontSize(e.target.value);
                execCmd('fontSize', e.target.value === '18' ? '5' : e.target.value === '14' ? '4' : '3');
              }}
              className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs w-16"
            >
              <option value="10">10 pt</option>
              <option value="11">11 pt</option>
              <option value="12">12 pt</option>
              <option value="14">14 pt</option>
              <option value="18">18 pt</option>
              <option value="24">24 pt</option>
            </select>

            <span className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1" />

            {/* Basic Formatting Buttons */}
            <button
              type="button"
              onClick={() => execCmd('bold')}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
              title="Bold (Ctrl+B)"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('italic')}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 italic"
              title="Italic (Ctrl+I)"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('underline')}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 underline"
              title="Underline (Ctrl+U)"
            >
              <Underline className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('strikeThrough')}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Strikethrough"
            >
              <Strikethrough className="w-4 h-4" />
            </button>

            <span className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1" />

            {/* Paragraph Styles */}
            <button
              type="button"
              onClick={() => execCmd('formatBlock', '<h1>')}
              className="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 font-bold flex items-center gap-1"
              title="Heading 1"
            >
              <Heading1 className="w-3.5 h-3.5" />
              <span>H1</span>
            </button>
            <button
              type="button"
              onClick={() => execCmd('formatBlock', '<h2>')}
              className="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 font-bold flex items-center gap-1"
              title="Heading 2"
            >
              <Heading2 className="w-3.5 h-3.5" />
              <span>H2</span>
            </button>
            <button
              type="button"
              onClick={() => execCmd('formatBlock', '<h3>')}
              className="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 font-bold flex items-center gap-1"
              title="Heading 3"
            >
              <Heading3 className="w-3.5 h-3.5" />
              <span>H3</span>
            </button>
            <button
              type="button"
              onClick={() => execCmd('formatBlock', '<p>')}
              className="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Normal Paragraph"
            >
              Normal
            </button>

            <span className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1" />

            {/* Alignment */}
            <button
              type="button"
              onClick={() => execCmd('justifyLeft')}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Align Left"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('justifyCenter')}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Align Center"
            >
              <AlignCenter className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('justifyRight')}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Align Right"
            >
              <AlignRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('justifyFull')}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Justify"
            >
              <AlignJustify className="w-4 h-4" />
            </button>

            <span className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1" />

            {/* Lists */}
            <button
              type="button"
              onClick={() => execCmd('insertUnorderedList')}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Bulleted List"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('insertOrderedList')}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Numbered List"
            >
              <ListOrdered className="w-4 h-4" />
            </button>

            <span className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1" />

            {/* Undo / Redo */}
            <button
              type="button"
              onClick={() => execCmd('undo')}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('redo')}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* INSERT TAB */}
        {activeTab === 'insert' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={insertScientificTable}
              className="px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 hover:bg-sky-100 border border-sky-200 dark:border-sky-800 font-semibold flex items-center gap-1.5"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Scientific Data Table</span>
            </button>

            <button
              type="button"
              onClick={insertCalloutBox}
              className="px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 hover:bg-teal-100 border border-teal-200 dark:border-teal-800 font-semibold flex items-center gap-1.5"
            >
              <Quote className="w-3.5 h-3.5" />
              <span>Callout / Highlight Box</span>
            </button>

            <button
              type="button"
              onClick={insertCitation}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 font-semibold flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Citation / DOI Reference</span>
            </button>

            <button
              type="button"
              onClick={insertFormula}
              className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 font-semibold flex items-center gap-1.5"
            >
              <Sigma className="w-3.5 h-3.5" />
              <span>Equation / Biomass Formula</span>
            </button>

            <button
              type="button"
              onClick={() => execCmd('insertHorizontalRule')}
              className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100"
            >
              Page Divider
            </button>
          </div>
        )}

        {/* REVIEW TAB */}
        {activeTab === 'review' && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setTrackChanges(!trackChanges)}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                trackChanges
                  ? 'bg-emerald-600 text-white'
                  : 'border border-slate-300 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Track Changes: {trackChanges ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCommentsSidebar(!showCommentsSidebar)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 flex items-center gap-1.5 font-semibold"
            >
              <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
              <span>Comments Panel ({comments.length})</span>
            </button>
          </div>
        )}

        {/* VIEW TAB */}
        {activeTab === 'view' && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-slate-500 font-medium">Layout:</span>
            <span className="px-2.5 py-1 rounded bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 font-semibold">
              Standard A4 Scientific Print Layout (1-inch Margins)
            </span>
          </div>
        )}

        {/* FILE & EXPORT TAB */}
        {activeTab === 'file' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportDocx}
              className="px-3 py-1.5 rounded-lg bg-[#185ABD] text-white font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export as Word (.doc)</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold flex items-center gap-1.5 hover:bg-slate-100"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Export PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. Main Document Workspace (A4 Paper Surface + Comments Sidebar) */}
      <div className="flex-1 flex overflow-hidden bg-[#e5e7eb] dark:bg-slate-950 p-4 sm:p-6 justify-center">
        {/* Scrollable Canvas Container */}
        <div className="flex-1 overflow-y-auto flex justify-center pr-2">
          {/* A4 Paper Container */}
          <div className="w-full max-w-[850px] bg-white text-slate-900 shadow-2xl rounded-sm min-h-[1100px] p-10 sm:p-16 my-4 border border-slate-300 relative">
            {/* Institutional Watermark / Header */}
            <div className="flex items-center justify-between border-b-2 border-[#185ABD] pb-4 mb-8">
              <KmfriLogo variant="full" size="md" />
              <div className="text-right text-[11px] font-mono text-slate-500">
                <div>Document Ref: {doc.storage_path}</div>
                <div>Version: v{doc.version} · Confidential</div>
              </div>
            </div>

            {/* Editable Content Surface */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleEditorInput}
              dangerouslySetInnerHTML={{ __html: content }}
              style={{ fontFamily }}
              className="outline-none min-h-[750px] text-sm leading-relaxed kmfri-word-surface"
            />

            {/* Footer */}
            <div className="mt-16 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400 font-mono">
              Kenya Marine and Fisheries Research Institute · Official Research Repository
            </div>
          </div>
        </div>

        {/* 5. Collaborative Comments Sidebar (Reviewer & Co-author annotations) */}
        {showCommentsSidebar && (
          <aside className="w-80 bg-white dark:bg-slate-900 border-l border-slate-300 dark:border-slate-700 flex flex-col shrink-0 shadow-lg text-xs">
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-sky-600" />
                <span>Peer Review &amp; Co-author Notes</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCommentsSidebar(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Add Comment Input */}
            <form onSubmit={handleAddComment} className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
              <textarea
                rows={2}
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Add review comment or edit suggestion..."
                className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
              />
              <button
                type="submit"
                className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs shadow-xs"
              >
                Post Peer Comment
              </button>
            </form>

            {/* Comments Thread List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className={`p-3 rounded-xl border ${
                    c.resolved
                      ? 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 opacity-60'
                      : 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white truncate">
                      {c.author_name}
                    </span>
                    <span className="text-[10px] text-slate-400">{c.created_at}</span>
                  </div>
                  <p className="mt-1 text-slate-700 dark:text-slate-300 leading-normal">{c.text}</p>
                  <div className="mt-2 pt-2 border-t border-slate-200/50 flex justify-end">
                    <button
                      type="button"
                      onClick={() => toggleResolveComment(c.id)}
                      className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      {c.resolved ? 'Reopen' : '✓ Resolve'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* Embedded CSS for Word Formatting */}
      <style>{`
        .kmfri-word-surface h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 8px; line-height: 1.25; }
        .kmfri-word-surface h2 { font-size: 18px; font-weight: 700; color: #0A2540; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        .kmfri-word-surface h3 { font-size: 14px; font-weight: 600; color: #0284c7; margin-top: 16px; margin-bottom: 6px; }
        .kmfri-word-surface p { margin-bottom: 12px; line-height: 1.6; }
        .kmfri-word-surface .subtitle { font-size: 12px; font-style: italic; color: #64748b; margin-top: -4px; margin-bottom: 16px; }
        .kmfri-word-surface .callout-box { background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px; margin: 16px 0; border-radius: 4px; font-size: 13px; color: #166534; }
        .kmfri-word-surface .formula-box { background: #f8fafc; border: 1px dashed #cbd5e1; padding: 10px 16px; margin: 16px 0; border-radius: 6px; font-family: monospace; font-size: 14px; text-align: center; }
        .kmfri-word-surface .citation-badge { background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-family: monospace; }
        .kmfri-word-surface .scientific-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
        .kmfri-word-surface .scientific-table th { background: #0A2540; color: #ffffff; padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left; }
        .kmfri-word-surface .scientific-table td { padding: 6px 10px; border: 1px solid #cbd5e1; }
        .kmfri-word-surface .scientific-table tr:nth-child(even) { background: #f8fafc; }
      `}</style>
    </div>
  );
};
