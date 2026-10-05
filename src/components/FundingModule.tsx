import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Building2,
  Coins,
  Download,
  Edit3,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  FundingGrant,
  fundingGrantSchema,
  PermissionCode,
} from '../types/kmfri.ts';
import { exportToCSV, exportToExcel, exportToInstitutionalReportHTML } from '../utils/exportUtils.ts';

type GrantFormValues = z.infer<typeof fundingGrantSchema>;

export function FundingModule() {
  const { db, user, apiFetch, refreshData, hasPermission, showToast } = useAuth();

  const [analyticsDim, setAnalyticsDim] = useState<'year' | 'project' | 'scientist' | 'directorate' | 'source'>('source');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [funderModalOpen, setFunderModalOpen] = useState(false);
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [editingGrant, setEditingGrant] = useState<FundingGrant | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Funder state
  const [funderName, setFunderName] = useState('');
  const [funderType, setFunderType] = useState<'Government' | 'Bilateral' | 'Multilateral' | 'Foundation' | 'Private' | 'Internal'>('Multilateral');
  const [funderCountry, setFunderCountry] = useState('Kenya');
  const [funderContact, setFunderContact] = useState('');
  const [funderEmail, setFunderEmail] = useState('');
  const [funderPhone, setFunderPhone] = useState('');

  const canManageFunding = hasPermission(PermissionCode.FUNDING_MANAGE);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GrantFormValues>({
    resolver: zodResolver(fundingGrantSchema) as any,
    defaultValues: {
      grant_number: '',
      funder_id: '',
      project_id: '',
      amount: 10000000,
      currency: 'KES',
      award_date: new Date().toISOString().split('T')[0],
      start_date: new Date().toISOString().split('T')[0],
      end_date: '2027-06-30',
      allocated_amount: 10000000,
      spent_amount: 0,
      status: 'Active',
      notes: '',
    },
  });

  const filteredGrants = useMemo(() => {
    if (!db) return [];
    return db.funding.filter((g) => {
      if (statusFilter !== 'all' && g.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const funder = db.funders.find((f) => f.id === g.funder_id);
        const proj = db.projects.find((p) => p.id === g.project_id);
        const match =
          g.grant_number.toLowerCase().includes(q) ||
          (funder?.name || '').toLowerCase().includes(q) ||
          (proj?.project_code || '').toLowerCase().includes(q) ||
          (proj?.title || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [db, statusFilter, searchQuery]);

  // Multi-dimensional Analytics Series (by year, project, scientist, directorate, source)
  const analyticsData = useMemo(() => {
    if (!db) return [];
    const map = new Map<string, { label: string; allocated: number; spent: number }>();

    db.funding.forEach((g) => {
      const proj = db.projects.find((p) => p.id === g.project_id);
      const funder = db.funders.find((f) => f.id === g.funder_id);
      const dir = proj ? db.directorates.find((d) => d.id === proj.directorate_id) : null;
      const sci = proj ? db.users.find((u) => u.id === proj.principal_investigator_id) : null;

      let key = 'Unassigned';
      if (analyticsDim === 'year') key = g.award_date ? g.award_date.slice(0, 4) : 'Unknown';
      if (analyticsDim === 'project') key = proj ? proj.project_code : 'Unlinked';
      if (analyticsDim === 'scientist') key = sci ? `${sci.title} ${sci.full_name}` : 'Unassigned PI';
      if (analyticsDim === 'directorate') key = dir ? dir.code : 'Unassigned';
      if (analyticsDim === 'source') key = funder ? funder.name : 'Unknown Funder';

      const prev = map.get(key) || { label: key, allocated: 0, spent: 0 };
      prev.allocated += g.allocated_amount;
      prev.spent += g.spent_amount;
      map.set(key, prev);
    });

    return Array.from(map.values());
  }, [db, analyticsDim]);

  const totalGrantAmount = filteredGrants.reduce((s, g) => s + g.amount, 0);
  const totalAllocated = filteredGrants.reduce((s, g) => s + g.allocated_amount, 0);
  const totalSpent = filteredGrants.reduce((s, g) => s + g.spent_amount, 0);
  const totalRemaining = filteredGrants.reduce((s, g) => s + g.remaining_amount, 0);

  if (!db) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mx-auto" />
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Loading Funding & Grants System...
          </div>
        </div>
      </div>
    );
  }

  const handleCreateFunder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await apiFetch('/funders', {
        method: 'POST',
        body: JSON.stringify({
          name: funderName,
          funder_type: funderType,
          country: funderCountry,
          contact_person: funderContact,
          contact_email: funderEmail,
          contact_phone: funderPhone,
        }),
      });
      await refreshData();
      setFunderModalOpen(false);
      setFunderName('');
      showToast(`Registered funder "${funderName}"`);
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const openNewGrantModal = () => {
    setEditingGrant(null);
    setFormError(null);
    reset({
      grant_number: `WIOMSA-KMFRI-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}`,
      funder_id: db.funders[0]?.id || '',
      project_id: db.projects[0]?.id || '',
      amount: 15000000,
      currency: 'KES',
      award_date: new Date().toISOString().split('T')[0],
      start_date: new Date().toISOString().split('T')[0],
      end_date: '2027-06-30',
      allocated_amount: 15000000,
      spent_amount: 2500000,
      status: 'Active',
      notes: '',
    });
    setGrantModalOpen(true);
  };

  const openEditGrantModal = (grant: FundingGrant) => {
    setEditingGrant(grant);
    setFormError(null);
    reset({
      grant_number: grant.grant_number,
      funder_id: grant.funder_id,
      project_id: grant.project_id,
      amount: grant.amount,
      currency: grant.currency,
      award_date: grant.award_date,
      start_date: grant.start_date,
      end_date: grant.end_date,
      allocated_amount: grant.allocated_amount,
      spent_amount: grant.spent_amount,
      status: grant.status,
      notes: grant.notes,
    });
    setGrantModalOpen(true);
  };

  const onSubmitGrant = async (values: GrantFormValues) => {
    setFormError(null);
    try {
      if (editingGrant) {
        await apiFetch(`/funding/${editingGrant.id}`, {
          method: 'PUT',
          body: JSON.stringify(values),
        });
        showToast(`Updated grant ${values.grant_number}`);
      } else {
        await apiFetch('/funding', {
          method: 'POST',
          body: JSON.stringify(values),
        });
        showToast(`Recorded grant ${values.grant_number}`);
      }
      await refreshData();
      setGrantModalOpen(false);
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleExportFunding = (format: 'csv' | 'excel' | 'pdf') => {
    const rows = filteredGrants.map((g) => {
      const funder = db.funders.find((f) => f.id === g.funder_id);
      const proj = db.projects.find((p) => p.id === g.project_id);
      return {
        Grant_Number: g.grant_number,
        Funder: funder?.name || '—',
        Funder_Type: funder?.funder_type || '—',
        Project_Code: proj?.project_code || '—',
        Currency: g.currency,
        Award_Amount: g.amount,
        Allocated: g.allocated_amount,
        Spent: g.spent_amount,
        Remaining: g.remaining_amount,
        Status: g.status,
        Award_Date: g.award_date,
      };
    });
    if (format === 'csv') exportToCSV('kmfri_funding_grants', rows);
    if (format === 'excel') exportToExcel('kmfri_funding_grants', 'Funding', rows);
    if (format === 'pdf') {
      exportToInstitutionalReportHTML(
        'kmfri_funding_grants',
        'KMFRI Research Grants & Financial Allocation Report',
        `Generated by ${user?.full_name}`,
        rows
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Research Funding, Grants &amp; Donor Portfolio
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track funding sources, grant awards, allocated vs spent balances, and multi-dimensional financial analytics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExportFunding('csv')}
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportFunding('excel')}
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportFunding('pdf')}
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>

          {canManageFunding && (
            <>
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setFunderModalOpen(true);
                }}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Add Funder</span>
              </button>
              <button
                type="button"
                onClick={openNewGrantModal}
                className="px-3.5 py-2 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Record Grant Award</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Financial Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Grant Value</div>
          <div className="text-xl font-mono font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {totalGrantAmount.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {filteredGrants.length} Active/Recorded Grants
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Allocated</div>
          <div className="text-xl font-mono font-bold text-sky-600 mt-1 tabular-nums">
            {totalAllocated.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {db.funders.length} Registered Funders
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Disbursed / Spent</div>
          <div className="text-xl font-mono font-bold text-amber-600 mt-1 tabular-nums">
            {totalSpent.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Verified expenditure
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500">Remaining Balance</div>
          <div className="text-xl font-mono font-bold text-teal-600 mt-1 tabular-nums">
            {totalRemaining.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Available for project execution
          </div>
        </div>
      </div>

      {/* Multi-Dimensional Analytics Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Financial Analytics Breakdown (Allocated vs Spent)
            </h3>
            <p className="text-xs text-slate-500">
              Analyze grant funding by Year, Project, Scientist, Directorate, or Funder Source
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['source', 'year', 'project', 'scientist', 'directorate'] as const).map((dim) => (
              <button
                key={dim}
                type="button"
                onClick={() => setAnalyticsDim(dim)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                  analyticsDim === dim
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                By {dim}
              </button>
            ))}
          </div>
        </div>

        {analyticsData.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-500">
            No grant records available yet to plot financial analytics.
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="allocated" name="Allocated" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" name="Spent" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Filter & Grants Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by grant number, funder, or project code..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          >
            <option value="all">All Grant Statuses</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Closed">Closed</option>
            <option value="Suspended">Suspended</option>
          </select>
        </div>

        {filteredGrants.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <Coins className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              No Funding Grants Recorded Yet
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Register a funding agency (e.g., WIOMSA, World Bank KEMFSED, Government of Kenya, UNEP) and record your first project grant award.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500">
                  <th className="py-3 px-4 font-semibold">Grant No.</th>
                  <th className="py-3 px-4 font-semibold">Funder / Source</th>
                  <th className="py-3 px-4 font-semibold">Linked Project</th>
                  <th className="py-3 px-4 font-semibold text-right">Allocated</th>
                  <th className="py-3 px-4 font-semibold text-right">Spent</th>
                  <th className="py-3 px-4 font-semibold text-right">Remaining</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredGrants.map((g) => {
                  const funder = db.funders.find((f) => f.id === g.funder_id);
                  const proj = db.projects.find((p) => p.id === g.project_id);
                  return (
                    <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-semibold text-sky-700 dark:text-sky-400">
                        {g.grant_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {funder?.name || '—'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {funder?.funder_type} · {funder?.country}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {proj ? `${proj.project_code} — ${proj.title}` : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-right tabular-nums">
                        {g.currency} {g.allocated_amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-right tabular-nums">
                        {g.currency} {g.spent_amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-right font-semibold text-teal-600 tabular-nums">
                        {g.currency} {g.remaining_amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono">{g.status}</td>
                      <td className="py-3 px-4">
                        {canManageFunding && (
                          <button
                            type="button"
                            onClick={() => openEditGrantModal(g)}
                            className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                            title="Update Expenditure / Status"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Funder Modal */}
      {funderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Register Funding Organization / Donor
              </h3>
              <button type="button" onClick={() => setFunderModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            {formError && (
              <div className="mb-3 p-2.5 rounded bg-rose-50 text-xs text-rose-700">{formError}</div>
            )}
            <form onSubmit={handleCreateFunder} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Organization Name *</label>
                <input
                  type="text"
                  required
                  value={funderName}
                  onChange={(e) => setFunderName(e.target.value)}
                  placeholder="Western Indian Ocean Marine Science Association (WIOMSA)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Funder Type *</label>
                  <select
                    value={funderType}
                    onChange={(e) => setFunderType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="Government">Government</option>
                    <option value="Bilateral">Bilateral</option>
                    <option value="Multilateral">Multilateral</option>
                    <option value="Foundation">Foundation</option>
                    <option value="Private">Private</option>
                    <option value="Internal">Internal</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Country *</label>
                  <input
                    type="text"
                    required
                    value={funderCountry}
                    onChange={(e) => setFunderCountry(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">Contact Person</label>
                <input
                  type="text"
                  value={funderContact}
                  onChange={(e) => setFunderContact(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={funderEmail}
                    onChange={(e) => setFunderEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={funderPhone}
                    onChange={(e) => setFunderPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFunderModalOpen(false)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white font-semibold"
                >
                  Save Funder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Grant Modal */}
      {grantModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 my-8">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingGrant ? `Update Grant — ${editingGrant.grant_number}` : 'Record Research Grant Award'}
              </h3>
              <button type="button" onClick={() => setGrantModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            {formError && (
              <div className="mb-3 p-2.5 rounded bg-rose-50 text-xs text-rose-700">{formError}</div>
            )}
            <form onSubmit={handleSubmit(onSubmitGrant)} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Grant Number (Unique) *</label>
                  <input
                    type="text"
                    {...register('grant_number')}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                  {errors.grant_number && (
                    <p className="text-rose-600 mt-1">{errors.grant_number.message}</p>
                  )}
                </div>
                <div>
                  <label className="block font-medium mb-1">Status *</label>
                  <select
                    {...register('status')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Closed">Closed</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Funding Source / Donor *</label>
                  <select
                    {...register('funder_id')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="">Select Funder...</option>
                    {db.funders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.funder_type})
                      </option>
                    ))}
                  </select>
                  {errors.funder_id && (
                    <p className="text-rose-600 mt-1">{errors.funder_id.message}</p>
                  )}
                </div>
                <div>
                  <label className="block font-medium mb-1">Linked Project *</label>
                  <select
                    {...register('project_id')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="">Select Project...</option>
                    {db.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.project_code} — {p.title}
                      </option>
                    ))}
                  </select>
                  {errors.project_id && (
                    <p className="text-rose-600 mt-1">{errors.project_id.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium mb-1">Currency *</label>
                  <select
                    {...register('currency')}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="KES">KES</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Total Award *</label>
                  <input
                    type="number"
                    {...register('amount')}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Allocated *</label>
                  <input
                    type="number"
                    {...register('allocated_amount')}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Spent *</label>
                  <input
                    type="number"
                    {...register('spent_amount')}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Award Date *</label>
                  <input
                    type="date"
                    {...register('award_date')}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Start Date *</label>
                  <input
                    type="date"
                    {...register('start_date')}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">End Date *</label>
                  <input
                    type="date"
                    {...register('end_date')}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Notes / Tranche Conditions</label>
                <textarea
                  rows={2}
                  {...register('notes')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGrantModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-[#0A2540] dark:bg-sky-600 text-white font-semibold"
                >
                  {editingGrant ? 'Update Grant' : 'Save Grant Award'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
