import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Award,
  Bell,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  FolderKanban,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  Shield,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { EmailDispatch, RoleCode, UserProfile } from '../types/kmfri.ts';
import { UserAvatar } from './UserAvatar.tsx';

export const ProfileModule: React.FC = () => {
  const {
    user,
    setUser,
    apiFetch,
    showToast,
    refreshData,
    db,
    onlineUserIds,
    setActiveModule,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'details' | 'security' | 'emails' | 'kpis'>('details');

  // Form states for profile update
  const [title, setTitle] = useState(user?.title || 'Dr.');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [officeStation, setOfficeStation] = useState(user?.office_station || 'Mombasa Headquarters (English Point)');
  const [position, setPosition] = useState(user?.position || '');
  const [orcidId, setOrcidId] = useState(user?.orcid_id || '');
  const [specialization, setSpecialization] = useState(user?.specialization || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');

  // Password reset state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });

  // Saving states
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Email dispatches log
  const [dispatchedEmails, setDispatchedEmails] = useState<EmailDispatch[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailDispatch | null>(null);

  // Sync state if user changes
  useEffect(() => {
    if (user) {
      setTitle(user.title || 'Dr.');
      setFullName(user.full_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setOfficeStation(user.office_station || 'Mombasa Headquarters (English Point)');
      setPosition(user.position || '');
      setOrcidId(user.orcid_id || '');
      setSpecialization(user.specialization || '');
      setBio(user.bio || '');
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  // Load user's automated email dispatches
  const loadEmails = async () => {
    setLoadingEmails(true);
    try {
      const res = await apiFetch('/emails/my-dispatches');
      if (res && res.emails) {
        setDispatchedEmails(res.emails);
      }
    } catch {
      // Fallback to db dispatches if available
      if (db?.email_dispatches) {
        const myMails = db.email_dispatches.filter(
          (e) => e.recipient_email.toLowerCase() === user?.email.toLowerCase()
        );
        setDispatchedEmails(myMails);
      }
    } finally {
      setLoadingEmails(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'emails') {
      loadEmails();
    }
  }, [activeTab]);

  if (!user) return null;

  // Handle Profile Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      showToast('Full name and email are required', 'error');
      return;
    }

    setSavingProfile(true);
    try {
      const updatedUser = await apiFetch(`/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title,
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          office_station: officeStation,
          position: position.trim(),
          orcid_id: orcidId.trim(),
          specialization: specialization.trim(),
          bio: bio.trim(),
          avatar_url: avatarUrl.trim() || undefined,
        }),
      });

      setUser(updatedUser);
      showToast('Profile information updated successfully. Automated alert sent to your email.', 'success');
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Avatar Image File Upload
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Image size must be less than 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setAvatarUrl(dataUrl);

      try {
        const res = await apiFetch(`/users/${user.id}/avatar`, {
          method: 'POST',
          body: JSON.stringify({ avatar_url: dataUrl }),
        });
        setUser(res);
        showToast('Profile photo updated successfully', 'success');
        await refreshData();
      } catch (err: any) {
        showToast(err.message || 'Failed to save avatar', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Password Reset / Change
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus({ type: 'idle', message: '' });

    if (!newPassword || newPassword.length < 6) {
      setPasswordStatus({
        type: 'error',
        message: 'New password must contain at least 6 characters.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({
        type: 'error',
        message: 'New password and confirmation password do not match.',
      });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword || undefined,
          new_password: newPassword,
        }),
      });

      setPasswordStatus({
        type: 'success',
        message: res.message || 'Password changed successfully! A confirmation email was automatically dispatched.',
      });
      showToast('Password updated successfully. Confirmation email dispatched.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await refreshData();
    } catch (err: any) {
      setPasswordStatus({
        type: 'error',
        message: err.message || 'Failed to change password. Please verify current password.',
      });
      showToast(err.message || 'Password update failed', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  // User Stats
  const userProjects = (db?.projects || []).filter(
    (p) =>
      p.principal_investigator_id === user.id ||
      (db?.project_members || []).some((pm) => pm.project_id === p.id && pm.user_id === user.id)
  );
  const userOutputs = (db?.research_outputs || []).filter(
    (o) =>
      o.lead_scientist_id === user.id ||
      (db?.output_authors || []).some((oa) => oa.output_id === o.id && oa.user_id === user.id)
  );
  const userReports = (db?.reports || []).filter((r) => r.scientist_id === user.id);

  return (
    <div className="space-y-6">
      {/* Scientist Profile Hero Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar with Camera upload trigger */}
          <div className="relative group shrink-0">
            <UserAvatar
              user={{ full_name: fullName, title, avatar_url: avatarUrl }}
              size="xl"
              isOnline={onlineUserIds.includes(user.id)}
            />
            <label
              htmlFor="avatar-file-input"
              className="absolute bottom-0 right-0 p-2 rounded-full bg-sky-600 hover:bg-sky-500 text-white cursor-pointer shadow-lg transition-transform group-hover:scale-110"
              title="Upload new profile picture"
            >
              <Camera className="w-4 h-4" />
              <input
                id="avatar-file-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarFile}
                className="hidden"
              />
            </label>
          </div>

          {/* Core Scientist Metadata */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-mono">
                Staff No: {user.staff_number}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                {user.role_code}
              </span>
              {onlineUserIds.includes(user.id) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
              {title} {fullName || user.full_name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              {position || user.position}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>{officeStation || 'Mombasa Headquarters'}</span>
              </span>
              <span className="flex items-center gap-1 font-mono">
                <Mail className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span>{email || user.email}</span>
              </span>
              {phone && (
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>{phone}</span>
                </span>
              )}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="flex sm:flex-col gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-sky-500 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center gap-2 transition-colors"
            >
              <KeyRound className="w-4 h-4 text-sky-500" />
              <span>Reset Password</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('emails')}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800 text-xs font-semibold text-sky-700 dark:text-sky-300 flex items-center justify-center gap-2 transition-colors"
            >
              <Mail className="w-4 h-4 text-sky-600" />
              <span>Security Emails</span>
            </button>
          </div>
        </div>
      </div>

      {/* Profile Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`py-3 px-4 border-b-2 font-semibold text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'details'
              ? 'border-sky-600 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Personal Details &amp; Bio</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`py-3 px-4 border-b-2 font-semibold text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'security'
              ? 'border-sky-600 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Password &amp; Security</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('emails')}
          className={`py-3 px-4 border-b-2 font-semibold text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'emails'
              ? 'border-sky-600 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Automated Email Dispatches</span>
          {dispatchedEmails.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
              {dispatchedEmails.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('kpis')}
          className={`py-3 px-4 border-b-2 font-semibold text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'kpis'
              ? 'border-sky-600 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Research Portfolio &amp; KPIs</span>
        </button>
      </div>

      {/* TAB 1: DETAILS & SCIENTIFIC BIO */}
      {activeTab === 'details' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Personal Identification &amp; Contact Information
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Keep your scientific registry, institutional email, and station contact current.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Title / Salutation
                </label>
                <select
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="Prof.">Prof.</option>
                  <option value="Dr.">Dr.</option>
                  <option value="Mr.">Mr.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Eng.">Eng.</option>
                  <option value="Mrs.">Mrs.</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Jane Mutua"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Staff Number (Registry Badge)
                </label>
                <input
                  type="text"
                  disabled
                  value={user.staff_number}
                  className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Institutional Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@kmfri.go.ke"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Phone / Mobile
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254 712 345 678"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Office / Research Station
                </label>
                <select
                  value={officeStation}
                  onChange={(e) => setOfficeStation(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="Mombasa Headquarters (English Point)">Mombasa Headquarters (English Point)</option>
                  <option value="Shimoni Marine Research Station">Shimoni Marine Research Station</option>
                  <option value="Gazi Bay Mangrove Research Station">Gazi Bay Mangrove Research Station</option>
                  <option value="Kilifi Creek Marine Station">Kilifi Creek Marine Station</option>
                  <option value="Malindi Marine Research Station">Malindi Marine Research Station</option>
                  <option value="Lamu Marine Research Center">Lamu Marine Research Center</option>
                  <option value="Kisumu Freshwater Research Center">Kisumu Freshwater Research Center</option>
                  <option value="Lake Baringo Research Station">Lake Baringo Research Station</option>
                  <option value="Lake Naivasha Limnology Station">Lake Naivasha Limnology Station</option>
                  <option value="Lake Turkana Research Center (Kalokol)">Lake Turkana Research Center (Kalokol)</option>
                  <option value="Kegati Aquaculture Research Center">Kegati Aquaculture Research Center</option>
                  <option value="Sagana Aquaculture Center of Excellence">Sagana Aquaculture Center of Excellence</option>
                  <option value="Sangoro Riverine Research Station">Sangoro Riverine Research Station</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Position / Scientific Designation
                </label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="e.g. Senior Principal Research Scientist"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ORCID iD
                </label>
                <input
                  type="text"
                  value={orcidId}
                  onChange={(e) => setOrcidId(e.target.value)}
                  placeholder="0000-0002-1825-0097"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Research Specialization
                </label>
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. Mangrove Blue Carbon, Tuna Migrations"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Scientific Biography & Abstract */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Scientific Biography &amp; Research Statement
              </label>
              <textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe your research interests, career background, active field programs, and institutional responsibilities..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            {/* Photo URL / Custom Avatar */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Avatar Image URL (or upload using the camera button above)
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/photo.jpg"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-md disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: PASSWORD & SECURITY */}
      {activeTab === 'security' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-sm space-y-5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Reset &amp; Change Institutional Password
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Update your authentication credentials. An automated confirmation email will be automatically sent to your registered email upon password modification.
                </p>
              </div>
            </div>

            {/* Email Dispatch Notice Banner */}
            <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 flex items-start gap-3">
              <Mail className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
              <div className="text-xs text-teal-900 dark:text-teal-200">
                <span className="font-bold">Automated Email Notification Active:</span> Upon submitting this password update, the system will instantly dispatch a security confirmation email to <span className="font-mono font-bold">{user.email}</span>.
              </div>
            </div>

            {passwordStatus.type !== 'idle' && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 border ${
                  passwordStatus.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}
              >
                {passwordStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{passwordStatus.message}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current Password (Optional if initial reset)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Password * (Min 6 characters)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                {/* Visual password strength meter */}
                {newPassword && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div
                      className={`h-1 flex-1 rounded-full ${
                        newPassword.length >= 6 ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    <div
                      className={`h-1 flex-1 rounded-full ${
                        newPassword.length >= 8 && /[0-9]/.test(newPassword)
                          ? 'bg-emerald-500'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    />
                    <div
                      className={`h-1 flex-1 rounded-full ${
                        newPassword.length >= 10 && /[^A-Za-z0-9]/.test(newPassword)
                          ? 'bg-emerald-500'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    />
                    <span className="text-[10px] text-slate-500 font-mono">
                      {newPassword.length < 6
                        ? 'Too short'
                        : newPassword.length < 8
                        ? 'Fair'
                        : 'Strong'}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-md disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>{savingPassword ? 'Changing Password...' : 'Update Account Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: AUTOMATED EMAIL DISPATCHES */}
      {activeTab === 'emails' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-500" />
                <span>Automated Email Dispatches &amp; Security Alerts</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Every time you sign in, reset your password, or modify your profile, an automated security notification is delivered to <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{user.email}</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={loadEmails}
              disabled={loadingEmails}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingEmails ? 'animate-spin' : ''}`} />
              <span>Refresh Log</span>
            </button>
          </div>

          {/* Email Dispatches Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Date / Time (UTC)</th>
                    <th className="py-3 px-4">Notification Subject</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Delivery Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dispatchedEmails.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        {loadingEmails ? 'Loading security email log...' : 'No email dispatches recorded for this session yet.'}
                      </td>
                    </tr>
                  ) : (
                    dispatchedEmails.map((emailItem) => (
                      <tr key={emailItem.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {new Date(emailItem.sent_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                          {emailItem.subject}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              emailItem.type === 'LOGIN_ALERT'
                                ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300'
                                : emailItem.type === 'PASSWORD_RESET_CODE'
                                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                                : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {emailItem.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {emailItem.recipient_email}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {emailItem.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedEmail(emailItem)}
                            className="px-2.5 py-1 rounded bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900 text-sky-600 dark:text-sky-400 text-xs font-semibold flex items-center gap-1 ml-auto"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RESEARCH PORTFOLIO & KPIS */}
      {activeTab === 'kpis' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Assigned Projects</span>
                <FolderKanban className="w-5 h-5 text-sky-500" />
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-2">
                {userProjects.length}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Principal Investigator &amp; Co-Investigator Roles
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Publications &amp; Outputs</span>
                <Award className="w-5 h-5 text-teal-500" />
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-2">
                {userOutputs.length}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Peer-Reviewed Papers, Datasets, Tech Reports
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Submitted Reports</span>
                <FileText className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-2">
                {userReports.length}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Quarterly &amp; Annual Technical Deliverables
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Institutional Balanced Scorecard (BSC) Linkage
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Scientist performance evaluations are calculated objectively from peer-reviewed outputs, grant management, and milestone velocity.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModule('balanced_scorecard')}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Open Balanced Scorecard</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-500" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Institutional Email Preview: {selectedEmail.subject}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1 font-mono">
                <div><strong>To:</strong> {selectedEmail.recipient_name} &lt;{selectedEmail.recipient_email}&gt;</div>
                <div><strong>From:</strong> KMFRI Institutional Security &lt;sysadmin@kmfri.go.ke&gt;</div>
                <div><strong>Subject:</strong> {selectedEmail.subject}</div>
                <div><strong>Dispatched:</strong> {new Date(selectedEmail.sent_at).toUTCString()}</div>
                <div><strong>Status:</strong> <span className="text-emerald-500 font-bold">DELIVERED</span></div>
              </div>

              {/* Formatted HTML body */}
              <div
                className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
                dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
              />
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setSelectedEmail(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
