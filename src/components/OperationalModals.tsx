import React, { useState, useEffect } from 'react';
import {
  BootstrapData,
  UserRecord,
  ProjectRecord,
  ReportRecord,
} from '../types.ts';
import { X, Camera } from 'lucide-react';

interface OperationalModalsProps {
  activeModal:
    | null
    | 'USER'
    | 'PROJECT'
    | 'FUNDER'
    | 'FUNDING'
    | 'REPORT'
    | 'REVIEW_REPORT'
    | 'LOCATION'
    | 'COLLABORATOR'
    | 'OUTPUT'
    | 'DOCUMENT';
  editingUser?: UserRecord | null;
  editingProject?: ProjectRecord | null;
  reviewingReport?: ReportRecord | null;
  pickedCoords?: { lat: number; lng: number; county?: string; marineArea?: string; site?: string } | null;
  data: BootstrapData;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  apiFetch: <T = any>(path: string, options?: RequestInit) => Promise<T>;
}

export const OperationalModals: React.FC<OperationalModalsProps> = ({
  activeModal,
  editingUser,
  editingProject,
  reviewingReport,
  pickedCoords,
  data,
  onClose,
  onRefresh,
  apiFetch,
}) => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 1. User Form
  const [userForm, setUserForm] = useState({
    fullName: editingUser?.fullName || '',
    email: editingUser?.email || '',
    password: '',
    phone: editingUser?.phone || '+254 ',
    staffNumber:
      editingUser?.staffNumber ||
      `KMFRI-${Math.floor(1000 + Math.random() * 9000)}`,
    position: editingUser?.position || 'Senior Research Scientist',
    directorateId:
      editingUser?.directorateId || data.directorates[0]?.id || '',
    researchAreaId:
      editingUser?.researchAreaId || data.researchAreas[0]?.id || '',
    roleId:
      editingUser?.roleId ||
      data.roles.find((r) => r.name === 'SCIENTIST/RESEARCHER')?.id ||
      '',
    status: editingUser?.status || 'Active',
    profilePhoto: editingUser?.profilePhoto || '',
  });

  useEffect(() => {
    if (activeModal === 'USER') {
      setUserForm({
        fullName: editingUser?.fullName || '',
        email: editingUser?.email || '',
        password: '',
        phone: editingUser?.phone || '+254 ',
        staffNumber:
          editingUser?.staffNumber ||
          `KMFRI-${Math.floor(1000 + Math.random() * 9000)}`,
        position: editingUser?.position || 'Senior Research Scientist',
        directorateId:
          editingUser?.directorateId || data.directorates[0]?.id || '',
        researchAreaId:
          editingUser?.researchAreaId || data.researchAreas[0]?.id || '',
        roleId:
          editingUser?.roleId ||
          data.roles.find((r) => r.name === 'SCIENTIST/RESEARCHER')?.id ||
          '',
        status: editingUser?.status || 'Active',
        profilePhoto: editingUser?.profilePhoto || '',
      });
    }
  }, [activeModal, editingUser]);

  // 2. Project Form
  const [projForm, setProjForm] = useState({
    projectCode:
      editingProject?.projectCode ||
      `KMFRI-OCS-${new Date().getFullYear()}-${String(data.projects.length + 1).padStart(2, '0')}`,
    title: editingProject?.title || '',
    description: editingProject?.description || '',
    objectives: editingProject?.objectives || '',
    deliverables: editingProject?.deliverables || '',
    risksIssues: editingProject?.risksIssues || '',
    directorateId:
      editingProject?.directorateId || data.directorates[0]?.id || '',
    researchAreaId:
      editingProject?.researchAreaId || data.researchAreas[0]?.id || '',
    principalInvestigatorId:
      editingProject?.principalInvestigatorId || data.currentUser.id,
    startDate:
      editingProject?.startDate || new Date().toISOString().slice(0, 10),
    endDate: editingProject?.endDate || '2027-06-30',
    status: editingProject?.status || 'Proposed',
    priority: editingProject?.priority || 'High',
    budget: editingProject?.budget || '8500000',
    currency: editingProject?.currency || 'KES',
    progressPercent: editingProject?.progressPercent ?? 15,
    locationSummary:
      editingProject?.locationSummary || 'Mombasa Inshore & Kenyan EEZ',
  });

  // 3. Funder Form
  const [funderForm, setFunderForm] = useState({
    name: '',
    type: 'Multilateral',
    country: 'Kenya',
    contactPerson: '',
    email: '',
    phone: '',
    website: '',
  });

  // 4. Funding / Grant Form
  const [fundingForm, setFundingForm] = useState({
    projectId: data.projects[0]?.id || '',
    funderId: data.funders[0]?.id || '',
    grantNumber: `GR-KMFRI-${new Date().getFullYear()}-${String(data.funding.length + 101)}`,
    amount: '150000',
    currency: 'USD',
    awardDate: new Date().toISOString().slice(0, 10),
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '2027-12-31',
    allocatedAmount: '135000',
    spentAmount: '25000',
    status: 'Active',
    documentUrl: '',
    notes: '',
  });

  // 5. Report Form
  const [reportForm, setReportForm] = useState({
    projectId: data.projects[0]?.id || '',
    scientistId: data.currentUser.id,
    title: '',
    reportType: 'Quarterly Progress',
    reportingPeriod: 'Q3 2026',
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    status: 'Submitted',
    fileUrl: '',
    version: '1.0',
  });

  // 6. Review Report Form
  const [reviewForm, setReviewForm] = useState({
    status: 'Approved' as 'Under Review' | 'Approved' | 'Rejected',
    reviewComments: '',
  });

  // 7. Location Form
  const [locForm, setLocForm] = useState({
    name: pickedCoords?.site || '',
    country: 'Kenya',
    county: pickedCoords?.county || 'Mombasa',
    subCounty: 'Mvita',
    site: pickedCoords?.site || 'English Point Station',
    latitude: String(pickedCoords?.lat ?? -4.0547),
    longitude: String(pickedCoords?.lng ?? 39.6836),
    marineArea: pickedCoords?.marineArea || 'Tudor Creek & Mombasa Inshore Waters',
    description: '',
    projectId: data.projects[0]?.id || '',
    activityDescription: 'Hydrographic & biological sampling station',
  });

  // 8. Collaborator Form
  const [collabForm, setCollabForm] = useState({
    organizationName: '',
    contactPerson: '',
    email: '',
    phone: '',
    country: 'Kenya',
    organizationType: 'Research Institute',
    collaborationType: 'Joint Research',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '2028-12-31',
    mouDocumentUrl: '',
    notes: '',
    projectId: data.projects[0]?.id || '',
  });

  // 9. Research Output Form
  const [outputForm, setOutputForm] = useState({
    title: '',
    outputType: 'Peer-Reviewed Publication',
    projectId: data.projects[0]?.id || '',
    leadScientistId: data.currentUser.id,
    journalOrEvent: 'Western Indian Ocean Journal of Marine Science (WIOJMS)',
    doi: '',
    url: '',
    publicationDate: new Date().toISOString().slice(0, 10),
    abstract: '',
    keywords: 'Marine Ecology, Kenyan EEZ, Fisheries Stock Assessment, Blue Carbon',
    status: 'Published',
  });

  // 10. Document Form
  const [docForm, setDocForm] = useState({
    projectId: data.projects[0]?.id || '',
    name: '',
    type: 'Proposal',
    fileUrl: '',
    fileSize: '320 KB',
    version: '1.0',
  });

  if (!activeModal) return null;

  const submitWrapper = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await onRefresh();
      onClose();
    } catch (e: any) {
      setErr(e.message || 'Operation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {activeModal === 'USER' &&
              (editingUser ? 'Edit Researcher Account' : 'Register KMFRI Scientist Account')}
            {activeModal === 'PROJECT' &&
              (editingProject ? 'Edit Research Project' : 'Create KMFRI Research Project')}
            {activeModal === 'FUNDER' && 'Register Funding Agency / Donor'}
            {activeModal === 'FUNDING' && 'Record Project Grant Allocation'}
            {activeModal === 'REPORT' && 'Create / Submit Scientific Report'}
            {activeModal === 'REVIEW_REPORT' && `Review Report: ${reviewingReport?.title}`}
            {activeModal === 'LOCATION' && 'Register GIS Marine / Freshwater Station'}
            {activeModal === 'COLLABORATOR' && 'Register Partner Collaborator & MOU'}
            {activeModal === 'OUTPUT' && 'Record Research Output (Publication / Dataset)'}
            {activeModal === 'DOCUMENT' && 'Upload / Register Institutional Document'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {err && (
          <div className="px-6 py-2.5 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200">
            {err}
          </div>
        )}

        <div className="p-6 overflow-y-auto text-xs space-y-4">
          {activeModal === 'USER' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitWrapper(async () => {
                  if (editingUser) {
                    await apiFetch(`/api/users/${editingUser.id}`, {
                      method: 'PUT',
                      body: JSON.stringify(userForm),
                    });
                  } else {
                    await apiFetch('/api/users', {
                      method: 'POST',
                      body: JSON.stringify(userForm),
                    });
                  }
                });
              }}
              className="space-y-3"
            >
              {/* Scientist Profile Photo Upload */}
              <div className="flex items-center gap-4 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                {userForm.profilePhoto ? (
                  <img
                    src={userForm.profilePhoto}
                    alt={userForm.fullName || 'Scientist'}
                    className="w-14 h-14 rounded-full object-cover border-2 border-sky-600 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-sky-700 text-white font-bold text-base flex items-center justify-center shrink-0">
                    {(userForm.fullName || 'KM')
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                )}
                <div className="space-y-1 flex-1">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Scientist Profile Picture
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Visible on Scientist Dashboard, Directory, and Live Chatbox.
                  </p>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-[11px] font-semibold cursor-pointer">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Upload Profile Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            setUserForm((prev) => ({
                              ...prev,
                              profilePhoto: reader.result as string,
                            }));
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={userForm.fullName}
                    onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                    placeholder="Dr. Kazungu Mwangi"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Institutional Email *</label>
                  <input
                    type="email"
                    required
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="kmwangi@kmfri.go.ke"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Staff Number (Unique) *</label>
                  <input
                    type="text"
                    required
                    value={userForm.staffNumber}
                    onChange={(e) =>
                      setUserForm({ ...userForm, staffNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Position / Grade</label>
                  <input
                    type="text"
                    value={userForm.position}
                    onChange={(e) => setUserForm({ ...userForm, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Directorate</label>
                  <select
                    value={userForm.directorateId}
                    onChange={(e) =>
                      setUserForm({ ...userForm, directorateId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {data.directorates.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Research Area</label>
                  <select
                    value={userForm.researchAreaId}
                    onChange={(e) =>
                      setUserForm({ ...userForm, researchAreaId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {data.researchAreas.map((ra) => (
                      <option key={ra.id} value={ra.id}>
                        {ra.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">System RBAC Role</label>
                  <select
                    value={userForm.roleId}
                    onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {data.roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Phone Contact</label>
                  <input
                    type="text"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-medium mb-1">
                    {editingUser
                      ? 'Reset / Update Account Password (leave blank to keep current)'
                      : 'Initial Researcher Password (min 6 characters) *'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    minLength={6}
                    value={userForm.password}
                    onChange={(e) =>
                      setUserForm({ ...userForm, password: e.target.value })
                    }
                    placeholder="Enter secure password for researcher sign-in..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-sky-700 text-white font-medium"
                >
                  {editingUser ? 'Save Changes' : 'Create Scientist Account'}
                </button>
              </div>
            </form>
          )}

          {activeModal === 'PROJECT' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitWrapper(async () => {
                  if (editingProject) {
                    await apiFetch(`/api/projects/${editingProject.id}`, {
                      method: 'PUT',
                      body: JSON.stringify(projForm),
                    });
                  } else {
                    await apiFetch('/api/projects', {
                      method: 'POST',
                      body: JSON.stringify(projForm),
                    });
                  }
                });
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Project Code (Unique) *</label>
                  <input
                    type="text"
                    required
                    value={projForm.projectCode}
                    onChange={(e) =>
                      setProjForm({ ...projForm, projectCode: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-medium mb-1">Project Title *</label>
                  <input
                    type="text"
                    required
                    value={projForm.title}
                    onChange={(e) => setProjForm({ ...projForm, title: e.target.value })}
                    placeholder="e.g., Hydrographic & Pelagic Stock Assessment of the North Kenya Banks"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Directorate</label>
                  <select
                    value={projForm.directorateId}
                    onChange={(e) =>
                      setProjForm({ ...projForm, directorateId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {data.directorates.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Research Area</label>
                  <select
                    value={projForm.researchAreaId}
                    onChange={(e) =>
                      setProjForm({ ...projForm, researchAreaId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {data.researchAreas.map((ra) => (
                      <option key={ra.id} value={ra.id}>
                        {ra.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Principal Investigator</label>
                  <select
                    value={projForm.principalInvestigatorId}
                    onChange={(e) =>
                      setProjForm({
                        ...projForm,
                        principalInvestigatorId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {data.users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.staffNumber})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={projForm.startDate}
                    onChange={(e) =>
                      setProjForm({ ...projForm, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={projForm.endDate}
                    onChange={(e) => setProjForm({ ...projForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Status</label>
                  <select
                    value={projForm.status}
                    onChange={(e) => setProjForm({ ...projForm, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {[
                      'Proposed',
                      'Approved',
                      'In Progress',
                      'Suspended',
                      'Completed',
                      'Cancelled',
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Priority</label>
                  <select
                    value={projForm.priority}
                    onChange={(e) => setProjForm({ ...projForm, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {['Low', 'Medium', 'High', 'Critical'].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Budget Amount</label>
                  <input
                    type="number"
                    value={projForm.budget}
                    onChange={(e) => setProjForm({ ...projForm, budget: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Currency</label>
                  <select
                    value={projForm.currency}
                    onChange={(e) => setProjForm({ ...projForm, currency: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="KES">KES</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Progress %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={projForm.progressPercent}
                    onChange={(e) =>
                      setProjForm({
                        ...projForm,
                        progressPercent: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Scientific Description</label>
                <textarea
                  rows={2}
                  value={projForm.description}
                  onChange={(e) =>
                    setProjForm({ ...projForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Objectives</label>
                  <textarea
                    rows={2}
                    value={projForm.objectives}
                    onChange={(e) =>
                      setProjForm({ ...projForm, objectives: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Deliverables & Risks</label>
                  <textarea
                    rows={2}
                    value={projForm.deliverables}
                    onChange={(e) =>
                      setProjForm({ ...projForm, deliverables: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-sky-700 text-white font-medium"
                >
                  {editingProject ? 'Update Project' : 'Create Project'}
                </button>
              </div>
            </form>
          )}

          {activeModal === 'FUNDER' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitWrapper(async () => {
                  await apiFetch('/api/funders', {
                    method: 'POST',
                    body: JSON.stringify(funderForm),
                  });
                });
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Funder / Donor Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., WIOMSA / World Bank KEMFSED / NRF Kenya"
                    value={funderForm.name}
                    onChange={(e) => setFunderForm({ ...funderForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Agency Type</label>
                  <select
                    value={funderForm.type}
                    onChange={(e) => setFunderForm({ ...funderForm, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="Government">Government of Kenya</option>
                    <option value="Multilateral">Multilateral Agency</option>
                    <option value="Bilateral">Bilateral Partner</option>
                    <option value="International NGO">International Scientific Body</option>
                    <option value="Foundation">Philanthropic Foundation</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Country</label>
                  <input
                    type="text"
                    value={funderForm.country}
                    onChange={(e) =>
                      setFunderForm({ ...funderForm, country: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Contact Person & Email</label>
                  <input
                    type="text"
                    placeholder="grants@wiomsa.org"
                    value={funderForm.email}
                    onChange={(e) =>
                      setFunderForm({ ...funderForm, email: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-sky-700 text-white font-medium"
                >
                  Register Funder
                </button>
              </div>
            </form>
          )}

          {activeModal === 'FUNDING' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitWrapper(async () => {
                  await apiFetch('/api/funding', {
                    method: 'POST',
                    body: JSON.stringify(fundingForm),
                  });
                });
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Grant Number (Unique) *</label>
                  <input
                    type="text"
                    required
                    value={fundingForm.grantNumber}
                    onChange={(e) =>
                      setFundingForm({ ...fundingForm, grantNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Target Research Project *</label>
                  <select
                    required
                    value={fundingForm.projectId}
                    onChange={(e) =>
                      setFundingForm({ ...fundingForm, projectId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">Select Project...</option>
                    {data.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} — {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Funding Agency *</label>
                  <select
                    required
                    value={fundingForm.funderId}
                    onChange={(e) =>
                      setFundingForm({ ...fundingForm, funderId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">Select Funder...</option>
                    {data.funders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.country})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Currency</label>
                  <select
                    value={fundingForm.currency}
                    onChange={(e) =>
                      setFundingForm({ ...fundingForm, currency: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="USD">USD</option>
                    <option value="KES">KES</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Total Grant Award *</label>
                  <input
                    type="number"
                    required
                    value={fundingForm.amount}
                    onChange={(e) =>
                      setFundingForm({ ...fundingForm, amount: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Allocated Amount *</label>
                  <input
                    type="number"
                    required
                    value={fundingForm.allocatedAmount}
                    onChange={(e) =>
                      setFundingForm({
                        ...fundingForm,
                        allocatedAmount: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Spent to Date</label>
                  <input
                    type="number"
                    value={fundingForm.spentAmount}
                    onChange={(e) =>
                      setFundingForm({ ...fundingForm, spentAmount: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Award Date</label>
                  <input
                    type="date"
                    value={fundingForm.awardDate}
                    onChange={(e) =>
                      setFundingForm({ ...fundingForm, awardDate: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-sky-700 text-white font-medium"
                >
                  Record Grant Allocation
                </button>
              </div>
            </form>
          )}

          {activeModal === 'REPORT' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitWrapper(async () => {
                  await apiFetch('/api/reports', {
                    method: 'POST',
                    body: JSON.stringify(reportForm),
                  });
                });
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block font-medium mb-1">Report Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Q3 Hydrographic & Plankton Biomass Technical Progress Report"
                    value={reportForm.title}
                    onChange={(e) =>
                      setReportForm({ ...reportForm, title: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Research Project *</label>
                  <select
                    required
                    value={reportForm.projectId}
                    onChange={(e) =>
                      setReportForm({ ...reportForm, projectId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">Select Project...</option>
                    {data.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} — {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Report Type</label>
                  <select
                    value={reportForm.reportType}
                    onChange={(e) =>
                      setReportForm({ ...reportForm, reportType: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="Quarterly Progress">Quarterly Progress</option>
                    <option value="Annual Technical">Annual Technical</option>
                    <option value="Field Cruise Report">Field Cruise Report</option>
                    <option value="Financial Utilization">Financial Utilization</option>
                    <option value="Final Completion">Final Completion</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Reporting Period</label>
                  <input
                    type="text"
                    required
                    value={reportForm.reportingPeriod}
                    onChange={(e) =>
                      setReportForm({
                        ...reportForm,
                        reportingPeriod: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={reportForm.dueDate}
                    onChange={(e) =>
                      setReportForm({ ...reportForm, dueDate: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Workflow Action</label>
                  <select
                    value={reportForm.status}
                    onChange={(e) =>
                      setReportForm({ ...reportForm, status: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="Draft">Save as Draft</option>
                    <option value="Submitted">Submit Immediately for Review</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Attachment URL / Document</label>
                  <input
                    type="text"
                    placeholder="https://repository.kmfri.go.ke/reports/..."
                    value={reportForm.fileUrl}
                    onChange={(e) =>
                      setReportForm({ ...reportForm, fileUrl: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-sky-700 text-white font-medium"
                >
                  Save / Submit Report
                </button>
              </div>
            </form>
          )}

          {activeModal === 'REVIEW_REPORT' && reviewingReport && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitWrapper(async () => {
                  await apiFetch(`/api/reports/${reviewingReport.id}/review`, {
                    method: 'PATCH',
                    body: JSON.stringify(reviewForm),
                  });
                });
              }}
              className="space-y-3"
            >
              <div>
                <label className="block font-medium mb-1">Review Decision</label>
                <select
                  value={reviewForm.status}
                  onChange={(e) =>
                    setReviewForm({ ...reviewForm, status: e.target.value as any })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="Under Review">Mark Under Review</option>
                  <option value="Approved">Approve Report</option>
                  <option value="Rejected">Reject & Request Revisions</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">
                  Directorate / Reviewer Comments
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide technical evaluation feedback for the lead scientist..."
                  value={reviewForm.reviewComments}
                  onChange={(e) =>
                    setReviewForm({ ...reviewForm, reviewComments: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium"
                >
                  Submit Review Decision
                </button>
              </div>
            </form>
          )}

          {activeModal === 'LOCATION' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitWrapper(async () => {
                  await apiFetch('/api/locations', {
                    method: 'POST',
                    body: JSON.stringify(locForm),
                  });
                });
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Station / Site Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Gazi Bay Mangrove Carbon Flux Tower"
                    value={locForm.name}
                    onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">County *</label>
                  <input
                    type="text"
                    required
                    value={locForm.county}
                    onChange={(e) => setLocForm({ ...locForm, county: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Latitude (WGS84) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={locForm.latitude}
                    onChange={(e) =>
                      setLocForm({ ...locForm, latitude: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Longitude (WGS84) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={locForm.longitude}
                    onChange={(e) =>
                      setLocForm({ ...locForm, longitude: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Specific Locality / Site *</label>
                  <input
                    type="text"
                    required
                    value={locForm.site}
                    onChange={(e) => setLocForm({ ...locForm, site: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Marine / Freshwater Basin *</label>
                  <input
                    type="text"
                    required
                    value={locForm.marineArea}
                    onChange={(e) =>
                      setLocForm({ ...locForm, marineArea: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-medium mb-1">Link to Research Project</label>
                  <select
                    value={locForm.projectId}
                    onChange={(e) =>
                      setLocForm({ ...locForm, projectId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">Optional: Link to Project...</option>
                    {data.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} — {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-sky-700 text-white font-medium"
                >
                  Save GIS Location
                </button>
              </div>
            </form>
          )}

          {activeModal === 'COLLABORATOR' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitWrapper(async () => {
                  await apiFetch('/api/collaborators', {
                    method: 'POST',
                    body: JSON.stringify({
                      ...collabForm,
                      projectIds: collabForm.projectId ? [collabForm.projectId] : [],
                    }),
                  });
                });
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Partner Organization Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Technical University of Mombasa / CORDIO East Africa"
                    value={collabForm.organizationName}
                    onChange={(e) =>
                      setCollabForm({
                        ...collabForm,
                        organizationName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Organization Type</label>
                  <select
                    value={collabForm.organizationType}
                    onChange={(e) =>
                      setCollabForm({
                        ...collabForm,
                        organizationType: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="University">University</option>
                    <option value="Research Institute">Research Institute</option>
                    <option value="Government Agency">Government Agency</option>
                    <option value="International Body">International Body</option>
                    <option value="NGO">Conservation NGO</option>
                    <option value="Community (BMU)">Beach Management Unit (BMU)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Collaboration Type</label>
                  <select
                    value={collabForm.collaborationType}
                    onChange={(e) =>
                      setCollabForm({
                        ...collabForm,
                        collaborationType: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="Joint Research">Joint Research</option>
                    <option value="Technical Exchange">Technical & Vessel Exchange</option>
                    <option value="Data Sharing">Oceanographic Data Sharing</option>
                    <option value="Funding & Capacity Building">Funding & Capacity Building</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Country</label>
                  <input
                    type="text"
                    value={collabForm.country}
                    onChange={(e) =>
                      setCollabForm({ ...collabForm, country: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={collabForm.contactPerson}
                    onChange={(e) =>
                      setCollabForm({ ...collabForm, contactPerson: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={collabForm.email}
                    onChange={(e) =>
                      setCollabForm({ ...collabForm, email: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-sky-700 text-white font-medium"
                >
                  Save Collaborator
                </button>
              </div>
            </form>
          )}

          {activeModal === 'OUTPUT' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitWrapper(async () => {
                  await apiFetch('/api/outputs', {
                    method: 'POST',
                    body: JSON.stringify(outputForm),
                  });
                });
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block font-medium mb-1">Output Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Blue Carbon Stocks and Sequestration Rates in Gazi Bay Mangroves"
                    value={outputForm.title}
                    onChange={(e) =>
                      setOutputForm({ ...outputForm, title: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Output Type</label>
                  <select
                    value={outputForm.outputType}
                    onChange={(e) =>
                      setOutputForm({ ...outputForm, outputType: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="Peer-Reviewed Publication">Peer-Reviewed Publication</option>
                    <option value="Technical Report">Technical Report</option>
                    <option value="Oceanographic Dataset">Oceanographic Dataset</option>
                    <option value="Conference Presentation">Conference Presentation</option>
                    <option value="Policy Brief">Policy Brief</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Related Project</label>
                  <select
                    value={outputForm.projectId}
                    onChange={(e) =>
                      setOutputForm({ ...outputForm, projectId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">Institutional / General Output</option>
                    {data.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} — {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Journal / Conference / Repository</label>
                  <input
                    type="text"
                    value={outputForm.journalOrEvent}
                    onChange={(e) =>
                      setOutputForm({
                        ...outputForm,
                        journalOrEvent: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">DOI / Persistent URL</label>
                  <input
                    type="text"
                    placeholder="10.4314/wiojms.v25i1.4"
                    value={outputForm.doi}
                    onChange={(e) =>
                      setOutputForm({ ...outputForm, doi: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-sky-700 text-white font-medium"
                >
                  Publish Output
                </button>
              </div>
            </form>
          )}

          {activeModal === 'DOCUMENT' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitWrapper(async () => {
                  await apiFetch('/api/documents', {
                    method: 'POST',
                    body: JSON.stringify(docForm),
                  });
                });
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block font-medium mb-1">Document Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Standard Operating Procedure — CTD Rosette Deployment.pdf"
                    value={docForm.name}
                    onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Document Category</label>
                  <select
                    value={docForm.type}
                    onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="Proposal">Research Proposal</option>
                    <option value="Cruise Plan">RV Mtafiti Cruise Plan</option>
                    <option value="Ethics Approval">NACOSTI / Ethics Permit</option>
                    <option value="Dataset Archive">Oceanographic Dataset</option>
                    <option value="MOU">Institutional MOU</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Linked Project</label>
                  <select
                    value={docForm.projectId}
                    onChange={(e) =>
                      setDocForm({ ...docForm, projectId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">General Institutional Document</option>
                    {data.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} — {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block font-medium mb-1">Document Link / File URI *</label>
                  <input
                    type="text"
                    required
                    placeholder="https://repository.kmfri.go.ke/docs/..."
                    value={docForm.fileUrl}
                    onChange={(e) =>
                      setDocForm({ ...docForm, fileUrl: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-sky-700 text-white font-medium"
                >
                  Register Document
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
