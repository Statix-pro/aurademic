import { Pencil, Plus, Trash2 } from 'lucide-react';
import React, { useState, useEffect, useCallback, FormEvent, useMemo } from 'react';
import { Alert, Form } from 'react-bootstrap';

import AlertModal, { AlertType } from '../../../shared/components/ui/AlertModal';
import CustomButton from '../../../shared/components/ui/CustomButton';
import CustomCheckbox from '../../../shared/components/ui/CustomCheckbox';
import CustomInput from '../../../shared/components/ui/CustomInput';
import CustomModal from '../../../shared/components/ui/CustomModal';
import CustomTable from '../../../shared/components/ui/CustomTable';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { AdminIconButton, AdminScreenHeader, AdminTabs } from '../components/AdminScreen';

/**
 * Master data behind the project form: the organizations that fund or
 * collaborate on projects, the schemes each of them offers, and the budget head
 * vocabulary the form's Budget Head(s) pickers are built from. A scheme carries
 * the domain, category and website the form shows read-only next to it.
 */

interface OrganizationRow {
  id: number;
  name: string;
  short_name?: string | null;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  website?: string | null;
  is_funding_agency?: number;
  is_internal?: number;
  is_active?: number;
  sort_order?: number;
}

interface SchemeRow {
  id: number;
  organization_id: number;
  organization_name?: string;
  name: string;
  domain?: string | null;
  category?: string | null;
  website?: string | null;
  is_active?: number;
  sort_order?: number;
}

/**
 * A head in the project vocabulary. Projects store the head by name, so the
 * group is only what the form files it under, and a head that is renamed or
 * deactivated here leaves the projects budgeted under it untouched.
 */
interface BudgetHeadRow {
  id: number;
  name: string;
  head_group: string;
  is_active?: number;
  sort_order?: number;
}

// The tab is also the path segment its CRUD calls use, so these match the
// routes in server/modules/formOptions/formOptionsRoutes.js.
type TabType = 'organizations' | 'schemes' | 'budget-heads';
type EditableRow = Partial<OrganizationRow> & Partial<SchemeRow> & Partial<BudgetHeadRow>;

const TAB_LABELS: Record<TabType, string> = {
  organizations: 'Organization',
  schemes: 'Scheme',
  'budget-heads': 'Budget Head',
};

const TAB_TITLES: Record<TabType, string> = {
  organizations: 'Organizations',
  schemes: 'Schemes',
  'budget-heads': 'Budget Heads',
};

// The dialog's form fills its body and Save sits in its footer, outside the
// form, so the button reaches the form by id.
const FORM_ID = 'project-form-options-form';

const ProjectFormOptions: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('organizations');
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [schemes, setSchemes] = useState<SchemeRow[]>([]);
  const [budgetHeads, setBudgetHeads] = useState<BudgetHeadRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<EditableRow>({});
  const [isEditing, setIsEditing] = useState(false);

  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: React.ReactNode;
    type: AlertType;
    title?: string;
    onConfirm?: () => void;
    showCancel?: boolean;
    confirmText?: string;
  }>({ show: false, message: '', type: 'info' });

  const showAlert = (
    message: React.ReactNode,
    type: AlertType = 'info',
    title?: string,
    showCancel = false,
    confirmText = 'OK',
    onConfirm?: () => void,
  ) => setAlertConfig({ show: true, message, type, title, onConfirm, showCancel, confirmText });

  const closeAlert = () => setAlertConfig((previous) => ({ ...previous, show: false }));

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Schemes reference organizations, so both lists are always loaded: the
      // scheme editor needs the organization dropdown either way.
      const [organizationResponse, schemeResponse, budgetHeadResponse] = await Promise.all([
        authenticityUtility.get('/form-options/project-options/organizations') as Promise<{
          data: OrganizationRow[];
        }>,
        authenticityUtility.get('/form-options/project-options/schemes') as Promise<{
          data: SchemeRow[];
        }>,
        authenticityUtility.get('/form-options/project-options/budget-heads') as Promise<{
          data: BudgetHeadRow[];
        }>,
      ]);

      setOrganizations(Array.isArray(organizationResponse.data) ? organizationResponse.data : []);
      setSchemes(Array.isArray(schemeResponse.data) ? schemeResponse.data : []);
      setBudgetHeads(Array.isArray(budgetHeadResponse.data) ? budgetHeadResponse.data : []);
    } catch (err: unknown) {
      console.error('Error fetching project options:', err);
      setError('Failed to load project options. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const organizationOptions = useMemo(
    () => organizations.filter((organization) => organization.is_funding_agency !== 0),
    [organizations],
  );

  // The groups already in use, offered as suggestions rather than a closed list
  // — a new kind of project brings its own vocabulary with it.
  const headGroups = useMemo(
    () => [...new Set(budgetHeads.map((head) => head.head_group).filter(Boolean))],
    [budgetHeads],
  );

  const openCreate = () => {
    const defaults: Record<TabType, EditableRow> = {
      organizations: {
        name: '',
        country: 'India',
        is_funding_agency: 1,
        is_active: 1,
        sort_order: 0,
      },
      schemes: {
        name: '',
        organization_id: organizationOptions[0]?.id,
        is_active: 1,
        sort_order: 0,
      },
      // A new head sorts after the ones already in its group rather than
      // jumping to the top of every dropdown that offers it.
      'budget-heads': {
        name: '',
        head_group: headGroups[0] ?? 'Research Projects',
        is_active: 1,
        sort_order: budgetHeads.length + 1,
      },
    };

    setCurrent(defaults[activeTab]);
    setIsEditing(false);
    setError('');
    setShowModal(true);
  };

  const openEdit = (row: EditableRow) => {
    setCurrent(row);
    setIsEditing(true);
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError('');

      const path = `/form-options/project-options/${activeTab}`;
      if (isEditing && current.id) {
        await authenticityUtility.put(`${path}/${current.id}`, current);
      } else {
        await authenticityUtility.post(path, current);
      }

      setShowModal(false);
      await fetchAll();
    } catch (err: unknown) {
      const requestError = err as { response?: { data?: { message?: string } } };
      setError(
        'Failed to save. ' + (requestError.response?.data?.message || 'Please try again later.'),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: number) => {
    showAlert(
      `Delete this ${TAB_LABELS[activeTab].toLowerCase()}? If projects already reference it, it is deactivated instead so their history stays intact.`,
      'warning',
      'Confirm deletion',
      true,
      'Delete',
      async () => {
        closeAlert();
        try {
          setLoading(true);
          setError('');
          await authenticityUtility.delete(`/form-options/project-options/${activeTab}/${id}`);
          await fetchAll();
        } catch (err: unknown) {
          const requestError = err as { response?: { data?: { message?: string } } };
          setError(
            'Failed to delete. ' +
              (requestError.response?.data?.message || 'Please try again later.'),
          );
        } finally {
          setLoading(false);
        }
      },
    );
  };

  const statusBadge = (isActive?: number) =>
    isActive === 0 ? (
      <span className="admin-badge admin-badge--muted admin-badge--trailing">Inactive</span>
    ) : null;

  const rowActions = (row: { id: number }) => (
    <div className="admin-actions">
      <AdminIconButton
        icon={<Pencil size={16} aria-hidden="true" />}
        label={`Edit ${TAB_LABELS[activeTab].toLowerCase()}`}
        onClick={() => openEdit(row)}
      />
      <AdminIconButton
        icon={<Trash2 size={16} aria-hidden="true" />}
        label={`Delete ${TAB_LABELS[activeTab].toLowerCase()}`}
        variant="danger"
        onClick={() => handleDelete(row.id)}
      />
    </div>
  );

  const organizationColumns = [
    {
      key: 'name',
      label: 'Name',
      style: { width: '34%' },
      render: (row: OrganizationRow) => (
        <>
          <span className="admin-name">{row.name}</span>
          {row.short_name ? <span className="admin-muted"> ({row.short_name})</span> : null}
          {row.is_internal === 1 && (
            <span className="admin-badge admin-badge--info admin-badge--trailing">Host</span>
          )}
          {statusBadge(row.is_active)}
        </>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      style: { width: '16%' },
      render: (row: OrganizationRow) => row.category || <span className="admin-muted">—</span>,
    },
    {
      key: 'location',
      label: 'Location',
      style: { width: '26%' },
      render: (row: OrganizationRow) =>
        [row.city, row.state, row.country].filter(Boolean).join(', ') || (
          <span className="admin-muted">—</span>
        ),
    },
    {
      key: 'is_funding_agency',
      label: 'Funding agency',
      style: { width: '12%' },
      render: (row: OrganizationRow) =>
        row.is_funding_agency === 0 ? (
          <span className="admin-badge admin-badge--no">No</span>
        ) : (
          <span className="admin-badge admin-badge--yes">Yes</span>
        ),
    },
  ];

  const schemeColumns = [
    {
      key: 'name',
      label: 'Scheme',
      style: { width: '28%' },
      render: (row: SchemeRow) => (
        <>
          <span className="admin-name">{row.name}</span>
          {statusBadge(row.is_active)}
        </>
      ),
    },
    {
      key: 'organization_name',
      label: 'Funding agency',
      style: { width: '26%' },
      render: (row: SchemeRow) => row.organization_name || <span className="admin-muted">—</span>,
    },
    {
      key: 'domain',
      label: 'Domain',
      style: { width: '18%' },
      render: (row: SchemeRow) => row.domain || <span className="admin-muted">—</span>,
    },
    {
      key: 'category',
      label: 'Category',
      style: { width: '16%' },
      render: (row: SchemeRow) => row.category || <span className="admin-muted">—</span>,
    },
  ];

  const budgetHeadColumns = [
    {
      key: 'name',
      label: 'Budget head',
      style: { width: '44%' },
      render: (row: BudgetHeadRow) => (
        <>
          <span className="admin-name">{row.name}</span>
          {statusBadge(row.is_active)}
        </>
      ),
    },
    {
      key: 'head_group',
      label: 'Group',
      style: { width: '30%' },
      render: (row: BudgetHeadRow) => row.head_group || <span className="admin-muted">—</span>,
    },
    {
      key: 'sort_order',
      label: 'Order',
      style: { width: '12%' },
      render: (row: BudgetHeadRow) => <span className="admin-muted">{row.sort_order ?? 0}</span>,
    },
  ];

  const tables: Record<
    TabType,
    { columns: typeof organizationColumns; data: any[]; empty: string }
  > = {
    organizations: {
      columns: organizationColumns,
      data: organizations,
      empty: 'No organizations yet.',
    },
    schemes: { columns: schemeColumns as any, data: schemes, empty: 'No schemes yet.' },
    'budget-heads': {
      columns: budgetHeadColumns as any,
      data: budgetHeads,
      empty: 'No budget heads yet.',
    },
  };

  const counts: Record<TabType, number> = {
    organizations: organizations.length,
    schemes: schemes.length,
    'budget-heads': budgetHeads.length,
  };

  const active = tables[activeTab];

  return (
    <div className="admin-screen">
      <AdminScreenHeader
        title="Project Options"
        description="The master lists the project form is built from — who funds and collaborates on projects, the schemes they offer, and the heads a project budgets against."
        actions={
          <CustomButton onClick={openCreate} disabled={loading}>
            <Plus size={16} aria-hidden="true" />
            Add {TAB_LABELS[activeTab]}
          </CustomButton>
        }
      />

      <AdminTabs<TabType>
        tabs={(Object.keys(TAB_LABELS) as TabType[]).map((tab) => ({
          key: tab,
          label: TAB_TITLES[tab],
          count: counts[tab],
        }))}
        active={activeTab}
        onChange={setActiveTab}
      />

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="admin-card">
        <CustomTable
          columns={active.columns}
          data={active.data}
          loading={loading}
          emptyMessage={active.empty}
          actions={rowActions}
        />
      </div>

      <CustomModal
        show={showModal}
        onHide={() => setShowModal(false)}
        className="admin-modal"
        title={`${isEditing ? 'Edit' : 'Add'} ${TAB_LABELS[activeTab]}`}
        footer={
          <>
            <CustomButton
              variant="light"
              className="admin-btn-secondary"
              onClick={() => setShowModal(false)}
              disabled={loading}
            >
              Cancel
            </CustomButton>
            <CustomButton type="submit" form={FORM_ID} loading={loading}>
              Save
            </CustomButton>
          </>
        }
      >
        <Form id={FORM_ID} onSubmit={handleSubmit}>
          {error && <Alert variant="danger">{error}</Alert>}

          <div className="admin-form-grid">
            {activeTab === 'schemes' && (
              <Form.Group className="custom-input-group admin-field--full" controlId="pfo-agency">
                <Form.Label className="custom-label">Funding agency</Form.Label>
                <Form.Select
                  className="custom-input"
                  value={current.organization_id ?? ''}
                  onChange={(event) =>
                    setCurrent({ ...current, organization_id: Number(event.target.value) })
                  }
                  required
                >
                  <option value="">Select an agency</option>
                  {organizationOptions.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}

            <CustomInput
              className={activeTab === 'organizations' ? '' : 'admin-field--full'}
              label="Name"
              name="pfo-name"
              value={current.name || ''}
              onChange={(value) => setCurrent({ ...current, name: value })}
              autoFocus
              // Nothing here is worth a row without one: an unnamed organization
              // or scheme lands in the project form as an empty option, and the
              // columns take an empty string happily.
              required
            />

            {activeTab === 'organizations' && (
              <>
                <CustomInput
                  label="Short name"
                  name="pfo-short-name"
                  placeholder="DST"
                  value={current.short_name || ''}
                  onChange={(value) => setCurrent({ ...current, short_name: value })}
                />

                <CustomInput
                  label="City"
                  name="pfo-city"
                  value={current.city || ''}
                  onChange={(value) => setCurrent({ ...current, city: value })}
                />

                <CustomInput
                  label="State"
                  name="pfo-state"
                  value={current.state || ''}
                  onChange={(value) => setCurrent({ ...current, state: value })}
                />

                <CustomInput
                  label="Country"
                  name="pfo-country"
                  value={current.country ?? 'India'}
                  onChange={(value) => setCurrent({ ...current, country: value })}
                />
              </>
            )}

            {activeTab === 'budget-heads' && (
              <>
                <CustomInput
                  label="Group"
                  name="pfo-head-group"
                  list="pfo-head-groups"
                  placeholder="Research Projects"
                  value={current.head_group || ''}
                  onChange={(value) => setCurrent({ ...current, head_group: value })}
                  // A head is stored under its group, and the server rejects a
                  // blank one — the dialog says so before the round trip.
                  required
                />
                <datalist id="pfo-head-groups">
                  {headGroups.map((group) => (
                    <option key={group} value={group} />
                  ))}
                </datalist>

                <CustomInput
                  label="Sort order"
                  name="pfo-sort-order"
                  type="number"
                  value={current.sort_order ?? 0}
                  onChange={(value) => setCurrent({ ...current, sort_order: Number(value) })}
                />

                <p className="admin-hint admin-field--full">
                  The group is the heading this head is filed under in the project form, and the
                  order is where it sits within that group. One name may be used in two groups.
                </p>
              </>
            )}

            {activeTab === 'schemes' && (
              <CustomInput
                label="Domain"
                name="pfo-domain"
                value={current.domain || ''}
                onChange={(value) => setCurrent({ ...current, domain: value })}
              />
            )}

            {activeTab !== 'budget-heads' && (
              <>
                <CustomInput
                  label="Category"
                  name="pfo-category"
                  placeholder={activeTab === 'organizations' ? 'Government' : 'Research Project'}
                  value={current.category || ''}
                  onChange={(value) => setCurrent({ ...current, category: value })}
                />

                <CustomInput
                  label="Website"
                  name="pfo-website"
                  type="url"
                  placeholder="https://"
                  value={current.website || ''}
                  onChange={(value) => setCurrent({ ...current, website: value })}
                />
              </>
            )}
          </div>

          <div className="admin-switches">
            {activeTab === 'organizations' && (
              <CustomCheckbox
                label="Offer in the Funding Agency dropdown"
                name="pfo-funding-agency"
                checked={current.is_funding_agency !== 0}
                onChange={(checked) =>
                  setCurrent({ ...current, is_funding_agency: checked ? 1 : 0 })
                }
              />
            )}

            {isEditing && (
              <CustomCheckbox
                label="Active (shown in the project form)"
                name="pfo-active"
                checked={current.is_active !== 0}
                onChange={(checked) => setCurrent({ ...current, is_active: checked ? 1 : 0 })}
              />
            )}
          </div>
        </Form>
      </CustomModal>

      <AlertModal
        show={alertConfig.show}
        onHide={closeAlert}
        message={alertConfig.message}
        type={alertConfig.type}
        title={alertConfig.title}
        showCancel={alertConfig.showCancel}
        confirmText={alertConfig.confirmText}
        onConfirm={alertConfig.onConfirm}
      />
    </div>
  );
};

export default ProjectFormOptions;
