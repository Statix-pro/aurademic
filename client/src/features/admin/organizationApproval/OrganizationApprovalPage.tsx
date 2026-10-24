import {
  BriefcaseBusiness,
  Check,
  CircleCheck,
  CircleX,
  Clock3,
  Eye,
  Search,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from 'react-bootstrap';

import CustomButton from '../../../shared/components/ui/CustomButton';
import CustomCard from '../../../shared/components/ui/CustomCard';
import CustomDropdown, { OptionType } from '../../../shared/components/ui/CustomDropdown';
import CustomInput from '../../../shared/components/ui/CustomInput';
import CustomModal from '../../../shared/components/ui/CustomModal';
import CustomTable from '../../../shared/components/ui/CustomTable';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import OrganizationDirectory, {
  Organization as OrganizationForm,
} from '../../organizationdirectory/OrganizationDirectory';

type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';
type Tab = ApprovalStatus | 'All';
type Organization = Record<string, any> & { id: number; approvalStatus?: ApprovalStatus };

const BLUE = '#0878bd';

export default function OrganizationApprovalPage() {
  const [rows, setRows] = useState<Organization[]>([]);
  const [tab, setTab] = useState<Tab>('All');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All categories');
  const [error, setError] = useState('');
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [viewing, setViewing] = useState<Organization | null>(null);

  const load = async () => {
    try {
      const response = (await authenticityUtility.get('/organization-submissions')) as any;
      setRows(response.data || []);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to load submissions.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const review = async (id: number, decision: 'approve' | 'reject') => {
    setReviewingId(id);
    setError('');
    try {
      await authenticityUtility.patch(`/organization-submissions/${id}/review`, { decision });
      const approvalStatus = decision === 'approve' ? 'Approved' : 'Rejected';
      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, approvalStatus } : row)),
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to review organization.');
    } finally {
      setReviewingId(null);
    }
  };

  const counts = useMemo(
    () => ({
      pending: rows.filter((row) => (row.approvalStatus || 'Pending') === 'Pending').length,
      approved: rows.filter((row) => row.approvalStatus === 'Approved').length,
      rejected: rows.filter((row) => row.approvalStatus === 'Rejected').length,
      total: rows.length,
    }),
    [rows],
  );

  const categories = useMemo(
    () => [...new Set(rows.map((row) => row.category).filter(Boolean))] as string[],
    [rows],
  );
  const categoryOptions: OptionType[] = [
    { value: 'All categories', label: 'All categories' },
    ...categories.map((item) => ({ value: item, label: item })),
  ];
  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const state = row.approvalStatus || 'Pending';
        const needle = search.toLowerCase();
        return (
          (tab === 'All' || state === tab) &&
          (!needle ||
            [row.name, row.city, row.submitted_by_name, row.submitted_by_email].some((value) =>
              String(value || '')
                .toLowerCase()
                .includes(needle),
            )) &&
          (category === 'All categories' || row.category === category)
        );
      }),
    [rows, tab, search, category],
  );

  const stat = (icon: React.ReactNode, value: number, label: string, filter: Tab) => (
    <CustomCard
      key={label}
      className="h-100 mb-0"
      role="button"
      tabIndex={0}
      onClick={() => setTab(filter)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') setTab(filter);
      }}
      aria-label={`Show ${label.toLowerCase()} organizations`}
      style={{ cursor: 'pointer' }}
    >
      <div className="d-flex align-items-center gap-3 organization-stat-content">
        <span
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: BLUE,
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {icon}
        </span>
        <div>
          <div className="text-muted">{label}</div>
          <div className="fs-4 fw-bold" style={{ color: '#29436a', lineHeight: 1.1 }}>
            {value}
          </div>
        </div>
      </div>
    </CustomCard>
  );

  const columns = [
    {
      key: 'name',
      label: 'Organization',
      render: (row: Organization) => <strong>{row.name}</strong>,
    },
    {
      key: 'category',
      label: 'Category',
      render: (row: Organization) => (
        <span className="organization-category">{row.category || '—'}</span>
      ),
    },
    { key: 'city', label: 'City', render: (row: Organization) => row.city || '—' },
    {
      key: 'submitted_by',
      label: 'Submitted by',
      render: (row: Organization) => row.submitted_by_name || row.submitted_by_email || '—',
    },
    {
      key: 'approvalStatus',
      label: 'Status',
      render: (row: Organization) => {
        const status = row.approvalStatus || 'Pending';
        const statusStyle =
          status === 'Approved'
            ? { background: '#d9f8e5', color: '#087b43' }
            : status === 'Rejected'
              ? { background: '#fde1e5', color: '#c52d43' }
              : { background: '#fff0d2', color: '#a96800' };
        return (
          <span
            style={{
              ...statusStyle,
              display: 'inline-block',
              padding: '7px 12px',
              borderRadius: 18,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {status}
          </span>
        );
      },
    },
    {
      key: 'view',
      label: 'View',
      render: (row: Organization) => (
        <button
          type="button"
          onClick={() => setViewing(row)}
          aria-label="View organization submission"
          title="View organization submission"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            padding: 0,
            border: '1px solid #bfdbfe',
            borderRadius: 6,
            background: '#eff6ff',
            color: '#006db4',
            cursor: 'pointer',
          }}
        >
          <Eye size={17} />
        </button>
      ),
    },
  ];

  return (
    <div className="organization-approval-page p-4">
      <style>{`
        .organization-approval-page { min-height: 100%; background: #f1f6fb; color: #29436a; }
        .organization-approval-card { max-width: 1250px; border: 0; border-radius: 18px; background: #fff; box-shadow: 0 8px 24px rgba(15,42,70,.08); }
        .organization-approval-title { color: #082b50 !important; font-size: 24px; font-weight: 700; }
        .organization-admin-badge { background: #0878bd !important; border-radius: 12px !important; color: #fff !important; display: inline-flex; align-items: center; justify-content: center; width: 82px; height: 38px; font-size: .9rem; font-weight: 700; padding: 0 !important; }
        .organization-approval-header-controls { align-items: center !important; }
        .organization-approval-header-controls > .position-relative { width: 285px; height: 40px; }
        .organization-approval-header-controls > .position-relative > svg { left: 14px; z-index: 2; color: #006db4 !important; }
        .organization-approval-header-controls .custom-input { height: 40px; margin: 0 !important; padding-left: 50px !important; }
        .organization-approval-header-controls > div[style*='min-width'] { height: 40px; }
        .organization-approval-card .row.g-3 > [class*='col-'] > .card { height: 108px; border: 1px solid #dbe4ed; border-radius: 14px; box-shadow: 0 6px 18px rgba(15,42,70,.08); }
        .organization-approval-table.custom-table { min-width: 980px; margin-bottom: 0; table-layout: auto; color: #092f59; font-size: .9rem; }
        .organization-approval-table.custom-table thead th { padding: 15px 10px; background: #eef5fd; border-bottom: 1px solid #cddceb; color: #006db4; font-size: 14px; font-weight: 700; text-align: left; }
        .organization-approval-table.custom-table tbody td { padding: 16px 10px; border-color: #e1e8f0; color: #29436a; vertical-align: middle; }
        .organization-approval-table.custom-table tbody td:first-child { color: #092f59; font-weight: 700; }
        .organization-approval-table.custom-table th:nth-child(1), .organization-approval-table.custom-table td:nth-child(1) { width: 18%; }
        .organization-approval-table.custom-table th:nth-child(2), .organization-approval-table.custom-table td:nth-child(2) { width: 14%; }
        .organization-approval-table.custom-table th:nth-child(3), .organization-approval-table.custom-table td:nth-child(3) { width: 11%; }
        .organization-approval-table.custom-table th:nth-child(4), .organization-approval-table.custom-table td:nth-child(4) { width: 16%; }
        .organization-approval-table.custom-table th:nth-child(5), .organization-approval-table.custom-table td:nth-child(5) { width: 13%; }
        .organization-approval-table.custom-table th:nth-last-child(2), .organization-approval-table.custom-table td:nth-last-child(2) { width: 8%; text-align: center; }
        .organization-approval-table.custom-table th:last-child, .organization-approval-table.custom-table td:last-child { width: 20% !important; text-align: center; white-space: nowrap; }
      `}</style>
      <CustomCard className="organization-approval-card mx-auto" style={{ maxWidth: 1250 }}>
        <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-4">
          <div className="d-flex align-items-center gap-3">
            <h2 className="organization-approval-title h4 mb-0">Organization Request</h2>
            <Badge
              className="organization-admin-badge"
              style={{ backgroundColor: '#0878bd', borderRadius: 12, color: '#fff' }}
            >
              ADMIN
            </Badge>
          </div>
          <div className="organization-approval-header-controls d-flex align-items-center gap-3 flex-wrap">
            <div className="position-relative">
              <Search
                size={17}
                className="position-absolute top-50 translate-middle-y ms-3 text-secondary"
                aria-hidden="true"
              />
              <CustomInput
                name="organization-search"
                value={search}
                onChange={setSearch}
                placeholder="Search organization"
                className="mb-0"
              />
            </div>
            <div style={{ minWidth: 190 }}>
              <CustomDropdown
                name="organization-category"
                options={categoryOptions}
                value={categoryOptions.find((option) => option.value === category)}
                onChange={(option) => {
                  if (option && !Array.isArray(option) && 'value' in option) {
                    setCategory(String(option.value));
                  }
                }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <div className="row g-3 mb-4">
          <div className="col-12 col-sm-6 col-xl-3">
            {stat(<BriefcaseBusiness size={22} />, counts.total, 'Total', 'All')}
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            {stat(<Clock3 size={22} />, counts.pending, 'Pending', 'Pending')}
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            {stat(<CircleCheck size={22} />, counts.approved, 'Approved', 'Approved')}
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            {stat(<CircleX size={22} />, counts.rejected, 'Rejected', 'Rejected')}
          </div>
        </div>

        <CustomTable
          columns={columns}
          data={filtered}
          keyField="id"
          className="organization-approval-table"
          emptyMessage="No organizations found."
          actions={(row: Organization) =>
            row.approvalStatus === 'Pending' || !row.approvalStatus ? (
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                <button
                  type="button"
                  onClick={() => void review(row.id, 'approve')}
                  disabled={reviewingId !== null}
                  style={{
                    minWidth: 80,
                    padding: '8px 7px',
                    border: 0,
                    borderRadius: 6,
                    background: '#178b58',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  ✓ Approve
                </button>
                <button
                  type="button"
                  onClick={() => void review(row.id, 'reject')}
                  disabled={reviewingId !== null}
                  style={{
                    minWidth: 68,
                    padding: '8px 7px',
                    border: 0,
                    borderRadius: 6,
                    background: '#df3349',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  × Reject
                </button>
              </div>
            ) : null
          }
        />
        <CustomModal
          show={viewing !== null}
          onHide={() => setViewing(null)}
          title="Organization Details"
          size="xl"
          scrollable
          footer={
            viewing && (viewing.approvalStatus === 'Pending' || !viewing.approvalStatus) ? (
              <>
                <CustomButton
                  variant="success"
                  disabled={reviewingId !== null}
                  loading={reviewingId === viewing.id}
                  onClick={() => {
                    void review(viewing.id, 'approve');
                    setViewing(null);
                  }}
                >
                  <Check size={15} /> Approve
                </CustomButton>
                <CustomButton
                  variant="danger"
                  disabled={reviewingId !== null}
                  onClick={() => {
                    void review(viewing.id, 'reject');
                    setViewing(null);
                  }}
                >
                  <X size={15} /> Reject
                </CustomButton>
              </>
            ) : undefined
          }
        >
          {viewing && (
            <OrganizationDirectory
              editingOrg={viewing as OrganizationForm}
              readOnly
              onSave={() => undefined}
              onCancel={() => setViewing(null)}
            />
          )}
        </CustomModal>
      </CustomCard>
    </div>
  );
}
