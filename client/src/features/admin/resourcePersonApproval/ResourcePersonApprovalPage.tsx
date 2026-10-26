import { BriefcaseBusiness, Check, CheckCircle, Clock3, X, XCircle } from 'lucide-react';
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
import ResourcePersonDirectory from '../../resourcepersondirectory/ResourcePersonDirectory';

type Filter = 'All' | 'Pending' | 'Approved' | 'Rejected';

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

type Row = Record<string, any> & { id: number; approvalStatus?: Filter };
// The server refuses to approve while an organization the record names is Pending or
// Rejected (organizationHolds); the row says why and its Approve button waits.
const organizationHoldNote = (row: Row) => {
  const holds: { name: string; status: string }[] = row.organizationHolds || [];
  if (!holds.length) return '';
  return holds.some((hold) => hold.status === 'Rejected')
    ? 'Organization rejected: submitter must choose another'
    : 'Organization pending approval';
};
const statusStyle = (s: string) =>
  s === 'Approved'
    ? { background: '#d9f8e5', color: '#087b43' }
    : s === 'Rejected'
      ? { background: '#fde1e5', color: '#c12c41' }
      : { background: '#fff0d2', color: '#9b5f00' };

/** `switcher`: the Directory Approval page's Organization / Resource Person tabs. */
export default function ResourcePersonApprovalPage({ switcher }: { switcher?: React.ReactNode }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      const response = (await authenticityUtility.get('/resource-person-submissions')) as any;
      setRows(response.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const review = async (id: number, decision: 'approve' | 'reject') => {
    setReviewingId(id);
    setError('');
    try {
      await authenticityUtility.patch(`/resource-person-submissions/${id}/review`, {
        decision,
      });
      setRows((current) =>
        current.map((row) =>
          row.id === id
            ? { ...row, approvalStatus: decision === 'approve' ? 'Approved' : 'Rejected' }
            : row,
        ),
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to review resource person.');
    } finally {
      setReviewingId(null);
    }
  };
  const counts = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((r) => (r.approvalStatus || 'Pending') === 'Pending').length,
      approved: rows.filter((r) => r.approvalStatus === 'Approved').length,
      rejected: rows.filter((r) => r.approvalStatus === 'Rejected').length,
    }),
    [rows],
  );
  const categories = [...new Set(rows.map((r) => r.category).filter(Boolean))] as string[];
  const categoryOptions: OptionType[] = [
    { value: 'All', label: 'Search Category' },
    ...categories.map((item) => ({ value: item, label: item })),
  ];
  const filteredRows = rows.filter((row) => {
    const name = `${row.title || ''} ${row.first_name || ''} ${row.last_name || ''}`.trim();
    const haystack = `${name} ${row.city || ''} ${row.organization || ''}`.toLowerCase();
    return (
      (filter === 'All' || (row.approvalStatus || 'Pending') === filter) &&
      (!search.trim() || haystack.includes(search.trim().toLowerCase())) &&
      (category === 'All' || row.category === category)
    );
  });
  // A page at a time; the queue keeps the server's order, oldest submission first.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    setPage(1);
  }, [filter, search, category, pageSize]);
  const toFormPerson = (row: Row) => {
    const fallbackProfession = {
      designation: row.designation || '',
      department: row.department || '',
      organization: row.organization || '',
      city: row.city || '',
      state: row.state || '',
      country: row.country || '',
      orgLinkedIn: row.org_linked_in || row.orgLinkedIn || '',
      officialEmail: '',
      status: row.profession_status || 'Working',
    };
    const professions =
      Array.isArray(row.professions) && row.professions.length > 0
        ? row.professions.map((profession: Record<string, any>) => ({
            ...fallbackProfession,
            ...profession,
            orgLinkedIn: profession.orgLinkedIn || profession.org_linked_in || '',
            officialEmail: profession.officialEmail || profession.official_email || '',
            officialEmailType:
              profession.officialEmailType || profession.official_email_type || null,
          }))
        : [fallbackProfession];

    return {
      id: row.id,
      title: row.title || 'Dr.',
      firstName: row.firstName || row.first_name || '',
      lastName: row.lastName || row.last_name || '',
      name: row.name || `${row.title || ''} ${row.first_name || ''} ${row.last_name || ''}`.trim(),
      gender: row.gender || 'Male',
      dob: row.dob || '',
      status: row.person_status || row.status || 'In Service',
      category: row.category || 'Academic',
      tag: row.tag || '',
      specializations: row.specializations || [],
      mobile: row.mobile || '',
      personalEmail: row.personalEmail || row.personal_email || '',
      linkedIn: row.linkedIn || row.linked_in || '',
      remarks: row.remarks || '',
      professions,
      photoName: row.photoName || row.photo_name || '',
      photoPath: row.photoPath || row.photo_path || '',
      resumeName: row.resumeName || row.resume_name || '',
      resumePath: row.resumePath || row.resume_path || '',
      date: row.date || row.created_at || '',
    };
  };
  const stat = (label: string, value: number, icon: React.ReactNode, selected: Filter) => (
    <CustomCard
      className="request-summary-card h-100 mb-0"
      role="button"
      tabIndex={0}
      onClick={() => setFilter(selected)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setFilter(selected);
        }
      }}
      aria-label={`Show ${label.toLowerCase()} resource people`}
    >
      <div className="d-flex align-items-center gap-3">
        <span
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 10,
            background: '#0878bd',
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
          <strong
            className="d-block"
            style={{
              color: 'var(--text-strong)',
              fontSize: 'var(--font-size-kpi)',
              lineHeight: 'var(--leading-kpi)',
              fontWeight: 700,
            }}
          >
            {value}
          </strong>
        </div>
      </div>
    </CustomCard>
  );
  const personName = (row: Row) =>
    `${row.title || ''} ${row.first_name || ''} ${row.last_name || ''}`.trim();
  const primaryProfession = (row: Row) =>
    (row.professions || []).find((p: Record<string, any>) => p.status === 'Working') ||
    (row.professions || [])[0];
  // Same layout as the Organization approval page: who, where from, category and tag, then
  // Approve / Reject while pending or the decision once made. A row click views it.
  const columns = [
    {
      key: 'name',
      label: 'RESOURCE PERSON',
      render: (row: Row) => (
        <div className="d-flex flex-column">
          <strong>{personName(row)}</strong>
          {primaryProfession(row)?.designation && (
            <span className="resource-person-approval-meta">
              {primaryProfession(row).designation}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'organization',
      hideOnPhone: true,
      label: 'ORGANIZATION',
      render: (row: Row) => (
        <div className="d-flex flex-column">
          <span>{row.organization || '—'}</span>
          {row.city && <span className="resource-person-approval-meta">{row.city}</span>}
          {organizationHoldNote(row) && (
            <span className="resource-person-approval-hold">{organizationHoldNote(row)}</span>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      hideOnPhone: true,
      label: 'CATEGORY',
      render: (row: Row) => row.category || '—',
    },
    {
      key: 'tag',
      hideOnPhone: true,
      label: 'TAG',
      render: (row: Row) =>
        row.tag ? <span className="resource-person-approval-tag">{row.tag}</span> : '—',
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      render: (row: Row) => {
        const status = row.approvalStatus || 'Pending';
        return (
          // Kept off the row, whose click opens the read-only view.
          <div
            className="resource-person-approval-actions"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {status === 'Pending' ? (
              <>
                <CustomButton
                  variant="outline-success"
                  className="resource-person-approval-decision approve"
                  loading={reviewingId === row.id}
                  disabled={reviewingId !== null || Boolean(organizationHoldNote(row))}
                  title={organizationHoldNote(row) || undefined}
                  onClick={() => void review(row.id, 'approve')}
                >
                  <Check size={13} strokeWidth={3} aria-hidden="true" />
                  Approve
                </CustomButton>
                <CustomButton
                  variant="outline-danger"
                  className="resource-person-approval-decision reject"
                  loading={reviewingId === row.id}
                  disabled={reviewingId !== null}
                  onClick={() => void review(row.id, 'reject')}
                >
                  <X size={13} strokeWidth={3} aria-hidden="true" />
                  Reject
                </CustomButton>
              </>
            ) : (
              <span
                style={{
                  ...statusStyle(status),
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
    <div
      className="resource-person-approval-page p-3 p-md-4"
      style={{ minHeight: '100%', background: '#f1f6fb' }}
    >
      <style>{`.resource-person-approval-page .request-summary-card { min-height: 80px; border: 1px solid #dbe4ed; border-radius: 14px; box-shadow: 0 6px 18px rgba(15,42,70,.08); } .resource-person-approval-page .request-summary-card .card-body { padding: 14px 20px; } .resource-person-approval-page .custom-table { color: #29436a; } .resource-person-approval-page .custom-table thead th { color: var(--primary-color); font-size: var(--font-size-secondary); line-height: var(--leading-secondary); font-weight: var(--weight-bold); } .resource-person-approval-page .custom-table tbody td { padding: var(--table-cell-padding); vertical-align: middle; font-size: var(--font-size-body); line-height: var(--leading-body); color: var(--text-body); } .resource-person-approval-page .custom-table thead th { padding: var(--table-cell-padding); } .resource-person-approval-page .resource-person-approval-meta { margin-top: 2px; color: var(--text-soft); font-size: var(--font-size-secondary); line-height: var(--leading-secondary); } .resource-person-approval-page .resource-person-approval-tag { display: inline-block; padding: 4px 12px; border-radius: 6px; background: #e0f0ff; color: #0069ab; font-size: var(--font-size-tertiary); font-weight: 600; } .resource-person-approval-page .resource-person-approval-header-controls { gap: 12px !important; } .resource-person-approval-page .resource-person-approval-actions { display: flex; gap: 6px; align-items: center; justify-content: center; white-space: nowrap; } .resource-person-approval-table.custom-table th:nth-child(1), .resource-person-approval-table.custom-table td:nth-child(1) { width: 28%; } .resource-person-approval-table.custom-table th:nth-child(2), .resource-person-approval-table.custom-table td:nth-child(2) { width: 26%; } .resource-person-approval-table.custom-table th:nth-child(4), .resource-person-approval-table.custom-table td:nth-child(4) { text-align: center; } .resource-person-approval-table.custom-table th:last-child, .resource-person-approval-table.custom-table td:last-child { width: 22%; text-align: center; } .resource-person-approval-page .custom-table tbody td strong { font-weight: 700; color: var(--text-strong); } .resource-person-details-modal .modal-title { font-size: var(--font-size-modal-title); line-height: var(--leading-modal-title); font-weight: 600; } .resource-person-approval-page .resource-person-admin-badge { background-color: #0069ab !important; } .resource-person-details-modal .modal-dialog { max-width: 1150px; width: calc(100% - 32px); } .resource-person-details-modal .modal-content { max-height: calc(100vh - 3.5rem); } .resource-person-details-modal .modal-body { overflow-y: auto; } .resource-person-approval-page .resource-person-approval-hold { margin-top: 2px; color: #9b5f00; font-size: var(--font-size-secondary); line-height: var(--leading-secondary); } .custom-btn.resource-person-approval-decision { display: inline-flex; align-items: center; gap: 4px; height: var(--inline-action-height); min-height: 0; min-width: 0; padding: 0 10px; border-radius: 6px; border: 1px solid; font-size: var(--font-size-tertiary); font-weight: 700; white-space: nowrap; flex-shrink: 0; } .custom-btn.resource-person-approval-decision.approve, .custom-btn.resource-person-approval-decision.approve:disabled { background: #e8f6ee; border-color: #9fd8b6; color: #087b43; } .custom-btn.resource-person-approval-decision.approve:hover:not(:disabled) { background: #d3efdf; border-color: #087b43; color: #066535; } .custom-btn.resource-person-approval-decision.reject, .custom-btn.resource-person-approval-decision.reject:disabled { background: #fdecee; border-color: #f3b4bd; color: #b4253a; } .custom-btn.resource-person-approval-decision.reject:hover:not(:disabled) { background: #fbd9de; border-color: #b4253a; color: #9a1d30; } @media (max-width: 576px) { .resource-person-approval-table.custom-table th:nth-child(1), .resource-person-approval-table.custom-table td:nth-child(1) { width: auto; } .resource-person-approval-page .resource-person-approval-actions { flex-wrap: wrap; white-space: normal; } .resource-person-approval-table.custom-table th:last-child, .resource-person-approval-table.custom-table td:last-child { width: auto; } }`}</style>
      <CustomCard className="mx-auto" style={{ maxWidth: 1250 }}>
        {switcher}
        <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-4">
          <div className="d-flex align-items-center gap-3">
            <h2
              className="mb-0"
              style={{
                color: 'var(--text-strong)',
                fontSize: 'var(--font-size-page-title)',
                lineHeight: 'var(--leading-page-title)',
                fontWeight: 700,
              }}
            >
              Resource Person Request
            </h2>
            <Badge
              className="resource-person-admin-badge"
              style={{
                alignItems: 'center',
                background: '#0069ab',
                borderRadius: 6,
                color: '#fff',
                display: 'inline-flex',
                fontSize: 'var(--font-size-tertiary)',
                fontWeight: 700,
                height: 'var(--tag-height)',
                letterSpacing: '0.04em',
                padding: '0 10px',
              }}
            >
              ADMIN
            </Badge>
          </div>
          <div className="resource-person-approval-header-controls d-flex align-items-center gap-2 flex-wrap">
            <CustomFilterSearch
              name="resource-person-search"
              value={search}
              onChange={setSearch}
              placeholder="Search resource person"
            />
            <div style={{ minWidth: 190 }}>
              <CustomDropdown
                name="resource-person-category"
                options={categoryOptions}
                value={categoryOptions.find((o) => o.value === category)}
                onChange={(option) => {
                  if (option && 'value' in option) setCategory(String(option.value));
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
            {stat('Total', counts.total, <BriefcaseBusiness size={22} />, 'All')}
          </div>
          <div className="col-6 col-xl-3">
            {stat('Pending', counts.pending, <Clock3 size={22} />, 'Pending')}
          </div>
          <div className="col-6 col-xl-3">
            {stat('Approved', counts.approved, <CheckCircle size={22} />, 'Approved')}
          </div>
          <div className="col-6 col-xl-3">
            {stat('Rejected', counts.rejected, <XCircle size={22} />, 'Rejected')}
          </div>
        </div>
        <CustomTable
          columns={columns}
          data={pageRows}
          keyField="id"
          loading={loading}
          className="resource-person-approval-table"
          emptyMessage="No resource persons found."
          onRowClick={(row: Row) => setViewing(row)}
          rowLabel={(row: Row) => `View ${personName(row)}`}
        />
        <CustomPagination
          page={currentPage}
          pageSize={pageSize}
          total={filteredRows.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          name="resource-person-approval-rows-per-page"
        />
        <CustomModal
          show={viewing !== null}
          onHide={() => setViewing(null)}
          title="Resource Person Details"
          size="xl"
          scrollable
          className="resource-person-details-modal"
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
              <ResourcePersonDirectory
                editingPerson={toFormPerson(viewing)}
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
