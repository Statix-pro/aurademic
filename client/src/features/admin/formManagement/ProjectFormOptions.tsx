import { Pencil, Plus, Trash2 } from 'lucide-react';
import React, { useState, useEffect, useCallback, FormEvent, useMemo } from 'react';
import { Alert, Form } from 'react-bootstrap';

import AlertModal, { AlertType } from '../../../shared/components/ui/AlertModal';
import CustomButton from '../../../shared/components/ui/CustomButton';
import CustomCheckbox from '../../../shared/components/ui/CustomCheckbox';
import CustomDropdown, { OptionType } from '../../../shared/components/ui/CustomDropdown';
import CustomInput from '../../../shared/components/ui/CustomInput';
import CustomModal from '../../../shared/components/ui/CustomModal';
import CustomTable from '../../../shared/components/ui/CustomTable';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { PROJECT_TYPE_OPTIONS, projectTypeRules } from '../../projects/constants';
import { AdminIconButton, AdminScreenHeader, AdminTabs } from '../components/AdminScreen';

/**
 * Master data behind the project form: the organizations that fund or
 * collaborate on projects, the schemes each of them offers, the budget head
 * vocabulary the form's Budget Head(s) pickers are built from, and the
 * National Initiatives, Domains and Categories lists. A scheme carries the
 * category and website the form shows read-only next to it.
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

/**
 * A scheme's domain or category as `<option>`s: the curated list, plus the
 * scheme's stored value when it is not on it.
 *
 * A scheme can hold a value the list no longer offers — renamed or retired on
 * the Domains or Categories tab, or free text saved before the lists existed.
 * Offering it keeps the select from rendering blank, and the server lets that
 * unchanged value through, so editing the scheme's other fields is not blocked.
 */
function schemeSelectOptions(options: { value: string; label: string }[], stored?: string | null) {
  const legacyValue = stored && !options.some((option) => option.value === stored) ? stored : null;
  return legacyValue
    ? [{ value: legacyValue, label: `${legacyValue} (not on the list)` }, ...options]
    : options;
}

interface SchemeRow {
  id: number;
  organization_id: number;
  /** The kind of grant it funds; picks its category list. */
  project_type?: string;
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

/**
 * An entry on one of the curated lists — National Initiatives, Domains or
 * Categories. Like budget heads, projects and schemes store the name, so a
 * rename or deactivation here changes only what the form offers next.
 */
interface VocabularyRow {
  id: number;
  list_key: string;
  /** The project type a category is for; '' on the other two lists. */
  project_type: string;
  name: string;
  is_active?: number;
  sort_order?: number;
}

type VocabularyTab = 'national-initiatives' | 'domains' | 'categories';

// The tab is also the path segment its CRUD calls use, so these match the
// routes in server/modules/formOptions/formOptionsRoutes.js.
type TabType = 'organizations' | 'schemes' | 'budget-heads' | VocabularyTab;
type EditableRow = Partial<OrganizationRow> &
  Partial<SchemeRow> &
  Partial<BudgetHeadRow> &
  Partial<VocabularyRow>;

const VOCABULARY_TABS: VocabularyTab[] = ['national-initiatives', 'domains', 'categories'];
const isVocabularyTab = (tab: TabType): tab is VocabularyTab =>
  (VOCABULARY_TABS as TabType[]).includes(tab);

const TAB_LABELS: Record<TabType, string> = {
  organizations: 'Organization',
  schemes: 'Scheme',
  'budget-heads': 'Budget Head',
  'national-initiatives': 'National Initiative',
  domains: 'Domain',
  categories: 'Category',
};

const TAB_TITLES: Record<TabType, string> = {
  organizations: 'Organizations',
  schemes: 'Schemes',
  'budget-heads': 'Budget Heads',
  'national-initiatives': 'National Initiatives',
  domains: 'Domains',
  categories: 'Categories',
};

const projectTypeLabel = (projectType?: string | null) =>
  PROJECT_TYPE_OPTIONS.find((option) => option.value === projectType)?.label ?? projectType;

/** Active entries as `<option>`s, in the order set on their tab. */
const activeOptions = (rows: VocabularyRow[]) =>
  rows.filter((row) => row.is_active !== 0).map((row) => ({ value: row.name, label: row.name }));

// The dialog's form fills its body and Save sits in its footer, outside the
// form, so the button reaches the form by id.
const FORM_ID = 'project-form-options-form';

interface ProjectFormOptionsProps {
  /**
   * Rendered inside the admin dashboard's "Project Management" tab rather than
   * on its own route. The tab strip above it already names the screen and the
   * panel supplies the gutter, so the page title, its blurb and the page
   * padding would all be said twice — everything below the header is identical
   * either way.
   */
  embedded?: boolean;
}

const ProjectFormOptions: React.FC<ProjectFormOptionsProps> = ({ embedded = false }) => {
  const [activeTab, setActiveTab] = useState<TabType>('organizations');
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [schemes, setSchemes] = useState<SchemeRow[]>([]);
  const [budgetHeads, setBudgetHeads] = useState<BudgetHeadRow[]>([]);
  const [vocabulary, setVocabulary] = useState<Record<VocabularyTab, VocabularyRow[]>>({
    'national-initiatives': [],
    domains: [],
    categories: [],
  });
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

      // Schemes reference organizations, domains and categories, so every list
      // is always loaded: the scheme editor needs their dropdowns either way.
      const [organizationResponse, schemeResponse, budgetHeadResponse, ...vocabularyResponses] =
        await Promise.all([
          authenticityUtility.get('/form-options/project-options/organizations') as Promise<{
            data: OrganizationRow[];
          }>,
          authenticityUtility.get('/form-options/project-options/schemes') as Promise<{
            data: SchemeRow[];
          }>,
          authenticityUtility.get('/form-options/project-options/budget-heads') as Promise<{
            data: BudgetHeadRow[];
          }>,
          ...VOCABULARY_TABS.map(
            (tab) =>
              authenticityUtility.get(`/form-options/project-options/${tab}`) as Promise<{
                data: VocabularyRow[];
              }>,
          ),
        ]);

      setOrganizations(Array.isArray(organizationResponse.data) ? organizationResponse.data : []);
      setSchemes(Array.isArray(schemeResponse.data) ? schemeResponse.data : []);
      setBudgetHeads(Array.isArray(budgetHeadResponse.data) ? budgetHeadResponse.data : []);
      setVocabulary(
        Object.fromEntries(
          VOCABULARY_TABS.map((tab, index) => [
            tab,
            Array.isArray(vocabularyResponses[index].data) ? vocabularyResponses[index].data : [],
          ]),
        ) as Record<VocabularyTab, VocabularyRow[]>,
      );
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

  // What the scheme editor offers: the active entries only. A scheme's stored
  // value that is no longer among them is added back by `schemeSelectOptions`.
  const domainOptions = useMemo(() => activeOptions(vocabulary.domains), [vocabulary.domains]);
  const categoryOptionsFor = (projectType: string) =>
    activeOptions(vocabulary.categories.filter((row) => row.project_type === projectType));

  /**
   * Where a new entry sits on its list — after the ones already there. A
   * category's position is within its project type's list.
   */
  const nextVocabularySortOrder = (tab: VocabularyTab, projectType = '') =>
    vocabulary[tab]
      .filter((row) => row.project_type === projectType)
      .reduce((highest, row) => Math.max(highest, row.sort_order ?? 0), 0) + 1;

  /**
   * Where a new head sits in the group it is being added to — after the ones
   * already there. Counted within the group, not across the whole table: the
   * order only decides the position inside one dropdown heading, and a total
   * row count would sit a head behind a group whose own orders run higher.
   */
  const nextSortOrderIn = (group: string) =>
    budgetHeads
      .filter((head) => head.head_group === group)
      .reduce((highest, head) => Math.max(highest, head.sort_order ?? 0), 0) + 1;

  // A save error belongs to the dialog; it is not left on the page behind it
  // once the dialog is closed.
  const closeModal = () => {
    setShowModal(false);
    setError('');
  };

  const openCreate = () => {
    const defaultHeadGroup = headGroups[0] ?? 'Research Projects';
    // Each list's new entry sorts after the ones already on it.
    const vocabularyDefault = (tab: VocabularyTab, projectType = ''): EditableRow => ({
      name: '',
      project_type: projectType,
      is_active: 1,
      sort_order: nextVocabularySortOrder(tab, projectType),
    });

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
        project_type: 'research_project',
        is_active: 1,
        sort_order: 0,
      },
      // A new head sorts after the ones already in its group rather than
      // jumping to the top of every dropdown that offers it.
      'budget-heads': {
        name: '',
        head_group: defaultHeadGroup,
        is_active: 1,
        sort_order: nextSortOrderIn(defaultHeadGroup),
      },
      'national-initiatives': vocabularyDefault('national-initiatives'),
      domains: vocabularyDefault('domains'),
      categories: vocabularyDefault('categories', 'research_project'),
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
      key: 'project_type',
      label: 'Type',
      style: { width: '12%' },
      render: (row: SchemeRow) => projectTypeLabel(row.project_type),
    },
    {
      key: 'domain',
      label: 'Domain',
      style: { width: '14%' },
      render: (row: SchemeRow) => row.domain || <span className="admin-muted">—</span>,
    },
    {
      key: 'category',
      label: 'Category',
      style: { width: '14%' },
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

  const vocabularyNameColumn = {
    key: 'name',
    label: 'Name',
    style: { width: '60%' },
    render: (row: VocabularyRow) => (
      <>
        <span className="admin-name">{row.name}</span>
        {statusBadge(row.is_active)}
      </>
    ),
  };
  const vocabularyOrderColumn = {
    key: 'sort_order',
    label: 'Order',
    style: { width: '12%' },
    render: (row: VocabularyRow) => <span className="admin-muted">{row.sort_order ?? 0}</span>,
  };
  const vocabularyColumns = [vocabularyNameColumn, vocabularyOrderColumn];
  // A category is offered only for its project type, so the type is shown.
  const categoryColumns = [
    { ...vocabularyNameColumn, style: { width: '46%' } },
    {
      key: 'project_type',
      label: 'Project type',
      style: { width: '26%' },
      render: (row: VocabularyRow) => projectTypeLabel(row.project_type),
    },
    vocabularyOrderColumn,
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
    'national-initiatives': {
      columns: vocabularyColumns as any,
      data: vocabulary['national-initiatives'],
      empty: 'No national initiatives yet.',
    },
    domains: {
      columns: vocabularyColumns as any,
      data: vocabulary.domains,
      empty: 'No domains yet.',
    },
    categories: {
      columns: categoryColumns as any,
      data: vocabulary.categories,
      empty: 'No categories yet.',
    },
  };

  const counts: Record<TabType, number> = {
    organizations: organizations.length,
    schemes: schemes.length,
    'budget-heads': budgetHeads.length,
    'national-initiatives': vocabulary['national-initiatives'].length,
    domains: vocabulary.domains.length,
    categories: vocabulary.categories.length,
  };

  const active = tables[activeTab];

  const addButton = (
    <CustomButton onClick={openCreate} disabled={loading}>
      <Plus size={16} aria-hidden="true" />
      Add {TAB_LABELS[activeTab]}
    </CustomButton>
  );

  return (
    <div className={`admin-screen ${embedded ? 'admin-screen--embedded' : ''}`.trim()}>
      {!embedded && (
        <AdminScreenHeader
          title="Project Options"
          description="The master lists the project form is built from — who funds and collaborates on projects, the schemes they offer, the heads a project budgets against, and the national initiatives, domains and categories it is classed under."
          actions={addButton}
        />
      )}

      <AdminTabs<TabType>
        tabs={(Object.keys(TAB_LABELS) as TabType[]).map((tab) => ({
          key: tab,
          label: TAB_TITLES[tab],
          count: counts[tab],
        }))}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* Embedded there is no title for the button to sit beside, so it shares
          the tab strip's row instead of taking one of its own — a full-width
          band of empty card with a button at the far end. */}
      {embedded && (
        <div className="admin-screen__header-actions admin-screen__tab-actions">{addButton}</div>
      )}

      {/* One error state serves the page and the dialog; while the dialog is
          open its own copy is the one being read, so the page's would only
          repeat it behind the backdrop. */}
      {error && !showModal && <Alert variant="danger">{error}</Alert>}

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
        onHide={closeModal}
        className="admin-modal"
        title={`${isEditing ? 'Edit' : 'Add'} ${TAB_LABELS[activeTab]}`}
        footer={
          <>
            <CustomButton
              variant="light"
              className="admin-btn-secondary"
              onClick={closeModal}
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
                  onChange={(value) =>
                    setCurrent({
                      ...current,
                      head_group: value,
                      // The order is a position inside one group, so moving a
                      // new head to another group re-reads it there. Only while
                      // creating: an existing head keeps the place it was given.
                      ...(isEditing ? {} : { sort_order: nextSortOrderIn(value) }),
                    })
                  }
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

            {isVocabularyTab(activeTab) && (
              <>
                {activeTab === 'categories' && (
                  <CustomDropdown
                    label="Project type"
                    name="pfo-vocabulary-project-type"
                    options={PROJECT_TYPE_OPTIONS}
                    value={
                      PROJECT_TYPE_OPTIONS.find(
                        (option) => option.value === (current.project_type || 'research_project'),
                      ) ?? null
                    }
                    onChange={(selected) => {
                      const projectType = String((selected as OptionType | null)?.value ?? '');
                      if (!projectType || projectType === current.project_type) return;
                      setCurrent({
                        ...current,
                        project_type: projectType,
                        // The order is a position inside one type's list, so a
                        // new category re-reads it there. Only while creating:
                        // an existing one keeps the place it was given.
                        ...(isEditing
                          ? {}
                          : { sort_order: nextVocabularySortOrder('categories', projectType) }),
                      });
                    }}
                  />
                )}

                <CustomInput
                  label="Sort order"
                  name="pfo-vocabulary-sort-order"
                  type="number"
                  value={current.sort_order ?? 0}
                  onChange={(value) => setCurrent({ ...current, sort_order: Number(value) })}
                />

                <p className="admin-hint admin-field--full">
                  {activeTab === 'categories'
                    ? 'A category is offered only for schemes of its project type. '
                    : ''}
                  Projects and schemes keep the name they were saved with, so renaming or
                  deactivating an entry changes only what the project form offers from now on.
                </p>
              </>
            )}

            {/* A scheme's domain and category come from the curated lists,
                checked again on the server; an organization's category is its
                type and stays free text. The type decides the category list,
                so a change of type clears the category — and the domain, for a
                type that has none. */}
            {activeTab === 'schemes' && (
              <CustomDropdown
                label="Project type"
                name="pfo-project-type"
                options={PROJECT_TYPE_OPTIONS}
                value={
                  PROJECT_TYPE_OPTIONS.find(
                    (option) => option.value === (current.project_type || 'research_project'),
                  ) ?? null
                }
                onChange={(selected) => {
                  const projectType = String((selected as OptionType | null)?.value ?? '');
                  if (!projectType || projectType === current.project_type) return;
                  // The server lets an unlisted domain through only while the
                  // type is unchanged, so under a new type it would refuse
                  // one; it is cleared here rather than on a failed save.
                  const unlistedDomain =
                    Boolean(current.domain) &&
                    !domainOptions.some((option) => option.value === current.domain);
                  setCurrent({
                    ...current,
                    project_type: projectType,
                    category: null,
                    ...(projectTypeRules(projectType).schemeHasDomain && !unlistedDomain
                      ? {}
                      : { domain: null }),
                  });
                }}
              />
            )}

            {activeTab === 'schemes' &&
              [
                ...(projectTypeRules(current.project_type || 'research_project').schemeHasDomain
                  ? [{ key: 'domain' as const, label: 'Domain', options: domainOptions }]
                  : []),
                {
                  key: 'category' as const,
                  label: 'Category',
                  options: categoryOptionsFor(current.project_type || 'research_project'),
                },
              ].map((field) => {
                const options = [
                  { value: '', label: 'Not stated' },
                  ...schemeSelectOptions(field.options, current[field.key]),
                ];
                return (
                  <CustomDropdown
                    key={field.key}
                    label={field.label}
                    name={`pfo-${field.key}`}
                    options={options}
                    value={
                      options.find((option) => option.value === (current[field.key] || '')) ?? null
                    }
                    onChange={(selected) =>
                      setCurrent({
                        ...current,
                        [field.key]: String((selected as OptionType | null)?.value ?? '') || null,
                      })
                    }
                  />
                );
              })}

            {(activeTab === 'organizations' || activeTab === 'schemes') && (
              <>
                {activeTab === 'organizations' && (
                  <CustomInput
                    label="Category"
                    name="pfo-category"
                    placeholder="Government"
                    value={current.category || ''}
                    onChange={(value) => setCurrent({ ...current, category: value })}
                  />
                )}

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
