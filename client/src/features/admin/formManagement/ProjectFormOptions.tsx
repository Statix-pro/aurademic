import { Pencil, Trash2 } from 'lucide-react';
import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import { Table, Button, Form, Modal, Alert } from 'react-bootstrap';

import authenticityUtility from '../../../shared/utils/authenticityUtility';
import './FormManagementStyles.css';
import AlertModal, { AlertType } from '../../../shared/components/ui/AlertModal';

interface ProjectOption {
  id: number;
  name: string;
}

type TabType = 'agencies' | 'schemes' | 'agency-types';

const ProjectFormOptions: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('agencies');
  const [options, setOptions] = useState<ProjectOption[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentOption, setCurrentOption] = useState<Partial<ProjectOption>>({ name: '' });
  const [isEditing, setIsEditing] = useState(false);

  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: React.ReactNode;
    type: AlertType;
    title?: string;
    onConfirm?: () => void;
    showCancel?: boolean;
    confirmText?: string;
  }>({
    show: false,
    message: '',
    type: 'info',
  });

  const showAlert = (
    message: React.ReactNode,
    type: AlertType = 'info',
    title?: string,
    showCancel = false,
    confirmText = 'OK',
    onConfirm?: () => void,
  ) => {
    setAlertConfig({ show: true, message, type, title, onConfirm, showCancel, confirmText });
  };

  const closeAlert = () => setAlertConfig((prev) => ({ ...prev, show: false }));

  const fetchOptions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = (await authenticityUtility.get(
        `/form-options/project-options/${activeTab}`,
      )) as { data: ProjectOption[] };
      setOptions(Array.isArray(response.data) ? response.data : []);
    } catch (err: unknown) {
      console.error('Error fetching options:', err);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');

      if (isEditing && currentOption.id) {
        await authenticityUtility.put(
          `/form-options/project-options/${activeTab}/${currentOption.id}`,
          currentOption,
        );
      } else {
        await authenticityUtility.post(`/form-options/project-options/${activeTab}`, currentOption);
      }

      setShowModal(false);
      fetchOptions();
      resetForm();
    } catch (err: unknown) {
      console.error('Error saving option:', err);
      const error = err as { response?: { data?: { message?: string } } };
      setError(
        'Failed to save option. ' + (error.response?.data?.message || 'Please try again later.'),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    showAlert(
      'Are you sure you want to delete this option?',
      'warning',
      'Confirm Deletion',
      true,
      'Delete',
      async () => {
        closeAlert();
        try {
          setLoading(true);
          setError('');
          await authenticityUtility.delete(`/form-options/project-options/${activeTab}/${id}`);
          fetchOptions();
        } catch (err: unknown) {
          console.error('Error deleting option:', err);
          const error = err as { response?: { data?: { message?: string } } };
          setError(
            'Failed to delete option. ' +
              (error.response?.data?.message || 'Please try again later.'),
          );
        } finally {
          setLoading(false);
        }
      },
    );
  };

  const handleEdit = (option: ProjectOption) => {
    setCurrentOption(option);
    setIsEditing(true);
    setShowModal(true);
  };

  const resetForm = () => {
    setCurrentOption({ name: '' });
    setIsEditing(false);
    setError('');
  };

  return (
    <div className="project-management">
      {error && <Alert variant="danger">{error}</Alert>}

      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>Project Options Management</h2>
          <div className="btn-group">
            <Button
              variant={activeTab === 'agencies' ? 'primary' : 'outline-primary'}
              onClick={() => setActiveTab('agencies')}
            >
              Agencies
            </Button>
            <Button
              variant={activeTab === 'schemes' ? 'primary' : 'outline-primary'}
              onClick={() => setActiveTab('schemes')}
            >
              Schemes
            </Button>
            <Button
              variant={activeTab === 'agency-types' ? 'primary' : 'outline-primary'}
              onClick={() => setActiveTab('agency-types')}
            >
              Agency Types
            </Button>
          </div>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          disabled={loading}
        >
          Add New {activeTab.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
        </Button>
      </div>

      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Name</th>
            <th className="text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {options.length > 0 ? (
            options.map((option) => (
              <tr key={option.id}>
                <td>{option.name}</td>
                <td>
                  <div className="btn-group">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleEdit(option)}
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(option.id)}
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
              <td colSpan={2} className="text-center text-muted py-4">
                {loading ? 'Loading...' : 'No data available. Add your first entry to get started.'}
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditing ? 'Edit' : 'Add New'}{' '}
            {activeTab.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                value={currentOption.name || ''}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setCurrentOption({ ...currentOption, name: e.target.value })
                }
                required
              />
            </Form.Group>
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
                {loading ? 'Saving...' : 'Save'}
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
