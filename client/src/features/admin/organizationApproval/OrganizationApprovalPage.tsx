import { BriefcaseBusiness, Check, CircleCheck, CircleX, Clock3, Edit3, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from 'react-bootstrap';

import CustomButton from '../../../shared/components/ui/CustomButton';
import CustomCard from '../../../shared/components/ui/CustomCard';
import CustomDropdown, { OptionType } from '../../../shared/components/ui/CustomDropdown';
import CustomFilterSearch from '../../../shared/components/ui/CustomFilterSearch';
import CustomModal from '../../../shared/components/ui/CustomModal';
import CustomPagination, {
  PAGE_SIZE_OPTIONS,
} from '../../../shared/components/ui/CustomPagination';
import CustomSubmitterLine from '../../../shared/components/ui/CustomSubmitterLine';
import CustomTable from '../../../shared/components/ui/CustomTable';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { specializationHoldNote } from '../../../shared/utils/directoryHolds';
import OrganizationDirectory, {
  Organization as OrganizationForm,
} from '../../organizationdirectory/OrganizationDirectory';

// The header filter matches the search box beside it on --control-height; CustomDropdown
// defaults to 45px.
const FILTER_DROPDOWN_STYLES = {
  // CustomDropdown merges styles shallowly, so this replaces its whole control style:
  // keep its corners, colours and focus ring, and change only the height.
  control: (provided: any, state: any) => ({
    ...provided,
    minHeight: 'var(--control-height)',
    height: 'var(--control-height)',
    backgroundColor: 'var(--bg-input)',
    borderColor: state.isFocused ? 'var(--border-focus)' : 'var(--border-color)',
    borderRadius: 'var(--border-radius-md)',
    boxShadow: state.isFocused ? 'var(--shadow-focus)' : 'none',
    '&:hover': { borderColor: 'var(--border-focus)' },
  }),
  valueContainer: (provided: any) => ({
    ...provided,
    minHeight: 'calc(var(--control-height) - 2px)',
    height: 'calc(var(--control-height) - 2px)',
    padding: '0 12px',
  }),
  indicatorsContainer: (provided: any) => ({
    ...provided,
    minHeight: 'calc(var(--control-height) - 2px)',
    height: 'calc(var(--control-height) - 2px)',
  }),
  // Text per AGENTS.md typography: 14px, primary-text colour.
  container: (provided: any) => ({ ...provided, fontSize: 'var(--font-size-body)' }),
  singleValue: (provided: any) => ({ ...provided, color: 'var(--text-body)' }),
  // No bar before the chevron, like the plain selects on the other list pages.
  indicatorSeparator: () => ({ display: 'none' }),
};

type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';
type Tab = ApprovalStatus | 'All';
type Organization = Record<string, any> & { id: number; approvalStatus?: ApprovalStatus };

const BLUE = '#0878bd';

const isPending = (row: Organization) => (row.approvalStatus || 'Pending') === 'Pending';

/** `switcher`: the Directory Approval page's Organization / People tabs. */
export default function OrganizationApprovalPage({ switcher }: { switcher?: React.ReactNode }) {
  const [rows, setRows] = useState<Organization[]>([]);
  const [tab, setTab] = useState<Tab>('All');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All categories');
  const [error, setError] = useState('');
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [viewing, setViewing] = useState<Organization | null>(null);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

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

  const openEdit = (row: Organization) => {
    setEditError('');
    setEditing(row);
  };

  const saveEdit = async (orgData: Omit<OrganizationForm, 'id' | 'date'>) => {
    if (!editing || saving) return;
    setSaving(true);
    setEditError('');
    try {
      const response = (await authenticityUtility.put(
        `/organization-submissions/${editing.id}`,
        orgData,
      )) as any;
      const updated = response.data as Organization;
      setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setEditing(null);
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update organization.');
    } finally {
      setSaving(false);
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
    { value: 'All categories', label: 'Search Category' },
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
  // A page at a time; the queue keeps the server's order, oldest submission first.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    setPage(1);
  }, [tab, search, category, pageSize]);

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
            flexShrink: 0,
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
          <div
            style={{
              fontSize: 'var(--font-size-secondary)',
              lineHeight: 'var(--leading-secondary)',
              color: 'var(--text-soft)',
            }}
          >
            {label}
          </div>
          <div
            style={{
              color: 'var(--text-strong)',
              fontSize: 'var(--font-size-kpi)',
              lineHeight: 'var(--leading-kpi)',
              fontWeight: 700,
            }}
          >
            {value}
          </div>
        </div>
      </div>
    </CustomCard>
  );

  // Same layout as the Organization dashboard: the city sits under the name instead of in
  // its own column, and the decided status replaces Approve/Reject in Actions rather than
  // taking a Status column of its own.
  const columns = [
    {
      key: 'name',
      label: 'Organization',
      render: (row: Organization) => (
        <div className="d-flex flex-column">
          <span className="organization-approval-name">{row.name}</span>
          {row.city && <span className="organization-approval-meta">{row.city}</span>}
          {/* The server refuses to approve until then; the Approve button waits too. */}
          {specializationHoldNote(row.specializationHolds) && (
            <span className="organization-approval-hold">
              {specializationHoldNote(row.specializationHolds)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      hideOnPhone: true,
      label: 'Category',
      render: (row: Organization) => row.category || '—',
    },
    {
      key: 'tag',
      hideOnPhone: true,
      label: 'Tag',
      render: (row: Organization) =>
        row.tag ? <span className="organization-approval-tag">{row.tag}</span> : '—',
    },
    {
      key: 'funding',
      hideOnPhone: true,
      label: 'Funding',
      render: (row: Organization) => row.funding || '—',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Organization) => {
        const status = row.approvalStatus || 'Pending';
        const statusStyle =
          status === 'Approved'
            ? { background: '#d9f8e5', color: '#087b43' }
            : { background: '#fde1e5', color: '#c12c41' };
        return (
          // Kept off the row, whose click opens the read-only view.
          <div
            className="organization-approval-actions"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {isPending(row) ? (
              <>
                <CustomButton
                  variant="outline-primary"
                  onClick={() => openEdit(row)}
                  disabled={reviewingId !== null}
                  aria-label="Edit organization submission"
                  title="Edit organization submission"
                  className="organization-approval-icon-btn"
                >
                  <Edit3 size={15} />
                </CustomButton>
                <CustomButton
                  variant="outline-success"
                  className="organization-approval-decision approve"
                  onClick={() => void review(row.id, 'approve')}
                  disabled={
                    reviewingId !== null || Boolean(specializationHoldNote(row.specializationHolds))
                  }
                  title={specializationHoldNote(row.specializationHolds) || undefined}
                >
                  <Check size={13} strokeWidth={3} aria-hidden="true" />
                  Approve
                </CustomButton>
                <CustomButton
                  variant="outline-danger"
                  className="organization-approval-decision reject"
                  onClick={() => void review(row.id, 'reject')}
                  disabled={reviewingId !== null}
                >
                  <X size={13} strokeWidth={3} aria-hidden="true" />
                  Reject
                </CustomButton>
              </>
            ) : (
              <span
                style={{
                  ...statusStyle,
                  display: 'inline-block',
                  padding: '7px 12px',
                  borderRadius: 18,
                  fontWeight: 600,
                  fontSize: 'var(--font-size-tertiary)',
                }}
              >
                {status}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="organization-approval-page p-3 p-md-4">
      <style>{`
        .organization-approval-page { min-height: 100%; background: #f1f6fb; color: #29436a; }
        .organization-details-modal .modal-dialog { max-width: 1150px; width: calc(100% - 32px); }
        .organization-details-modal .modal-content { max-height: calc(100vh - 3.5rem); }
        .organization-details-modal .modal-body { overflow-y: auto; }
        .organization-approval-card { max-width: 1250px; border: 0; border-radius: 18px; background: #fff; box-shadow: 0 8px 24px rgba(15,42,70,.08); }
        .organization-approval-title { color: var(--text-strong) !important; font-size: var(--font-size-page-title); line-height: var(--leading-page-title); font-weight: 700; }
        .organization-admin-badge { background: #0878bd !important; border-radius: 6px !important; color: #fff !important; display: inline-flex; align-items: center; justify-content: center; height: var(--tag-height); font-size: var(--font-size-tertiary); font-weight: 700; letter-spacing: .04em; padding: 0 10px !important; }
        .organization-approval-header-controls { align-items: center !important; gap: 12px !important; }
        .organization-approval-card .row.g-3 > [class*='col-'] > .card { min-height: 80px; border: 1px solid #dbe4ed; border-radius: 14px; box-shadow: 0 6px 18px rgba(15,42,70,.08); }
        .organization-approval-card .row.g-3 > [class*='col-'] > .card .card-body { padding: 14px 20px; }
        .organization-approval-table.custom-table { min-width: 980px; margin-bottom: 0; table-layout: auto; color: var(--text-body); font-size: var(--font-size-body); }
        .organization-approval-table.custom-table thead th { padding: var(--table-cell-padding); background: #eef5fd; border-bottom: 1px solid #cddceb; color: var(--primary-color); font-size: var(--font-size-secondary); line-height: var(--leading-secondary); font-weight: var(--weight-bold); text-align: left; }
        .organization-approval-table.custom-table tbody td { padding: var(--table-cell-padding); border-color: #e1e8f0; color: var(--text-body); font-size: var(--font-size-body); line-height: var(--leading-body); vertical-align: middle; }
        .organization-approval-table .organization-approval-name { color: var(--text-strong); font-size: var(--font-size-body); line-height: var(--leading-body); font-weight: 700; }
        .organization-approval-table .organization-approval-meta { margin-top: 2px; color: var(--text-soft); font-size: var(--font-size-secondary); line-height: var(--leading-secondary); } .organization-approval-page .organization-approval-hold { margin-top: 2px; color: #9b5f00; font-size: var(--font-size-secondary); line-height: var(--leading-secondary); }
        .organization-approval-table .organization-approval-tag { display: inline-block; padding: 4px 12px; border-radius: 6px; background: #e0f0ff; color: #0069ab; font-size: var(--font-size-tertiary); font-weight: 600; text-transform: capitalize; }
        /* The outlined Edit/View square from the Organization dashboard (32×32, --icon-action-size). */
        .custom-btn.organization-approval-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: var(--icon-action-size); height: var(--icon-action-size); min-width: 0; min-height: 0; padding: 0; border: 1px solid #0069ab; border-radius: 8px; background: #ffffff; color: #0069ab; }
        .custom-btn.organization-approval-icon-btn:hover { background: #e0f0ff; color: #0069ab; }
        /* Approve / Reject: 28px inline actions (AGENTS.md §17), tinted to sit with the outlined icons. */
        .custom-btn.organization-approval-decision { display: inline-flex; align-items: center; gap: 4px; height: var(--inline-action-height); min-height: 0; min-width: 0; padding: 0 10px; border-radius: 6px; border: 1px solid; font-size: var(--font-size-tertiary); font-weight: 700; white-space: nowrap; flex-shrink: 0; } .custom-btn.organization-approval-decision.approve, .custom-btn.organization-approval-decision.approve:disabled { background: #e8f6ee; border-color: #9fd8b6; color: #087b43; } .custom-btn.organization-approval-decision.approve:hover:not(:disabled) { background: #d3efdf; border-color: #087b43; color: #066535; } .custom-btn.organization-approval-decision.reject, .custom-btn.organization-approval-decision.reject:disabled { background: #fdecee; border-color: #f3b4bd; color: #b4253a; } .custom-btn.organization-approval-decision.reject:hover:not(:disabled) { background: #fbd9de; border-color: #b4253a; color: #9a1d30; }
        .organization-approval-table .organization-approval-actions { display: flex; gap: 6px; align-items: center; justify-content: center; white-space: nowrap; }
        .organization-details-modal .modal-title { font-size: var(--font-size-modal-title); line-height: var(--leading-modal-title); font-weight: 600; }
        /* Organization | Category | Tag | Funding | Actions */
        .organization-approval-table.custom-table th:nth-child(1), .organization-approval-table.custom-table td:nth-child(1) { width: 32%; }
        .organization-approval-table.custom-table th:nth-child(2), .organization-approval-table.custom-table td:nth-child(2) { width: 13%; }
        .organization-approval-table.custom-table th:nth-child(3), .organization-approval-table.custom-table td:nth-child(3) { width: 13%; text-align: center; }
        .organization-approval-table.custom-table th:nth-child(4), .organization-approval-table.custom-table td:nth-child(4) { width: 10%; }
        .organization-approval-table.custom-table th:last-child, .organization-approval-table.custom-table td:last-child { width: 32% !important; text-align: center; white-space: nowrap; }
        @media (max-width: 576px) {
          /* On a phone (Category and Tag hidden via hideOnPhone) the actions wrap instead of
             widening the table. */
          .organization-approval-table.custom-table { min-width: 0; }
          /* Edit on the left across both rows, Approve over Reject at one width beside it:
             left to wrap, Reject fell under Edit and Approve out of line. */
          .organization-approval-table .organization-approval-actions { display: grid; grid-template-rows: auto auto; grid-auto-flow: column; grid-auto-columns: max-content; justify-content: center; white-space: normal; }
          .organization-approval-table .organization-approval-actions .organization-approval-icon-btn { grid-row: span 2; }
          .organization-approval-table .organization-approval-actions .organization-approval-decision { justify-content: center; }
          .organization-approval-table.custom-table th:last-child, .organization-approval-table.custom-table td:last-child { width: auto !important; white-space: normal; }
        }
      `}</style>
      <CustomCard className="organization-approval-card mx-auto" style={{ maxWidth: 1250 }}>
        {switcher}
        <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-4">
          <div className="d-flex align-items-center gap-3">
            <h2 className="organization-approval-title h4 mb-0">Organization Request</h2>
            <Badge
              className="organization-admin-badge"
              style={{ backgroundColor: '#0878bd', borderRadius: 6, color: '#fff' }}
            >
              ADMIN
            </Badge>
          </div>
          <div className="organization-approval-header-controls d-flex align-items-center gap-3 flex-wrap">
            <CustomFilterSearch
              name="organization-search"
              value={search}
              onChange={setSearch}
              placeholder="Search organization"
            />
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
                className="mb-0"
                styles={FILTER_DROPDOWN_STYLES}
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
          <div className="col-6 col-xl-3">
            {stat(<BriefcaseBusiness size={22} />, counts.total, 'Total', 'All')}
          </div>
          <div className="col-6 col-xl-3">
            {stat(<Clock3 size={22} />, counts.pending, 'Pending', 'Pending')}
          </div>
          <div className="col-6 col-xl-3">
            {stat(<CircleCheck size={22} />, counts.approved, 'Approved', 'Approved')}
          </div>
          <div className="col-6 col-xl-3">
            {stat(<CircleX size={22} />, counts.rejected, 'Rejected', 'Rejected')}
          </div>
        </div>

        <CustomTable
          columns={columns}
          data={pageRows}
          keyField="id"
          className="organization-approval-table"
          emptyMessage="No organizations found."
          onRowClick={(row: Organization) => setViewing(row)}
          rowLabel={(row: Organization) => `View ${row.name}`}
        />
        <CustomPagination
          page={currentPage}
          pageSize={pageSize}
          total={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          name="organization-approval-rows-per-page"
        />
        <CustomModal
          show={editing !== null}
          onHide={() => !saving && setEditing(null)}
          title="Edit Organization"
          size="xl"
          scrollable
          className="organization-details-modal"
        >
          {editError && (
            <div className="alert alert-danger" role="alert">
              {editError}
            </div>
          )}
          {editing && (
            <OrganizationDirectory
              editingOrg={editing as OrganizationForm}
              onSave={(orgData) => void saveEdit(orgData)}
              onCancel={() => !saving && setEditing(null)}
            />
          )}
        </CustomModal>
        <CustomModal
          show={viewing !== null}
          onHide={() => setViewing(null)}
          title="Organization Details"
          size="xl"
          scrollable
          className="organization-details-modal"
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
            <div>
              <CustomSubmitterLine
                label="Submitted by"
                name={viewing.submitted_by_name}
                email={viewing.submitted_by_email}
                date={viewing.created_at || viewing.date}
                prominent
              />
              <OrganizationDirectory
                editingOrg={viewing as OrganizationForm}
                readOnly
                onSave={() => undefined}
                onCancel={() => setViewing(null)}
              />
            </div>
          )}
        </CustomModal>
      </CustomCard>
    </div>
  );
}
