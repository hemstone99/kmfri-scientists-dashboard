import React, { useState } from 'react';
import {
  BootstrapData,
  DocumentRecord,
  SharedFolderRecord,
} from '../types.ts';
import {
  FolderOpen,
  FolderPlus,
  Upload,
  Image as ImageIcon,
  FileText,
  Download,
  Share2,
  Trash2,
  ChevronRight,
  Eye,
  X,
  FileSpreadsheet,
  Lock,
  Unlock,
  CheckCircle2,
  LayoutGrid,
  List,
  Edit3,
  Save,
  Users,
  Sparkles,
  Bold,
  Italic,
  ListOrdered,
  Heading1,
  Heading2,
  Table as TableIcon,
  Globe,
} from 'lucide-react';

interface SharedDriveViewProps {
  data: BootstrapData;
  searchQuery: string;
  onRefresh: () => Promise<void>;
  apiFetch: <T = any>(path: string, options?: RequestInit) => Promise<T>;
  onShareFileToChat?: (doc: DocumentRecord) => void;
}

const WORD_TEMPLATES: Record<
  string,
  { name: string; docType: string; body: string }
> = {
  CRUISE_PROTOCOL: {
    name: 'RV_Mtafiti_Hydrographic_Protocol_2026.docx',
    docType: 'Word Co-Authoring Document',
    body: `# KENYA MARINE AND FISHERIES RESEARCH INSTITUTE (KMFRI)
## RV Mtafiti Offshore Hydrographic & Pelagic Stock Survey Protocol

**SharePoint Library:** \`kmfri.sharepoint.com/sites/OceansAndCoastal/Shared Documents\`
**Document Classification:** Official Scientific Standard Operating Procedure (SOP)
**Lead Co-Authors:** KMFRI Oceans & Coastal Systems Directorate

---

### 1. Executive Cruise Objectives
This collaborative Microsoft Word Online protocol defines the acoustic transect grid, CTD rosette casting depths, and eDNA water sampling stations aboard **RV Mtafiti** across the Kenyan Exclusive Economic Zone (EEZ).

### 2. Hydrographic Station Matrix
| Station ID | Coastal Sector | Depth (m) | Primary Instrumentation | Target Taxa / Parameters |
| :--- | :--- | :--- | :--- | :--- |
| **KMFRI-ST-01** | Mombasa Offshore | 120 m | SBE 19plus V2 CTD + Niskin | Dissolved Oxygen, Chl-a, Nutrients |
| **KMFRI-ST-02** | Malindi-Ungwana Bay | 65 m | Simrad EK80 Split-Beam | Small Pelagics & Penaeid Prawns |
| **KMFRI-ST-03** | Lamu Upwelling Zone | 350 m | Zooplankton Bongo Net | Tuna Larvae & Mesopelagic Biomass |

### 3. Quality Assurance & Chain of Custody
* All CTD casts must be logged in real time to the KMFRI PostgreSQL telemetry repository.
* Biological voucher specimens shall be preserved in 95% molecular-grade ethanol and indexed with barcode metadata.
* Co-authors reviewing this document in SharePoint should **Check In** their version revisions prior to cruise departure.`,
  },
  POLICY_BRIEF: {
    name: 'KMFRI_Blue_Economy_Cabinet_Policy_Brief.docx',
    docType: 'Word Co-Authoring Document',
    body: `# MINISTRY OF MINING, BLUE ECONOMY AND MARITIME AFFAIRS
## KMFRI Scientific Policy Brief: Sustainable Coastal Fisheries & Blue Carbon Ecosystems

**Prepared via:** KMFRI SharePoint & Word Online Co-Authoring Workspace
**Target Audience:** National Blue Economy Committee & County Fisheries Directors

---

### 1. Key Policy Messages
1. **Mangrove Carbon Sequestration:** Tudor Creek, Gazi Bay, and Lamu archipelago mangrove forests sequester up to 5x more carbon per hectare than terrestrial tropical forests.
2. **Seasonal Prawn Trawl Zoning:** Acoustic and catch-effort data from Malindi-Ungwana Bay support a 3-nautical-mile artisanal buffer zone to reduce juvenile bycatch by 42%.
3. **Lake Victoria Cage Aquaculture Carrying Capacity:** Spatial GIS bathymetries indicate strict zoning is required to preserve dissolved oxygen thresholds above 5.0 mg/L.

### 2. Recommended Governance Actions
* Enact community-led Beach Management Unit (BMU) co-management bylaws tied to KMFRI annual stock assessments.
* Integrate KMFRI Balanced Scorecard scientific outputs into national marine spatial planning (MSP).`,
  },
  STOCK_PAPER: {
    name: 'Kenyan_EEZ_Stock_Assessment_Working_Paper.docx',
    docType: 'Word Co-Authoring Document',
    body: `# KMFRI SCIENTIFIC WORKING PAPER
## Stock Assessment and Ecological Modeling of Artisanal & Commercial Fisheries in Kenya

**Co-Authoring Team:** KMFRI Directorate of Fisheries & Aquatic Sciences
**Status:** Live Co-Authoring Draft (SharePoint Synced)

---

### Abstract
We evaluate multi-gear catch per unit effort (CPUE), length-frequency distributions, and spawning potential ratio (SPR) across coastal landing sites (Shimoni, Vanga, Kilifi, Kipini) and inland freshwater basins (Lake Victoria, Lake Turkana).

### 1. Methodology & Sampling Design
Catch assessment surveys (CAS) were conducted across 24 sentinel landing beaches using stratified digital catch forms. Biological sub-samples were analyzed in KMFRI laboratories for otolith age determination and gonad maturity staging.

### 2. Preliminary Findings & Co-Author Notes
* **[Co-Author Note]:** Insert updated Lake Victoria Nile Perch acoustic biomass table in Section 2.2.
* **[Data Verification]:** Confirm CTD chlorophyll-a anomaly correlations from the Southeast Monsoon cruise.`,
  },
};

export const SharedDriveView: React.FC<SharedDriveViewProps> = ({
  data,
  searchQuery,
  onRefresh,
  apiFetch,
  onShareFileToChat,
}) => {
  const currentUser = data.currentUser;
  const isViewer = currentUser.roleName === 'VIEWER';

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<'ALL' | 'IMAGES' | 'DOCUMENTS' | 'WORD'>('ALL');
  const [layoutMode, setLayoutMode] = useState<'SHAREPOINT_LIST' | 'GRID'>('SHAREPOINT_LIST');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewImageDoc, setPreviewImageDoc] = useState<DocumentRecord | null>(
    null
  );

  // Word Online Co-Authoring Studio Modal State
  const [activeWordDoc, setActiveWordDoc] = useState<DocumentRecord | null>(null);
  const [showWordModal, setShowWordModal] = useState(false);
  const [wordTitle, setWordTitle] = useState('');
  const [wordBody, setWordBody] = useState('');
  const [wordDescription, setWordDescription] = useState('');
  const [wordProjectId, setWordProjectId] = useState('');
  const [wordVersion, setWordVersion] = useState('1.0');
  const [wordStatus, setWordStatus] = useState<string>('Synced');
  const [savingWord, setSavingWord] = useState(false);
  const [wordSaveNotice, setWordSaveNotice] = useState<string | null>(null);

  // New Folder State
  const [folderName, setFolderName] = useState('');
  const [folderCategory, setFolderCategory] = useState('Oceanographic Datasets');
  const [folderProjectId, setFolderProjectId] = useState('');
  const [folderDescription, setFolderDescription] = useState('');

  // Upload File / Image State
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('Scientific Image');
  const [fileMimeType, setFileMimeType] = useState('image/jpeg');
  const [fileSizeStr, setFileSizeStr] = useState('240 KB');
  const [fileDataUrl, setFileDataUrl] = useState('');
  const [fileDescription, setFileDescription] = useState('');
  const [fileProjectId, setFileProjectId] = useState('');
  const [fileVersion, setFileVersion] = useState('1.0');
  const [uploading, setUploading] = useState(false);

  const folders: SharedFolderRecord[] = data.sharedFolders || [];
  const activeFolder = folders.find((f) => f.id === selectedFolderId) || null;

  const isImageRecord = (doc: DocumentRecord) => {
    const mime = (doc.mimeType || '').toLowerCase();
    const url = (doc.fileUrl || '').toLowerCase();
    const type = (doc.type || '').toLowerCase();
    return (
      mime.startsWith('image/') ||
      url.startsWith('data:image/') ||
      type.includes('image') ||
      type.includes('photo') ||
      /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(doc.name)
    );
  };

  const isWordOrCollaborativeDoc = (doc: DocumentRecord) => {
    const name = doc.name.toLowerCase();
    const type = (doc.type || '').toLowerCase();
    return (
      Boolean(doc.contentBody) ||
      name.endsWith('.docx') ||
      name.endsWith('.doc') ||
      name.endsWith('.md') ||
      type.includes('word') ||
      type.includes('proposal') ||
      type.includes('protocol') ||
      type.includes('cruise plan') ||
      type.includes('annex')
    );
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredDocs = data.documents.filter((doc) => {
    if (selectedFolderId && doc.folderId !== selectedFolderId) return false;
    if (viewFilter === 'IMAGES' && !isImageRecord(doc)) return false;
    if (viewFilter === 'DOCUMENTS' && isImageRecord(doc)) return false;
    if (viewFilter === 'WORD' && !isWordOrCollaborativeDoc(doc)) return false;
    if (
      q &&
      !doc.name.toLowerCase().includes(q) &&
      !doc.type.toLowerCase().includes(q) &&
      !(doc.description || '').toLowerCase().includes(q) &&
      !(doc.contentBody || '').toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });

  // Launch Word Online Studio for a New Document
  const handleOpenNewWordDoc = (templateKey: keyof typeof WORD_TEMPLATES = 'CRUISE_PROTOCOL') => {
    const tpl = WORD_TEMPLATES[templateKey];
    setActiveWordDoc(null);
    setWordTitle(tpl.name);
    setWordBody(tpl.body);
    setWordDescription(
      'Collaborative Microsoft Word Online document synced with KMFRI SharePoint Library'
    );
    setWordProjectId(activeFolder?.projectId || data.projects[0]?.id || '');
    setWordVersion('1.0');
    setWordStatus('Co-Authoring');
    setWordSaveNotice(null);
    setShowWordModal(true);
  };

  // Open an Existing Document in Word Online Studio
  const handleOpenExistingInWord = (doc: DocumentRecord) => {
    setActiveWordDoc(doc);
    setWordTitle(doc.name.endsWith('.docx') || doc.name.endsWith('.pdf') ? doc.name : `${doc.name}.docx`);
    setWordBody(
      doc.contentBody ||
        `# ${doc.name}\n\n**SharePoint Document Type:** ${doc.type} (v${doc.version})\n**Summary:** ${
          doc.description || 'KMFRI Institutional Shared Document'
        }\n\n---\n\n### 1. Collaborative Research Notes & Findings\nEnter or co-author scientific text, methodology tables, and hydrographic observations here. Changes are versioned and broadcast across the KMFRI SharePoint Document Library in real time.\n\n### 2. Action Items & Peer Review\n* Verified by ${currentUser.fullName} (${currentUser.roleName})\n* Linked to KMFRI Research Directorate Repository`
    );
    setWordDescription(doc.description || 'Collaborative Word Document in KMFRI SharePoint');
    setWordProjectId(doc.projectId || '');
    setWordVersion(doc.version || '1.0');
    setWordStatus(doc.sharepointStatus || 'Co-Authoring');
    setWordSaveNotice(null);
    setShowWordModal(true);
  };

  // Save & Sync Word Document to Backend & SharePoint
  const handleSaveWordDocument = async (checkInAfterSave = false) => {
    if (!wordTitle.trim()) return;
    setSavingWord(true);
    setWordSaveNotice(null);
    try {
      const cleanName = wordTitle.trim().endsWith('.docx')
        ? wordTitle.trim()
        : `${wordTitle.trim()}.docx`;

      // Bump version if checking in or editing existing
      let nextVersion = wordVersion;
      if (activeWordDoc) {
        const parts = (activeWordDoc.version || '1.0').split('.');
        const major = Number(parts[0]) || 1;
        const minor = (Number(parts[1]) || 0) + 1;
        nextVersion = `${major}.${minor}`;
      }

      const htmlDocBlob = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${cleanName}</title></head><body style="font-family: Calibri, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 2rem auto;"><pre style="white-space: pre-wrap; font-family: inherit;">${wordBody.replace(
        /</g,
        '&lt;'
      )}</pre></body></html>`;
      const dataUrl = `data:application/msword;charset=utf-8,${encodeURIComponent(htmlDocBlob)}`;
      const kb = Math.max(12, Math.round(wordBody.length / 45));

      if (activeWordDoc) {
        const updated = await apiFetch<DocumentRecord>(
          `/api/documents/${activeWordDoc.id}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              name: cleanName,
              type: 'Word Co-Authoring Document',
              description: wordDescription.trim() || null,
              contentBody: wordBody,
              version: nextVersion,
              sharepointStatus: checkInAfterSave ? 'Synced' : wordStatus,
              checkedOutBy: checkInAfterSave ? null : currentUser.id,
            }),
          }
        );
        setActiveWordDoc(updated);
        setWordVersion(nextVersion);
        setWordStatus(checkInAfterSave ? 'Synced' : wordStatus);
      } else {
        const created = await apiFetch<DocumentRecord>('/api/documents', {
          method: 'POST',
          body: JSON.stringify({
            name: cleanName,
            type: 'Word Co-Authoring Document',
            mimeType:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            description: wordDescription.trim() || null,
            contentBody: wordBody,
            fileUrl: dataUrl,
            fileSize: `${kb} KB`,
            version: nextVersion,
            folderId: selectedFolderId || null,
            projectId: wordProjectId || activeFolder?.projectId || null,
            sharepointStatus: checkInAfterSave ? 'Synced' : 'Co-Authoring',
            checkedOutBy: checkInAfterSave ? null : currentUser.id,
          }),
        });
        setActiveWordDoc(created);
      }

      await onRefresh();
      setWordSaveNotice(
        checkInAfterSave
          ? `Checked in & synced v${nextVersion} to KMFRI SharePoint Library`
          : `Saved live co-authoring draft (v${nextVersion}) to SharePoint`
      );
    } finally {
      setSavingWord(false);
    }
  };

  // Toggle SharePoint Check-Out / Check-In directly from Library
  const handleToggleCheckOut = async (doc: DocumentRecord) => {
    if (isViewer) return;
    const isCheckedOutByMe = doc.checkedOutBy === currentUser.id;
    const isCheckedOut = Boolean(doc.checkedOutBy);

    const parts = (doc.version || '1.0').split('.');
    const nextVer = isCheckedOut
      ? `${Number(parts[0]) || 1}.${(Number(parts[1]) || 0) + 1}`
      : doc.version;

    await apiFetch(`/api/documents/${doc.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        checkedOutBy: isCheckedOutByMe || isCheckedOut ? null : currentUser.id,
        sharepointStatus: isCheckedOut ? 'Synced' : 'Checked Out',
        version: nextVer,
      }),
    });
    await onRefresh();
  };

  // Download Word Document (.doc) directly
  const handleExportWordFile = (title: string, body: string) => {
    const cleanName = title.endsWith('.docx') || title.endsWith('.doc')
      ? title.replace(/\.docx$/i, '.doc')
      : `${title}.doc`;
    const htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${cleanName}</title></head><body style="font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;"><pre style="font-family:Calibri,Arial,sans-serif;white-space:pre-wrap;">${body.replace(
      /</g,
      '&lt;'
    )}</pre></body></html>`;
    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const insertFormattingSnippet = (snippet: string) => {
    setWordBody((prev) => `${prev}\n${snippet}`);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    setUploading(true);
    try {
      await apiFetch('/api/folders', {
        method: 'POST',
        body: JSON.stringify({
          name: folderName.trim(),
          category: folderCategory,
          projectId: folderProjectId || null,
          description: folderDescription.trim() || null,
        }),
      });
      setFolderName('');
      setFolderDescription('');
      setShowNewFolderModal(false);
      await onRefresh();
    } finally {
      setUploading(false);
    }
  };

  const handleDeviceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFileMimeType(file.type || 'application/octet-stream');
    const kb = Math.max(1, Math.round(file.size / 1024));
    setFileSizeStr(
      kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
    );
    if (file.type.startsWith('image/')) {
      setFileType('Scientific Image');
    } else if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx')) {
      setFileType('Dataset Archive');
    } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
      setFileType('Word Co-Authoring Document');
    } else {
      setFileType('Research Document');
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFileDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim() || !fileDataUrl.trim()) return;
    setUploading(true);
    try {
      await apiFetch('/api/documents', {
        method: 'POST',
        body: JSON.stringify({
          name: fileName.trim(),
          type: fileType,
          mimeType: fileMimeType,
          description: fileDescription.trim() || null,
          fileUrl: fileDataUrl.trim(),
          fileSize: fileSizeStr,
          version: fileVersion,
          folderId: selectedFolderId || null,
          projectId: fileProjectId || activeFolder?.projectId || null,
          sharepointStatus: 'Synced',
        }),
      });
      setFileName('');
      setFileDataUrl('');
      setFileDescription('');
      setShowUploadModal(false);
      await onRefresh();
    } finally {
      setUploading(false);
    }
  };

  const wordCount = wordBody
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Top SharePoint & Word Online Suite Header */}
      <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-r from-sky-950 via-slate-900 to-teal-950 text-white p-5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-sky-300">
              <Globe className="w-3.5 h-3.5 text-teal-400" />
              <span>KMFRI SHAREPOINT TEAM SITE &amp; MICROSOFT WORD ONLINE CO-AUTHORING</span>
              <span className="px-2 py-0.5 rounded-md bg-teal-500/20 border border-teal-400/30 text-teal-300">
                Real-Time Sync Active
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              SharePoint Document Library, Word Co-Authoring &amp; Media Hub
            </h1>
            <p className="text-xs text-slate-300 max-w-3xl">
              Co-author scientific protocols and manuscripts in <strong>Word Online (.docx)</strong>, manage <strong>SharePoint Check-In / Check-Out</strong> version history, organize research folders, and broadcast datasets across KMFRI directorates.
            </p>
          </div>

          {!isViewer && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleOpenNewWordDoc('CRUISE_PROTOCOL')}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>+ New Word Document (.docx)</span>
              </button>
              <button
                type="button"
                onClick={() => setShowNewFolderModal(true)}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FolderPlus className="w-4 h-4 text-sky-300" />
                <span>New SharePoint Folder</span>
              </button>
              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                className="px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload File / Image</span>
              </button>
            </div>
          )}
        </div>

        {/* SharePoint Site URL & Quick Stats Strip */}
        <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-mono text-[11px] truncate">
            <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold">
              SharePoint URL
            </span>
            <span className="truncate text-slate-300">
              https://kmfri.sharepoint.com/sites/ResearchCollaboration/Shared%20Documents
              {activeFolder ? `/${encodeURIComponent(activeFolder.name)}` : ''}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono">
            <span>
              Total Library Items: <strong className="text-white">{data.documents.length}</strong>
            </span>
            <span>
              Checked Out:{' '}
              <strong className="text-amber-300">
                {data.documents.filter((d) => Boolean(d.checkedOutBy)).length}
              </strong>
            </span>
            <span>
              Word Co-Authoring Docs:{' '}
              <strong className="text-sky-300">
                {data.documents.filter((d) => isWordOrCollaborativeDoc(d)).length}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* SharePoint Command Bar: Filters & Layout Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'ALL', label: `All Library Items (${data.documents.length})` },
              {
                id: 'WORD',
                label: `Word Online & Docs (${
                  data.documents.filter((d) => isWordOrCollaborativeDoc(d)).length
                })`,
              },
              {
                id: 'IMAGES',
                label: `Scientific Images (${
                  data.documents.filter((d) => isImageRecord(d)).length
                })`,
              },
              { id: 'DOCUMENTS', label: 'Datasets & Archives' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setViewFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                viewFilter === tab.id
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
            Library View:
          </span>
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setLayoutMode('SHAREPOINT_LIST')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                layoutMode === 'SHAREPOINT_LIST'
                  ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>SharePoint List</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('GRID')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                layoutMode === 'GRID'
                  ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Tiles Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
        <div className="flex items-center gap-2 font-medium flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedFolderId(null)}
            className={`cursor-pointer ${
              !selectedFolderId
                ? 'font-bold text-sky-700 dark:text-sky-400'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            SharePoint Root Library ({folders.length} Folders)
          </button>
          {activeFolder && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-slate-900 dark:text-white">
                {activeFolder.name}
              </span>
              <span className="text-slate-400 font-mono">
                ({activeFolder.category})
              </span>
            </>
          )}
        </div>
        {activeFolder && (
          <button
            type="button"
            onClick={() => setSelectedFolderId(null)}
            className="text-xs text-sky-700 dark:text-sky-400 hover:underline cursor-pointer"
          >
            ← Back to Root Library
          </button>
        )}
      </div>

      {/* Shared Folders Grid */}
      {!selectedFolderId && (
        <div className="space-y-2.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            SharePoint Document Libraries &amp; Research Folders ({folders.length})
          </div>
          {folders.length === 0 ? (
            <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FolderOpen className="w-8 h-8 text-sky-600 dark:text-sky-400" />
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    No Custom SharePoint Folders Created Yet
                  </div>
                  <div className="text-xs text-slate-500">
                    Create team folders for RV Mtafiti cruises, coral reef imagery, water quality datasets, or project teams.
                  </div>
                </div>
              </div>
              {!isViewer && (
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-sky-700 text-white text-xs font-semibold cursor-pointer"
                >
                  + Create First SharePoint Folder
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {folders.map((folder) => {
                const countInFolder = data.documents.filter(
                  (d) => d.folderId === folder.id
                ).length;
                const creator = data.users.find((u) => u.id === folder.createdBy);
                return (
                  <div
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-500/50 cursor-pointer transition-all flex flex-col justify-between space-y-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-500/20 flex items-center justify-center">
                        <FolderOpen className="w-5 h-5 text-sky-700 dark:text-sky-400" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-mono text-slate-500">
                          {countInFolder} item{countInFolder === 1 ? '' : 's'}
                        </span>
                        {!isViewer && (
                          <button
                            type="button"
                            onClick={async (ev) => {
                              ev.stopPropagation();
                              await apiFetch(`/api/folders/${folder.id}`, {
                                method: 'DELETE',
                              });
                              await onRefresh();
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Delete Folder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-mono text-teal-700 dark:text-teal-400">
                        {folder.category}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                        {folder.name}
                      </h3>
                      {folder.description && (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {folder.description}
                        </p>
                      )}
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>By {creator?.fullName || 'KMFRI Scientist'}</span>
                      <span className="text-sky-600 dark:text-sky-400 font-semibold">
                        Open Library →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SharePoint Document Library Content: List View vs Grid View */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {activeFolder
              ? `SharePoint Library Items in "${activeFolder.name}" (${filteredDocs.length})`
              : `SharePoint Document Library & Scientific Media (${filteredDocs.length})`}
          </div>
          {!isViewer && (
            <button
              type="button"
              onClick={() => handleOpenNewWordDoc('STOCK_PAPER')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Launch Word Online Co-Authoring Studio</span>
            </button>
          )}
        </div>

        {filteredDocs.length === 0 ? (
          <div className="p-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-3">
            <FileText className="w-10 h-10 text-sky-700 dark:text-sky-400 mx-auto" />
            <div className="text-base font-bold text-slate-900 dark:text-white">
              No Documents or Media Match This Filter
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Create a collaborative Microsoft Word (.docx) protocol right in the browser, or upload marine photographs, NetCDF/CSV datasets, and PDF reports.
            </p>
            {!isViewer && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleOpenNewWordDoc('CRUISE_PROTOCOL')}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>+ New Word Document (.docx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="px-4 py-2 rounded-xl bg-sky-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File or Image</span>
                </button>
              </div>
            )}
          </div>
        ) : layoutMode === 'SHAREPOINT_LIST' ? (
          /* SHAREPOINT METADATA TABLE VIEW */
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-mono uppercase text-slate-500">
                    <th className="py-3 px-4">Document / Asset Name</th>
                    <th className="py-3 px-3">SharePoint Status</th>
                    <th className="py-3 px-3">Version</th>
                    <th className="py-3 px-3">Project / Library</th>
                    <th className="py-3 px-3">Modified By</th>
                    <th className="py-3 px-4 text-right">Collaborative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredDocs.map((doc) => {
                    const isImg = isImageRecord(doc);
                    const uploader = data.users.find((u) => u.id === doc.uploadedBy);
                    const editor = data.users.find(
                      (u) => u.id === (doc.lastEditedBy || doc.uploadedBy)
                    );
                    const checkedOutUser = data.users.find(
                      (u) => u.id === doc.checkedOutBy
                    );
                    const proj = data.projects.find((p) => p.id === doc.projectId);
                    const folder = folders.find((f) => f.id === doc.folderId);

                    return (
                      <tr
                        key={doc.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                                isImg
                                  ? 'bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400'
                                  : isWordOrCollaborativeDoc(doc)
                                    ? 'bg-blue-600/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
                                    : 'bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400'
                              }`}
                            >
                              {isImg ? (
                                <ImageIcon className="w-4 h-4" />
                              ) : doc.name.endsWith('.csv') || doc.name.endsWith('.xlsx') ? (
                                <FileSpreadsheet className="w-4 h-4" />
                              ) : (
                                <FileText className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                                {doc.name}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate max-w-xs sm:max-w-md">
                                {doc.description || doc.type} · {doc.fileSize}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          {checkedOutUser ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono text-[11px]">
                              <Lock className="w-3 h-3" />
                              <span>Checked Out ({checkedOutUser.fullName.split(' ')[0]})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono text-[11px]">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{doc.sharepointStatus || 'Synced'}</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                          v{doc.version}
                        </td>

                        <td className="py-3 px-3">
                          <div className="text-slate-800 dark:text-slate-200 font-medium">
                            {proj ? proj.projectCode : 'Institutional'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {folder ? `📁 ${folder.name}` : '📁 Root Library'}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="text-slate-800 dark:text-slate-200">
                            {editor?.fullName || uploader?.fullName || 'KMFRI Scientist'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {doc.updatedAt || doc.createdAt}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {isImg ? (
                              <button
                                type="button"
                                onClick={() => setPreviewImageDoc(doc)}
                                className="px-2.5 py-1 rounded-lg bg-teal-600/10 text-teal-700 dark:text-teal-300 border border-teal-500/30 font-semibold hover:bg-teal-600/20 flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Preview</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenExistingInWord(doc)}
                                className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 flex items-center gap-1 cursor-pointer"
                                title="Open in Microsoft Word Online Co-Authoring Studio"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Open in Word</span>
                              </button>
                            )}

                            {!isViewer && !isImg && (
                              <button
                                type="button"
                                onClick={() => handleToggleCheckOut(doc)}
                                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
                                title={
                                  doc.checkedOutBy
                                    ? 'Check In to SharePoint & Increment Version'
                                    : 'Check Out Document for Editing'
                                }
                              >
                                {doc.checkedOutBy ? (
                                  <>
                                    <Unlock className="w-3 h-3 text-emerald-600" />
                                    <span>Check In</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-3 h-3 text-amber-600" />
                                    <span>Check Out</span>
                                  </>
                                )}
                              </button>
                            )}

                            <a
                              href={doc.fileUrl}
                              download={doc.name}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sky-700 dark:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Download File"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>

                            {onShareFileToChat && (
                              <button
                                type="button"
                                onClick={() => onShareFileToChat(doc)}
                                className="p-1.5 rounded-lg border border-teal-500/40 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 cursor-pointer"
                                title="Share Link to Scientist Chatbox"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {!isViewer && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiFetch(`/api/documents/${doc.id}`, {
                                    method: 'DELETE',
                                  });
                                  await onRefresh();
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Delete Item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* TILES GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => {
              const isImg = isImageRecord(doc);
              const uploader = data.users.find((u) => u.id === doc.uploadedBy);
              const proj = data.projects.find((p) => p.id === doc.projectId);
              const folder = folders.find((f) => f.id === doc.folderId);

              return (
                <div
                  key={doc.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between shadow-xs hover:border-sky-500/40 transition-colors"
                >
                  {isImg ? (
                    <div
                      onClick={() => setPreviewImageDoc(doc)}
                      className="relative h-44 bg-slate-950 cursor-pointer group overflow-hidden"
                    >
                      <img
                        src={doc.fileUrl}
                        alt={doc.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-3 py-1.5 rounded-lg bg-slate-900/90 text-white text-xs font-semibold flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect Full Image</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-24 px-5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-mono text-blue-700 dark:text-blue-400 truncate">
                            {doc.type} · v{doc.version}
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            Size: {doc.fileSize}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] shrink-0">
                        {doc.sharepointStatus || 'Synced'}
                      </span>
                    </div>
                  )}

                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span>{folder ? `📁 ${folder.name}` : '📁 Root Shared Drive'}</span>
                        <span>{doc.fileSize}</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                        {doc.name}
                      </h4>
                      {doc.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                          {doc.description}
                        </p>
                      )}
                      <div className="text-[11px] text-slate-500 mt-1.5">
                        Shared by {uploader?.fullName || 'KMFRI Researcher'}
                        {proj ? ` · ${proj.projectCode}` : ''}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!isImg && (
                          <button
                            type="button"
                            onClick={() => handleOpenExistingInWord(doc)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Word Online</span>
                          </button>
                        )}
                        <a
                          href={doc.fileUrl}
                          download={doc.name}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-sky-700 dark:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </a>
                        {onShareFileToChat && (
                          <button
                            type="button"
                            onClick={() => onShareFileToChat(doc)}
                            className="px-2.5 py-1 rounded-lg border border-teal-500/40 text-xs font-medium text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 flex items-center gap-1 cursor-pointer"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>Chat</span>
                          </button>
                        )}
                      </div>

                      {!isViewer && (
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/documents/${doc.id}`, {
                              method: 'DELETE',
                            });
                            await onRefresh();
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Delete Shared Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MICROSOFT WORD ONLINE CO-AUTHORING STUDIO MODAL */}
      {showWordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-5xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Word Online Blue Top Bar */}
            <div className="bg-[#185abd] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-white/15 border border-white/25 flex items-center justify-center font-bold text-sm shrink-0">
                  W
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={wordTitle}
                      onChange={(e) => setWordTitle(e.target.value)}
                      className="bg-white/10 hover:bg-white/20 focus:bg-white/25 px-2.5 py-1 rounded-lg text-sm font-bold text-white border border-white/20 outline-none w-56 sm:w-80"
                    />
                    <span className="px-2 py-0.5 rounded bg-emerald-400/20 border border-emerald-300/30 text-[11px] font-mono">
                      v{wordVersion} • {wordStatus}
                    </span>
                  </div>
                  <div className="text-[11px] text-blue-100 flex items-center gap-2 mt-0.5">
                    <span>SharePoint AutoSave: Active</span>
                    <span>•</span>
                    <span>Co-Author: {currentUser.fullName}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Active Co-Authors Avatars */}
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-[11px]">
                  <Users className="w-3.5 h-3.5 text-sky-200" />
                  <span>{data.users.filter((u) => u.status === 'Active').length} Scientists Connected</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleExportWordFile(wordTitle, wordBody)}
                  className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .DOC</span>
                </button>

                {!isViewer && (
                  <>
                    <button
                      type="button"
                      disabled={savingWord}
                      onClick={() => handleSaveWordDocument(false)}
                      className="px-3.5 py-1.5 rounded-lg bg-white text-[#185abd] hover:bg-blue-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingWord ? 'Syncing...' : 'Save to SharePoint'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={savingWord}
                      onClick={() => handleSaveWordDocument(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Check In Version</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowWordModal(false)}
                  className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Word Ribbon Toolbar */}
            <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500 mr-1">
                  Templates:
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenNewWordDoc('CRUISE_PROTOCOL')}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium hover:border-blue-500 cursor-pointer"
                >
                  RV Mtafiti Protocol
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenNewWordDoc('POLICY_BRIEF')}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium hover:border-blue-500 cursor-pointer"
                >
                  Blue Economy Policy Brief
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenNewWordDoc('STOCK_PAPER')}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium hover:border-blue-500 cursor-pointer"
                >
                  Stock Assessment Paper
                </button>

                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

                <button
                  type="button"
                  onClick={() => insertFormattingSnippet('\n## New Section Heading\n')}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 cursor-pointer"
                  title="Insert Heading 1"
                >
                  <Heading1 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormattingSnippet('\n### Sub-Section Analysis\n')}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 cursor-pointer"
                  title="Insert Heading 2"
                >
                  <Heading2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormattingSnippet('**Key Scientific Finding:** ')}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 cursor-pointer"
                  title="Bold Callout"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormattingSnippet('*Taxonomic Species Note: Rastrelliger kanagurta*')}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 cursor-pointer"
                  title="Italic Species Name"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertFormattingSnippet(
                      '\n* Sampling Station Observation 1\n* Sampling Station Observation 2\n'
                    )
                  }
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 cursor-pointer"
                  title="Bullet List"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertFormattingSnippet(
                      '\n| Station Code | Temp (°C) | Salinity (PSU) | Dissolved O2 (mg/L) |\n| :--- | :--- | :--- | :--- |\n| KMFRI-EEZ-01 | 27.4 | 35.1 | 6.42 |\n'
                    )
                  }
                  className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 flex items-center gap-1 cursor-pointer"
                  title="Insert Scientific Data Table"
                >
                  <TableIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>+ Data Table</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={wordProjectId}
                  onChange={(e) => setWordProjectId(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                >
                  <option value="">Link to Project (Optional)</option>
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectCode}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {wordSaveNotice && (
              <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
                <span>✓ {wordSaveNotice}</span>
                {activeWordDoc && onShareFileToChat && (
                  <button
                    type="button"
                    onClick={() => onShareFileToChat(activeWordDoc)}
                    className="px-2.5 py-0.5 rounded bg-teal-600 text-white text-[11px] cursor-pointer"
                  >
                    Broadcast Co-Authoring Link to Chatbox
                  </button>
                )}
              </div>
            )}

            {/* Word Document Page Canvas */}
            <div className="flex-1 overflow-y-auto bg-slate-200/70 dark:bg-slate-950 p-4 sm:p-8">
              <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 shadow-lg rounded-sm p-6 sm:p-10 min-h-[460px] flex flex-col">
                <input
                  type="text"
                  value={wordDescription}
                  onChange={(e) => setWordDescription(e.target.value)}
                  placeholder="SharePoint Document Abstract / Metadata Note..."
                  className="w-full text-xs text-slate-500 dark:text-slate-400 pb-3 mb-4 border-b border-slate-200 dark:border-slate-800 bg-transparent outline-none"
                />
                <textarea
                  value={wordBody}
                  onChange={(e) => setWordBody(e.target.value)}
                  rows={18}
                  placeholder="Start co-authoring your KMFRI scientific document in Word Online..."
                  className="w-full flex-1 bg-transparent text-sm leading-relaxed text-slate-900 dark:text-slate-100 font-sans outline-none resize-none"
                />
              </div>
            </div>

            {/* Word Status Footer Bar */}
            <div className="px-4 py-2 bg-[#185abd] text-white text-[11px] font-mono flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-4">
                <span>Page 1 of 1</span>
                <span>{wordCount} words</span>
                <span>{wordBody.length} characters</span>
                <span>English (Kenya) — KMFRI Scientific Dictionary</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>SharePoint Real-Time WebSocket Broadcast Enabled</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Shared Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Create SharePoint Research Folder
              </h3>
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1">Folder Name *</label>
                <input
                  type="text"
                  required
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g., RV Mtafiti Deep EEZ Cruise Photos & CTD Logs"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Category</label>
                <select
                  value={folderCategory}
                  onChange={(e) => setFolderCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="Oceanographic Datasets">Oceanographic Datasets</option>
                  <option value="Marine & Coastal Imagery">Marine &amp; Coastal Imagery</option>
                  <option value="Freshwater Lakes Telemetry">Freshwater Lakes Telemetry</option>
                  <option value="Lab Protocols & SOPs">Lab Protocols &amp; SOPs</option>
                  <option value="Manuscript Figures">Manuscript Figures</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Linked Project (Optional)</label>
                <select
                  value={folderProjectId}
                  onChange={(e) => setFolderProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="">All KMFRI Directorates (Open Access)</option>
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectCode} — {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={folderDescription}
                  onChange={(e) => setFolderDescription(e.target.value)}
                  placeholder="Describe what files, images, or datasets belong in this shared folder..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 rounded-xl bg-sky-700 text-white font-semibold"
                >
                  {uploading ? 'Creating...' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload File or Image Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Upload &amp; Sync File or Image to SharePoint Library
              </h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  Select File or Image from Your Device *
                </label>
                <label className="flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed border-sky-500/40 bg-sky-50/40 dark:bg-sky-950/20 cursor-pointer hover:border-sky-500">
                  <Upload className="w-6 h-6 text-sky-600 dark:text-sky-400 mb-1" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {fileName
                      ? `Selected: ${fileName} (${fileSizeStr})`
                      : 'Click to choose an Image (.png, .jpg, .webp) or Document (.docx, .pdf, .csv, .xlsx)'}
                  </span>
                  <input
                    type="file"
                    onChange={handleDeviceFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Display Name *</label>
                  <input
                    type="text"
                    required
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="e.g., Coral_Transect_Malindi.jpg"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Asset Type</label>
                  <select
                    value={fileType}
                    onChange={(e) => setFileType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="Word Co-Authoring Document">Word Co-Authoring Document (.docx)</option>
                    <option value="Scientific Image">Scientific / Field Image</option>
                    <option value="Dataset Archive">Oceanographic / Fisheries Dataset</option>
                    <option value="Cruise Plan">RV Mtafiti Cruise Plan</option>
                    <option value="Proposal">Research Proposal / Protocol</option>
                    <option value="Technical Annex">Technical Report / Annex</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Target SharePoint Folder</label>
                  <select
                    value={selectedFolderId || ''}
                    onChange={(e) => setSelectedFolderId(e.target.value || null)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">Root SharePoint Library</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Version</label>
                  <input
                    type="text"
                    value={fileVersion}
                    onChange={(e) => setFileVersion(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Or Paste Direct Image / Document URL
                </label>
                <input
                  type="text"
                  value={fileDataUrl}
                  onChange={(e) => setFileDataUrl(e.target.value)}
                  placeholder="https://... or uploaded file data URL"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Scientific Notes / Caption</label>
                <textarea
                  rows={2}
                  value={fileDescription}
                  onChange={(e) => setFileDescription(e.target.value)}
                  placeholder="Add station coordinates, specimen notes, or dataset parameters..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 rounded-xl bg-sky-700 text-white font-semibold"
                >
                  {uploading ? 'Syncing...' : 'Sync to SharePoint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full-Resolution Scientific Image Lightbox */}
      {previewImageDoc && (
        <div
          onClick={() => setPreviewImageDoc(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl w-full rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 text-white">
              <div>
                <div className="text-sm font-bold">{previewImageDoc.name}</div>
                <div className="text-xs text-slate-400">
                  {previewImageDoc.description || previewImageDoc.type} · {previewImageDoc.fileSize}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewImageDoc(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[72vh] overflow-auto bg-black flex items-center justify-center p-4">
              <img
                src={previewImageDoc.fileUrl}
                alt={previewImageDoc.name}
                referrerPolicy="no-referrer"
                className="max-h-[66vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
