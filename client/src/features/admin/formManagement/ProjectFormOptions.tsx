import { Pencil, Trash2 } from 'lucide-react';
import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent, useMemo } from 'react';
import { Table, Button, Form, Modal, Alert, Badge } from 'react-bootstrap';

import AlertModal, { AlertType } from '../../../shared/components/ui/AlertModal';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import './FormManagementStyles.css';

/**
 * Master data behind the project form's "Call for Details" card: the
 * organizations that fund or collaborate on projects, and the schemes each of
 * them offers. A scheme carries the domain, category and website the form shows
 * read-only next to it.
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

type TabType = 'organizations' | 'schemes';
type EditableRow = Partial<OrganizationRow> & Partial<SchemeRow>;

const TAB_LABELS: Record<TabType, string> = {
  organizations: 'Organization',
  schemes: 'Scheme',
};

const ProjectFormOptions: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('organizations');
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [schemes, setSchemes] = useState<SchemeRow[]>([]);
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
      const [organizationResponse, schemeResponse] = await Promise.all([
        authenticityUtility.get('/form-options/project-options/organizations') as Promise<{
          data: OrganizationRow[];
        }>,
        authenticityUtility.get('/form-options/project-options/schemes') as Promise<{
          data: SchemeRow[];
        }>,
      ]);

      setOrganizations(Array.isArray(organizationResponse.data) ? organizationResponse.data : []);
      setSchemes(Array.isArray(schemeResponse.data) ? schemeResponse.data : []);
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

  const openCreate = () => {
    setCurrent(
      activeTab === 'organizations'
        ? { name: '', country: 'India', is_funding_agency: 1, is_active: 1, sort_order: 0 }
        : { name: '', organization_id: organizationOptions[0]?.id, is_active: 1, sort_order: 0 },
    );
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
      <Badge bg="secondary" className="ms-2">
        Inactive
      </Badge>
    ) : null;

  return (
    <div className="project-management">
      {error && <Alert variant="danger">{error}</Alert>}

      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>Project Options Management</h2>
          <div className="btn-group">
            {(Object.keys(TAB_LABELS) as TabType[]).map((tab) => (
              <Button
                key={tab}
                variant={activeTab === tab ? 'primary' : 'outline-primary'}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'organizations' ? 'Organizations' : 'Schemes'}
              </Button>
            ))}
          </div>
        </div>
        <Button variant="primary" onClick={openCreate} disabled={loading}>
          Add New {TAB_LABELS[activeTab]}
        </Button>
      </div>

      {activeTab === 'organizations' ? (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Location</th>
              <th>Funding agency</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {organizations.length > 0 ? (
              organizations.map((organization) => (
                <tr key={organization.id}>
                  <td>
                    {organization.name}
                    {organization.short_name ? ` (${organization.short_name})` : ''}
                    {statusBadge(organization.is_active)}
                    {organization.is_internal === 1 && (
                      <Badge bg="info" className="ms-2">
                        Host institution
                      </Badge>
                    )}
                  </td>
                  <td>{organization.category || '—'}</td>
                  <td>
                    {[organization.city, organization.state, organization.country]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </td>
                  <td>{organization.is_funding_agency === 0 ? 'No' : 'Yes'}</td>
                  <td>
                    <div className="btn-group">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openEdit(organization)}
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(organization.id)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-center text-muted py-4">
                  {loading ? 'Loading…' : 'No organizations yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Scheme</th>
              <th>Funding agency</th>
              <th>Domain</th>
              <th>Category</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {schemes.length > 0 ? (
              schemes.map((scheme) => (
                <tr key={scheme.id}>
                  <td>
                    {scheme.name}
                    {statusBadge(scheme.is_active)}
                  </td>
                  <td>{scheme.organization_name || '—'}</td>
                  <td>{scheme.domain || '—'}</td>
                  <td>{scheme.category || '—'}</td>
                  <td>
                    <div className="btn-group">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openEdit(scheme)}
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(scheme.id)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-center text-muted py-4">
                  {loading ? 'Loading…' : 'No schemes yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      )}

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditing ? 'Edit' : 'Add New'} {TAB_LABELS[activeTab]}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            {activeTab === 'schemes' && (
              <Form.Group className="mb-3">
                <Form.Label>Funding agency</Form.Label>
                <Form.Select
                  value={current.organization_id ?? ''}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
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

            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                value={current.name || ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCurrent({ ...current, name: event.target.value })
                }
                required
              />
            </Form.Group>

            {activeTab === 'organizations' && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Short name</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="DST"
                    value={current.short_name || ''}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setCurrent({ ...current, short_name: event.target.value })
                    }
                  />
                </Form.Group>

                <div className="row">
                  <Form.Group className="mb-3 col-md-6">
                    <Form.Label>City</Form.Label>
                    <Form.Control
                      type="text"
                      value={current.city || ''}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setCurrent({ ...current, city: event.target.value })
                      }
                    />
                  </Form.Group>

                  <Form.Group className="mb-3 col-md-6">
                    <Form.Label>State</Form.Label>
                    <Form.Control
                      type="text"
                      value={current.state || ''}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setCurrent({ ...current, state: event.target.value })
                      }
                    />
                  </Form.Group>
                </div>

                <Form.Group className="mb-3">
                  <Form.Label>Country</Form.Label>
                  <Form.Control
                    type="text"
                    value={current.country ?? 'India'}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setCurrent({ ...current, country: event.target.value })
                    }
                  />
                </Form.Group>

                <Form.Check
                  className="mb-3"
                  type="checkbox"
                  id="pf-option-funding-agency"
                  label="Offer this organization in the Funding Agency dropdown"
                  checked={current.is_funding_agency !== 0}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setCurrent({ ...current, is_funding_agency: event.target.checked ? 1 : 0 })
                  }
                />
              </>
            )}

            {activeTab === 'schemes' && (
              <Form.Group className="mb-3">
                <Form.Label>Domain</Form.Label>
                <Form.Control
                  type="text"
                  value={current.domain || ''}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setCurrent({ ...current, domain: event.target.value })
                  }
                />
              </Form.Group>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Category</Form.Label>
              <Form.Control
                type="text"
                placeholder={activeTab === 'organizations' ? 'Government' : 'Research Project'}
                value={current.category || ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCurrent({ ...current, category: event.target.value })
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Website</Form.Label>
              <Form.Control
                type="url"
                placeholder="https://"
                value={current.website || ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCurrent({ ...current, website: event.target.value })
                }
              />
            </Form.Group>

            {isEditing && (
              <Form.Check
                className="mb-3"
                type="checkbox"
                id="pf-option-active"
                label="Active (shown in the project form)"
                checked={current.is_active !== 0}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCurrent({ ...current, is_active: event.target.checked ? 1 : 0 })
                }
              />
            )}

            <div className="d-flex justify-content-end">
              <Button
                variant="secondary"
                className="me-2"
                onClick={() => setShowModal(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

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
