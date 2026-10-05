import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileDown,
  FileEdit,
  FileText,
  Folder,
  FolderPlus,
  Grid,
  History,
  Image as ImageIcon,
  Layers,
  List,
  Lock,
  MessageSquareShare,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Unlock,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { DocumentRecord, SharedFolder } from '../types/kmfri.ts';
import { UserAvatar } from './UserAvatar.tsx';
import { KmfriWordStudio } from './KmfriWordStudio.tsx';

export function DocumentsModule() {
  const { db, user, apiFetch, refreshData, shareToLiveChat, showToast } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [teamLibrary, setTeamLibrary] = useState<string>('all');

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Collaborative Tools State (SharePoint & Word)
  const [activeWordDoc, setActiveWordDoc] = useState<DocumentRecord | null>(null);
  const [versionHistoryDoc, setVersionHistoryDoc] = useState<DocumentRecord | null>(null);
  const [sharingDoc, setSharingDoc] = useState<DocumentRecord | null>(null);
  const [shareRole, setShareRole] = useState<'edit' | 'review' | 'view'>('edit');
  const [copiedLink, setCopiedLink] = useState(false);

  // Upload state
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<DocumentRecord['category']>('Project Document');
  const [docFolderId, setDocFolderId] = useState<string>('');
  const [docProjectId, setDocProjectId] = useState('');
  const [docReportId, setDocReportId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docNotes, setDocNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  // New Folder state
  const [folderName, setFolderName] = useState('');
  const [folderDesc, setFolderDesc] = useState('');
  const [folderDirId, setFolderDirId] = useState('');
  const [folderProjId, setFolderProjId] = useState('');
  const [folderColor, setFolderColor] = useState('sky');

  const filteredFolders = useMemo(() => {
    if (!db) return [];
    return db.shared_folders.filter((f) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          f.name.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          f.created_by_name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [db, searchQuery]);

  const filteredDocs = useMemo(() => {
    if (!db) return [];
    return db.documents.filter((d) => {
      if (selectedFolderId && d.folder_id !== selectedFolderId) return false;
      if (catFilter !== 'all' && d.category !== catFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          d.title.toLowerCase().includes(q) ||
          d.file_name.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [db, selectedFolderId, catFilter, searchQuery]);

  if (!db) return null;

  const activeFolder: SharedFolder | null =
    db.shared_folders.find((f) => f.id === selectedFolderId) || null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setFormError('File exceeds maximum allowed size of 25 MB.');
      return;
    }
    setFormError(null);
    setSelectedFile(file);
    if (!docTitle) {
      setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
    if (file.type.startsWith('image/')) {
      setDocCategory('Shared Image');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) {
      setFormError('Document / image title is required.');
      return;
    }
    setUploading(true);
    setFormError(null);

    try {
      let dataUrl: string | undefined;
      if (selectedFile && selectedFile.size <= 10 * 1024 * 1024) {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(selectedFile);
        });
      }

      const created = await apiFetch<DocumentRecord>('/documents', {
        method: 'POST',
        body: JSON.stringify({
          title: docTitle,
          file_name: selectedFile ? selectedFile.name : `${docTitle.replace(/\s+/g, '_')}.pdf`,
          mime_type: selectedFile ? selectedFile.type || 'application/pdf' : 'application/pdf',
          file_size_bytes: selectedFile ? selectedFile.size : 148200,
          data_url: dataUrl,
          category: docCategory,
          folder_id: docFolderId || selectedFolderId || null,
          project_id: docProjectId || null,
          report_id: docReportId || null,
          version: 1.0,
          version_history: [
            {
              version: 1.0,
              updated_at: new Date().toISOString(),
              updated_by_name: user ? `${user.title} ${user.full_name}` : 'Scientist',
              summary: 'Initial document upload',
            },
          ],
          metadata: { notes: docNotes },
        }),
      });

      await refreshData();
      setUploadModalOpen(false);
      setDocTitle('');
      setSelectedFile(null);
      setDocNotes('');
      showToast(`Uploaded "${created.title}" (v${created.version})`);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Create New Word Document (.docx) directly
  const handleCreateWordDoc = async () => {
    try {
      const defaultTitle = `KMFRI Research Technical Brief (${new Date().toLocaleDateString()})`;
      const created = await apiFetch<DocumentRecord>('/documents', {
        method: 'POST',
        body: JSON.stringify({
          title: defaultTitle,
          file_name: `${defaultTitle.replace(/[^a-zA-Z0-9]/g, '_')}.docx`,
          mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          file_size_bytes: 42000,
          category: 'Project Document',
          folder_id: selectedFolderId || null,
          version: 1.0,
          word_content: `<h1>${defaultTitle}</h1>\n<p class="subtitle">Kenya Marine and Fisheries Research Institute · Collaborative Word Document</p>\n<hr/>\n<h2>1. Executive Summary</h2>\n<p>Start co-authoring scientific findings, hydrographic data, or policy briefs collaboratively...</p>`,
          version_history: [
            {
              version: 1.0,
              updated_at: new Date().toISOString(),
              updated_by_name: user ? `${user.title} ${user.full_name}` : 'Scientist',
              summary: 'Document initialized in KMFRI Word Studio',
            },
          ],
          metadata: { created_in: 'KMFRI Word Studio' },
        }),
      });

      await refreshData();
      setActiveWordDoc(created);
      showToast(`Created "${created.title}". Opening in KMFRI Word Studio...`);
    } catch (err: any) {
      showToast(err.message || 'Failed to create document', 'error');
    }
  };

  const handleSaveWordDocument = async (updatedFields: Partial<DocumentRecord>) => {
    if (!activeWordDoc) return;
    try {
      const saved = await apiFetch<DocumentRecord>(`/documents/${activeWordDoc.id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedFields),
      });
      await refreshData();
      setActiveWordDoc(saved);
    } catch (err: any) {
      showToast(err.message || 'Failed to update document', 'error');
      throw err;
    }
  };

  // SharePoint Check-Out / Check-In Locking
  const handleToggleCheckOut = async (doc: DocumentRecord) => {
    const isCheckedOutByMe = doc.checked_out_by === user?.id;
    const isCheckedOutByOther = doc.checked_out_by && doc.checked_out_by !== user?.id;

    if (isCheckedOutByOther) {
      showToast(
        `Document is currently checked out (locked) by ${doc.checked_out_by_name || 'another scientist'}.`,
        'error'
      );
      return;
    }

    try {
      const payload = isCheckedOutByMe
        ? { checked_out_by: null, checked_out_by_name: null, checked_out_at: null }
        : {
            checked_out_by: user?.id,
            checked_out_by_name: user ? `${user.title} ${user.full_name}` : 'Scientist',
            checked_out_at: new Date().toISOString(),
          };

      await apiFetch(`/documents/${doc.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      await refreshData();
      showToast(
        isCheckedOutByMe
          ? `Checked in "${doc.title}". File unlocked for the team.`
          : `Checked out "${doc.title}". File locked for your edits.`
      );
    } catch (err: any) {
      showToast(err.message || 'Check-out failed', 'error');
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    try {
      const created = await apiFetch<SharedFolder>('/folders', {
        method: 'POST',
        body: JSON.stringify({
          name: folderName,
          description: folderDesc,
          directorate_id: folderDirId || null,
          project_id: folderProjId || null,
          color: folderColor,
        }),
      });
      await refreshData();
      setFolderModalOpen(false);
      setFolderName('');
      setFolderDesc('');
      showToast(`Created shared folder "${created.name}"`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteFolder = async (folder: SharedFolder) => {
    try {
      await apiFetch(`/folders/${folder.id}`, { method: 'DELETE' });
      if (selectedFolderId === folder.id) setSelectedFolderId(null);
      await refreshData();
      showToast(`Deleted folder "${folder.name}"`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteDoc = async (doc: DocumentRecord) => {
    try {
      await apiFetch(`/documents/${doc.id}`, { method: 'DELETE' });
      await refreshData();
      showToast(`Deleted "${doc.title}"`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDownloadDocument = (doc: DocumentRecord) => {
    if (doc.data_url) {
      const link = document.createElement('a');
      link.href = doc.data_url;
      link.download = doc.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    const content = doc.word_content
      ? doc.word_content.replace(/<[^>]*>/g, ' ')
      : `KMFRI Document Record\nTitle: ${doc.title}\nFile: ${doc.file_name}\nCategory: ${doc.category}\nVersion: v${doc.version}\nStorage Path: ${doc.storage_path}\nUploaded At: ${doc.created_at}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.file_name.endsWith('.txt') || doc.file_name.endsWith('.docx') ? doc.file_name : `${doc.file_name}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyShareLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
    showToast('SharePoint collaborative link copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* SharePoint & Word Collaboration Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 font-bold">
              SharePoint &amp; Word Collaboration Hub
            </span>
            <span className="text-xs text-slate-500">Document Libraries &amp; Co-authoring</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1">
            Research Drive, Collaborative Documents &amp; Imagery
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            SharePoint-style versioning, document check-out locking, co-authoring in Word Studio, and live team chat sharing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* New Word Document Button */}
          <button
            type="button"
            onClick={handleCreateWordDoc}
            className="px-3.5 py-2 rounded-lg bg-[#185ABD] hover:bg-sky-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            title="Create a new research document in Microsoft Word Studio"
          >
            <FileEdit className="w-4 h-4" />
            <span>New Word Document (.docx)</span>
          </button>

          <button
            type="button"
            onClick={() => setFolderModalOpen(true)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
          >
            <FolderPlus className="w-4 h-4 text-amber-500" />
            <span>New Folder</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setDocFolderId(selectedFolderId || '');
              setUploadModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            <span>Upload File / Image</span>
          </button>
        </div>
      </div>

      {/* SharePoint Team Libraries Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-500 text-[11px] px-2 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-sky-600" />
          <span>Team Libraries:</span>
        </span>
        {(
          [
            { id: 'all', label: 'All Research Libraries' },
            { id: 'oceans', label: 'Oceans & Coastal Systems' },
            { id: 'freshwater', label: 'Freshwater & Aquaculture' },
            { id: 'grants', label: 'Grants & MOUs' },
            { id: 'surveys', label: 'Cruise & GIS Surveys' },
          ] as const
        ).map((lib) => (
          <button
            key={lib.id}
            type="button"
            onClick={() => setTeamLibrary(lib.id)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              teamLibrary === lib.id
                ? 'bg-[#0A2540] dark:bg-sky-600 text-white font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {lib.label}
          </button>
        ))}
      </div>

      {/* Search, Category Filter & View Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents, folders, Word manuscripts, or images..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          >
            <option value="all">All File &amp; Image Categories</option>
            <option value="Shared Image">Shared Field / Lab Images</option>
            <option value="Dataset File">Dataset Files</option>
            <option value="Project Document">Project Documents &amp; Word Files</option>
            <option value="Report Attachment">Report Attachments</option>
            <option value="Research Output">Research Output Manuscripts</option>
            <option value="Funding Agreement">Funding Agreements</option>
            <option value="MOU Agreement">MOU Agreements</option>
          </select>

          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1.5 text-xs flex items-center gap-1 ${
                viewMode === 'grid'
                  ? 'bg-[#0A2540] dark:bg-sky-600 text-white'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1.5 text-xs flex items-center gap-1 ${
                viewMode === 'table'
                  ? 'bg-[#0A2540] dark:bg-sky-600 text-white'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Shared Folders Section */}
      {!selectedFolderId ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Folder className="w-4 h-4 text-amber-500" />
              <span>Shared Research Folders ({filteredFolders.length})</span>
            </h2>
          </div>

          {filteredFolders.length === 0 ? (
            <div className="py-6 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
              No shared folders yet. Click <strong>"New Folder"</strong> above to create collaborative folders for expeditions, lab imagery, or publications.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {filteredFolders.map((folder) => {
                const folderFilesCount = db.documents.filter(
                  (d) => d.folder_id === folder.id
                ).length;
                return (
                  <div
                    key={folder.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500/60 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col justify-between transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedFolderId(folder.id)}
                          className="flex items-center gap-2 text-left group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                            <Folder className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-sky-600 line-clamp-1">
                              {folder.name}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {folderFilesCount} file(s)
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteFolder(folder)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Delete folder"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {folder.description && (
                        <p className="text-[11px] text-slate-500 mt-2 line-clamp-2">
                          {folder.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <button
                        type="button"
                        onClick={() => setSelectedFolderId(folder.id)}
                        className="font-semibold text-sky-700 dark:text-sky-400 hover:underline"
                      >
                        Open Folder →
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          shareToLiveChat({
                            id: `folder-${folder.id}`,
                            type: 'folder',
                            title: folder.name,
                            reference_id: folder.id,
                          })
                        }
                        className="text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 font-medium"
                      >
                        <MessageSquareShare className="w-3 h-3" />
                        <span>Share</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedFolderId(null)}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Folders</span>
            </button>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Folder className="w-4 h-4 text-amber-500" />
                <span>{activeFolder?.name}</span>
              </div>
              <div className="text-xs text-slate-500">
                {activeFolder?.description || 'Shared Research Folder'} · Created by{' '}
                {activeFolder?.created_by_name}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateWordDoc}
              className="px-3 py-1.5 rounded-lg bg-[#185ABD] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>New Word Document here</span>
            </button>

            {activeFolder && (
              <button
                type="button"
                onClick={() =>
                  shareToLiveChat({
                    id: `folder-${activeFolder.id}`,
                    type: 'folder',
                    title: activeFolder.name,
                    reference_id: activeFolder.id,
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <MessageSquareShare className="w-3.5 h-3.5" />
                <span>Share Folder</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Files, Word Documents & Images Display */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {activeFolder
              ? `Files & Documents in "${activeFolder.name}" (${filteredDocs.length})`
              : `All Shared Files, Documents & Imagery (${filteredDocs.length})`}
          </h2>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="py-12 px-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              No Files or Documents Found
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Click <strong>"New Word Document (.docx)"</strong> to co-author in KMFRI Word Studio or upload files and images.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredDocs.map((d) => {
              const isImg = d.category === 'Shared Image' || d.mime_type.startsWith('image/');
              const isWord =
                d.file_name.endsWith('.docx') ||
                d.file_name.endsWith('.doc') ||
                d.category === 'Project Document' ||
                d.word_content;
              const isCheckedOut = Boolean(d.checked_out_by);
              const isCheckedOutByMe = d.checked_out_by === user?.id;

              return (
                <div
                  key={d.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between bg-slate-50/40 dark:bg-slate-950/40 shadow-xs hover:border-sky-500/50 transition-all"
                >
                  <div>
                    {isImg && d.data_url ? (
                      <div
                        onClick={() =>
                          setLightboxImage({ url: d.data_url!, title: d.title })
                        }
                        className="h-40 w-full bg-slate-900 overflow-hidden cursor-pointer relative group"
                      >
                        <img
                          src={d.data_url}
                          alt={d.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono">
                          Image
                        </span>
                      </div>
                    ) : (
                      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                              isWord
                                ? 'bg-[#185ABD]/15 text-[#185ABD]'
                                : 'bg-sky-500/15 text-sky-600'
                            }`}
                          >
                            {isWord ? (
                              <span className="font-serif font-black text-sm">W</span>
                            ) : (
                              <FileText className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] font-mono text-slate-500">
                              v{d.version} · {(d.file_size_bytes / 1024).toFixed(0)} KB
                            </span>
                            <div className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-1">
                              {d.file_name}
                            </div>
                          </div>
                        </div>

                        {/* SharePoint Check-Out Lock Indicator */}
                        {isCheckedOut && (
                          <div
                            className={`p-1 rounded-full ${
                              isCheckedOutByMe
                                ? 'bg-amber-500/20 text-amber-600'
                                : 'bg-rose-500/20 text-rose-600'
                            }`}
                            title={
                              isCheckedOutByMe
                                ? 'Locked by you for editing'
                                : `Checked out by ${d.checked_out_by_name}`
                            }
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                          {d.category}
                        </span>
                        {isCheckedOut && (
                          <span className="text-[9px] font-mono text-amber-600 dark:text-amber-400">
                            Locked: {d.checked_out_by_name?.split(' ')[0]}
                          </span>
                        )}
                      </div>

                      <h3 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                        {d.title}
                      </h3>
                    </div>
                  </div>

                  <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                    {/* Open in Word Studio */}
                    <button
                      type="button"
                      onClick={() => setActiveWordDoc(d)}
                      className="font-bold text-[#185ABD] hover:underline flex items-center gap-1"
                    >
                      <FileEdit className="w-3 h-3" />
                      <span>Word Studio</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {/* Check-Out / Lock Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleCheckOut(d)}
                        className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        title={isCheckedOut ? 'Check In (Unlock)' : 'Check Out (Lock for edits)'}
                      >
                        {isCheckedOut ? (
                          <Unlock className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <Lock className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Version History */}
                      <button
                        type="button"
                        onClick={() => setVersionHistoryDoc(d)}
                        className="text-slate-500 hover:text-slate-800"
                        title="Version History"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>

                      {/* Share & Permissions */}
                      <button
                        type="button"
                        onClick={() => setSharingDoc(d)}
                        className="text-slate-500 hover:text-slate-800"
                        title="SharePoint Link & Permissions"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Download */}
                      <button
                        type="button"
                        onClick={() => handleDownloadDocument(d)}
                        className="text-slate-500 hover:text-slate-800"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(d)}
                        className="text-slate-400 hover:text-rose-600"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Document / File</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Status / Lock</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredDocs.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded bg-[#185ABD]/15 text-[#185ABD] flex items-center justify-center font-bold text-xs shrink-0">
                          W
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {d.title}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">{d.file_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{d.category}</td>
                    <td className="py-3 px-4 font-mono">v{d.version}</td>
                    <td className="py-3 px-4">
                      {d.checked_out_by ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-600">
                          <Lock className="w-3 h-3" />
                          <span>Locked ({d.checked_out_by_name?.split(' ')[0]})</span>
                        </span>
                      ) : (
                        <span className="text-emerald-600 text-[11px]">Available</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">{(d.file_size_bytes / 1024).toFixed(0)} KB</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveWordDoc(d)}
                          className="px-2.5 py-1 rounded bg-[#185ABD] text-white text-[11px] font-semibold"
                        >
                          Open in Word
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleCheckOut(d)}
                          className="p-1 rounded border border-slate-200 hover:bg-slate-100"
                        >
                          {d.checked_out_by ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setVersionHistoryDoc(d)}
                          className="p-1 rounded border border-slate-200 hover:bg-slate-100"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Word Studio Modal (Full-featured online document editor) */}
      {activeWordDoc && (
        <KmfriWordStudio
          document={activeWordDoc}
          onClose={() => setActiveWordDoc(null)}
          onSave={handleSaveWordDocument}
        />
      )}

      {/* SharePoint Version History Modal */}
      {versionHistoryDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-sky-600" />
                  <span>SharePoint Version History</span>
                </h3>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  {versionHistoryDoc.title}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVersionHistoryDoc(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto text-xs">
              {(versionHistoryDoc.version_history || [
                {
                  version: versionHistoryDoc.version,
                  updated_at: versionHistoryDoc.created_at,
                  updated_by_name: 'Lead Scientist',
                  summary: 'Current production version',
                },
              ]).map((ver, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-mono font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300">
                        v{ver.version}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {ver.updated_by_name}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">{ver.summary}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(ver.updated_at).toLocaleString()}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      showToast(`Restored version v${ver.version}`);
                      setVersionHistoryDoc(null);
                    }}
                    className="px-2.5 py-1 rounded border border-slate-300 text-xs font-semibold hover:bg-slate-100"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setVersionHistoryDoc(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SharePoint Share & Permissions Modal */}
      {sharingDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-sky-600" />
                  <span>SharePoint Collaborative Sharing</span>
                </h3>
                <div className="text-slate-500 mt-0.5">{sharingDoc.title}</div>
              </div>
              <button type="button" onClick={() => setSharingDoc(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Collaboration Permission</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'edit', label: 'Can Edit (Word)' },
                      { id: 'review', label: 'Can Review' },
                      { id: 'view', label: 'Can View Only' },
                    ] as const
                  ).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setShareRole(r.id)}
                      className={`p-2 rounded-lg border text-center font-medium ${
                        shareRole === r.id
                          ? 'border-[#185ABD] bg-sky-50 dark:bg-sky-950/50 text-[#185ABD] font-bold'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">SharePoint Secure Direct Link</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/documents/${sharingDoc.id}`}
                    className="flex-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={copyShareLink}
                    className="px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg flex items-center gap-1"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    shareToLiveChat({
                      id: `doc-${sharingDoc.id}`,
                      type: 'file',
                      title: sharingDoc.title,
                      file_name: sharingDoc.file_name,
                      reference_id: sharingDoc.id,
                      size_bytes: sharingDoc.file_size_bytes,
                    });
                    setSharingDoc(null);
                  }}
                  className="w-full py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <MessageSquareShare className="w-4 h-4" />
                  <span>Broadcast to Scientist Live Chat</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload File / Image Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-600" />
                <span>Upload Research File, Image or Dataset</span>
              </h3>
              <button type="button" onClick={() => setUploadModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3 text-xs">
              {formError && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-medium mb-1">Select File or Photo from Device</label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Document / Photo Title</label>
                <input
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g., Mombasa CTD Profiler Survey Q1"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Category</label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="Project Document">Project Document</option>
                    <option value="Shared Image">Shared Field / Lab Image</option>
                    <option value="Dataset File">Dataset File</option>
                    <option value="Report Attachment">Report Attachment</option>
                    <option value="Research Output">Research Output</option>
                    <option value="MOU Agreement">MOU Agreement</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Assign to Folder</label>
                  <select
                    value={docFolderId}
                    onChange={(e) => setDocFolderId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="">No Folder (Root)</option>
                    {db.shared_folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Research Notes / Description</label>
                <textarea
                  rows={2}
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                  placeholder="Sampling coordinates, camera metadata, or vessel log notes..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Save & Share'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {folderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-amber-500" />
                <span>Create Shared Research Folder</span>
              </h3>
              <button type="button" onClick={() => setFolderModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Folder Name</label>
                <input
                  type="text"
                  required
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g., Mombasa Marine Park Coral Transects 2026"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Description &amp; Research Focus</label>
                <textarea
                  rows={2}
                  value={folderDesc}
                  onChange={(e) => setFolderDesc(e.target.value)}
                  placeholder="Shared repository for dive photos, CTD logs, and manuscripts..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFolderModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.title}
              className="max-w-full max-h-[80vh] rounded-lg object-contain shadow-2xl"
            />
            <div className="text-white text-sm font-semibold mt-3 text-center">
              {lightboxImage.title}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
