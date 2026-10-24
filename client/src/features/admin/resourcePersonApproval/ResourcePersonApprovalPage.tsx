import { BriefcaseBusiness, CheckCircle, Clock3, Eye, XCircle } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from 'react-bootstrap';

import CustomButton from '../../../shared/components/ui/CustomButton';
import CustomCard from '../../../shared/components/ui/CustomCard';
import CustomDropdown, { OptionType } from '../../../shared/components/ui/CustomDropdown';
import CustomInput from '../../../shared/components/ui/CustomInput';
import CustomModal from '../../../shared/components/ui/CustomModal';
import CustomTable from '../../../shared/components/ui/CustomTable';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import ResourcePersonDirectory from '../../resourcepersondirectory/ResourcePersonDirectory';

type Filter = 'All' | 'Pending' | 'Approved' | 'Rejected';
type Row = Record<string, any> & { id: number; approvalStatus?: Filter };
const statusStyle = (s: string) =>
  s === 'Approved'
    ? { background: '#d9f8e5', color: '#087b43' }
    : s === 'Rejected'
      ? { background: '#fde1e5', color: '#c52d43' }
      : { background: '#fff0d2', color: '#a96800' };

export default function ResourcePersonApprovalPage() {
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
    { value: 'All', label: 'All categories' },
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
  const toFormPerson = (row: Row) => {
    const fallbackProfession = {
      designation: row.designation || '',
      department: row.department || '',
      organization: row.organization || '',
      city: row.city || '',
      state: row.state || '',
      country: row.country || '',
      orgLinkedIn: row.org_linked_in || row.orgLinkedIn || '',
      status: row.profession_status || 'Working',
    };
    const professions =
      Array.isArray(row.professions) && row.professions.length > 0
        ? row.professions.map((profession: Record<string, any>) => ({
            ...fallbackProfession,
            ...profession,
            orgLinkedIn: profession.orgLinkedIn || profession.org_linked_in || '',
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
      specialization: row.specialization || '',
      mobile: row.mobile || '',
      personalEmail: row.personalEmail || row.personal_email || '',
      officialEmail: row.officialEmail || row.official_email || '',
      linkedIn: row.linkedIn || row.linked_in || '',
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
          <div className="text-muted">{label}</div>
          <strong className="fs-4" style={{ color: '#29436a' }}>
            {value}
          </strong>
        </div>
      </div>
    </CustomCard>
  );
  const columns = [
    {
      key: 'name',
      label: 'RESOURCE PERSON',
      render: (row: Row) => (
        <strong>
          {`${row.title || ''} ${row.first_name || ''} ${row.last_name || ''}`.trim()}
        </strong>
      ),
    },
    { key: 'category', label: 'CATEGORY', render: (row: Row) => row.category || '—' },
    { key: 'organization', label: 'ORGANIZATION', render: (row: Row) => row.organization || '—' },
    {
      key: 'approvalStatus',
      label: 'STATUS',
      render: (row: Row) => {
        const status = row.approvalStatus || 'Pending';
        return (
          <span
            style={{
              ...statusStyle(status),
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
      label: 'VIEW',
      render: (row: Row) => (
        <CustomButton
          variant="outline-primary"
          className="resource-person-view-button"
          aria-label="View resource person submission"
          onClick={() => setViewing(row)}
        >
          <Eye size={17} />
        </CustomButton>
      ),
    },
  ];
  return (
    <div
      className="resource-person-approval-page p-4"
      style={{ minHeight: '100%', background: '#f1f6fb' }}
    >
      <style>{`.resource-person-approval-page .request-summary-card .card-body { padding: 1.25rem 2rem; } .resource-person-approval-page .resource-person-view-button { width: 38px; height: 38px; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: #006db4; border-color: #bfdbfe; background: #eff6ff; } .resource-person-approval-page .resource-person-view-button:hover { color: #fff; background: #0878bd; border-color: #0878bd; } .resource-person-approval-page .custom-table { color: #29436a; } .resource-person-approval-page .custom-table thead th { color: #006db4; font-weight: 700; } .resource-person-approval-page .custom-table tbody td { vertical-align: middle; } .resource-person-details-modal .modal-dialog { max-width: 1150px; width: calc(100% - 32px); } .resource-person-details-modal .modal-content { max-height: calc(100vh - 3.5rem); } .resource-person-details-modal .modal-body { overflow-y: auto; }`}</style>
      <CustomCard className="mx-auto" style={{ maxWidth: 1250 }}>
        <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-4">
          <div className="d-flex align-items-center gap-3">
            <h2 className="h4 mb-0" style={{ color: '#082b50', fontWeight: 700 }}>
              Resource Person Request
            </h2>
            <Badge
              style={{
                alignItems: 'center',
                background: '#0069ab',
                borderRadius: 14,
                color: '#fff',
                display: 'inline-flex',
                fontWeight: 700,
                height: 38,
                justifyContent: 'center',
                padding: 0,
                width: 82,
              }}
            >
              ADMIN
            </Badge>
          </div>
          <div className="d-flex align-items-center gap-3">
            <CustomInput
              name="resource-person-search"
              value={search}
              onChange={setSearch}
              placeholder="Search resource person"
              className="mb-0"
            />
            <CustomDropdown
              name="resource-person-category"
              options={categoryOptions}
              value={categoryOptions.find((o) => o.value === category)}
              onChange={(option) => {
                if (option && 'value' in option) setCategory(String(option.value));
              }}
            />
          </div>
        </div>
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        <div className="row g-3 mb-4">
          <div className="col-12 col-sm-6 col-xl-3">
            {stat('Total', counts.total, <BriefcaseBusiness size={22} />, 'All')}
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            {stat('Pending', counts.pending, <Clock3 size={22} />, 'Pending')}
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            {stat('Approved', counts.approved, <CheckCircle size={22} />, 'Approved')}
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            {stat('Rejected', counts.rejected, <XCircle size={22} />, 'Rejected')}
          </div>
        </div>
        <CustomTable
          columns={columns}
          data={filteredRows}
          keyField="id"
          loading={loading}
          emptyMessage="No resource persons found."
          actions={(row: Row) =>
            (row.approvalStatus || 'Pending') === 'Pending' ? (
              <div className="d-flex gap-1">
                <CustomButton
                  variant="success"
                  className="px-2 py-1"
                  style={{ fontSize: 12, minWidth: 78 }}
                  loading={reviewingId === row.id}
                  disabled={reviewingId !== null}
                  onClick={() => void review(row.id, 'approve')}
                >
                  ✓ Approve
                </CustomButton>
                <CustomButton
                  variant="danger"
                  className="px-2 py-1"
                  style={{ fontSize: 12, minWidth: 68 }}
                  loading={reviewingId === row.id}
                  disabled={reviewingId !== null}
                  onClick={() => void review(row.id, 'reject')}
                >
                  × Reject
                </CustomButton>
              </div>
            ) : null
          }
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
            <div className="p-3">
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
