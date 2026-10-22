import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';
import { createPortal } from 'react-dom';

import AlertModal, { AlertType } from '../../../shared/components/ui/AlertModal';
import CustomButton from '../../../shared/components/ui/CustomButton';
import CustomInput from '../../../shared/components/ui/CustomInput';
import CustomModal from '../../../shared/components/ui/CustomModal';
import CustomTable from '../../../shared/components/ui/CustomTable';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { AdminIconButton } from '../components/AdminScreen';
import './FormManagementStyles.css';

/**
 * The publisher master behind the publication form's Conference, Book and Book Chapter
 * Publisher picker. Users add publishers from the form as 'pending' (usable by them at
 * once); this is where an admin approves them for everyone, rejects them, or fixes the
 * spelling. A rename shows on every linked record, since records read the name by id.
 */

type PublisherStatus = 'approved' | 'pending' | 'rejected';

interface PublisherRow {
  id: number;
  name: string;
  status: PublisherStatus;
  requested_by_name?: string | null;
  usage_count: number;
  created_at?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

const STATUS_BADGE: Record<PublisherStatus, { label: string; className: string }> = {
  approved: { label: 'Approved', className: 'admin-badge--yes' },
  pending: { label: 'Pending review', className: 'admin-badge--info' },
  rejected: { label: 'Rejected', className: 'admin-badge--no' },
};

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;

interface PublisherFormOptionsProps {
  /** Where the Add button renders — the dashboard's tab-strip slot, as for journals. */
  actionSlot?: HTMLElement | null;
}

const PublisherFormOptions: React.FC<PublisherFormOptionsProps> = ({ actionSlot = null }) => {
  const [publishers, setPublishers] = useState<PublisherRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PublisherRow | null>(null);
  const [name, setName] = useState('');
  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: React.ReactNode;
    type: AlertType;
    title?: string;
    onConfirm?: () => void;
    showCancel?: boolean;
    confirmText?: string;
  }>({ show: false, message: '', type: 'info' });

  const closeAlert = () => setAlertConfig((prev) => ({ ...prev, show: false }));

  const fetchPublishers = useCallback(async () => {
    setLoading(true);
    try {
      const response = (await authenticityUtility.get('/form-options/publishers')) as ApiEnvelope<
        PublisherRow[]
      >;
      setPublishers(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch (err: unknown) {
      console.error('Error fetching publishers:', err);
      setPublishers([]);
      setError(errorMessage(err, 'Failed to load publishers.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPublishers();
  }, [fetchPublishers]);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setError('');
    setShowModal(true);
  };

  const openEdit = (row: PublisherRow) => {
    setEditing(row);
    setName(row.name);
    setError('');
    setShowModal(true);
  };

  const save = async () => {
    if (!name.trim()) {
      setError('Publisher name is required.');
      return;
    }
    setLoading(true);
    try {
      if (editing) {
        await authenticityUtility.put(`/form-options/publishers/${editing.id}`, {
          name,
          status: editing.status,
        });
      } else {
        await authenticityUtility.post('/form-options/publishers', { name });
      }
      setShowModal(false);
      setError('');
      await fetchPublishers();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to save publisher.'));
    } finally {
      setLoading(false);
    }
  };

  const setStatus = async (row: PublisherRow, status: PublisherStatus) => {
    setLoading(true);
    try {
      await authenticityUtility.put(`/form-options/publishers/${row.id}`, {
        name: row.name,
        status,
      });
      setError('');
      await fetchPublishers();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to update publisher.'));
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (row: PublisherRow) => {
    setAlertConfig({
      show: true,
      type: 'warning',
      title: 'Confirm Deletion',
      message: `Delete "${row.name}"?`,
      showCancel: true,
      confirmText: 'Delete',
      onConfirm: async () => {
        closeAlert();
        setLoading(true);
        try {
          await authenticityUtility.delete(`/form-options/publishers/${row.id}`);
          setError('');
          await fetchPublishers();
        } catch (err: unknown) {
          setError(errorMessage(err, 'Failed to delete publisher.'));
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const columns = [
    {
      key: 'name',
      label: 'Publisher',
      style: { width: '40%' },
      render: (row: PublisherRow) => (
        <>
          <span className="admin-name">{row.name}</span>
          <span
            className={`admin-badge ${STATUS_BADGE[row.status].className} admin-badge--trailing`}
          >
            {STATUS_BADGE[row.status].label}
          </span>
        </>
      ),
    },
    {
      key: 'requested_by_name',
      label: 'Added by',
      render: (row: PublisherRow) =>
        // No requester: added by an admin here, or seeded from existing records.
        row.requested_by_name || <span className="admin-muted">Admin</span>,
    },
    {
      key: 'usage_count',
      label: 'Publications',
      render: (row: PublisherRow) => Number(row.usage_count) || 0,
    },
  ];

  const rowActions = (row: PublisherRow) => (
    <div className="admin-actions">
      {row.status !== 'approved' && (
        <AdminIconButton
          icon={<Check size={16} aria-hidden="true" />}
          label="Approve publisher"
          onClick={() => setStatus(row, 'approved')}
          disabled={loading}
        />
      )}
      {row.status !== 'rejected' && (
        <AdminIconButton
          icon={<X size={16} aria-hidden="true" />}
          label="Reject publisher"
          variant="danger"
          onClick={() => setStatus(row, 'rejected')}
          disabled={loading}
        />
      )}
      <AdminIconButton
        icon={<Pencil size={16} aria-hidden="true" />}
        label="Edit publisher"
        onClick={() => openEdit(row)}
        disabled={loading}
      />
      <AdminIconButton
        icon={<Trash2 size={16} aria-hidden="true" />}
        label="Delete publisher"
        variant="danger"
        onClick={() => confirmDelete(row)}
        disabled={loading}
      />
    </div>
  );

  const addButton = (
    <CustomButton className="journal-management__add" onClick={openAdd} disabled={loading}>
      <Plus size={17} aria-hidden="true" />
      Add Publisher
    </CustomButton>
  );

  return (
    <div className="journal-management">
      {actionSlot ? (
        createPortal(addButton, actionSlot)
      ) : (
        <div className="d-flex justify-content-end align-items-center mb-2">{addButton}</div>
      )}

      {error && !showModal && <Alert variant="danger">{error}</Alert>}

      <CustomTable
        columns={columns}
        data={publishers}
        loading={loading && publishers.length === 0}
        emptyMessage="No publishers yet"
        actions={rowActions}
      />

      <CustomModal
        show={showModal}
        onHide={() => setShowModal(false)}
        size="sm"
        title={editing ? 'Edit Publisher' : 'Add Publisher'}
        footer={
          <>
            <CustomButton
              variant="secondary"
              onClick={() => setShowModal(false)}
              disabled={loading}
            >
              Cancel
            </CustomButton>
            <CustomButton onClick={save} loading={loading}>
              Save
            </CustomButton>
          </>
        }
      >
        <CustomInput
          name="publisherName"
          label="Publisher Name"
          value={name}
          onChange={setName}
          error={showModal ? error : ''}
          autoFocus
          required
        />
        {editing && Number(editing.usage_count) > 0 && (
          <p className="text-muted small mb-0 mt-2">
            The new name will show on the {editing.usage_count} publication(s) that use it.
          </p>
        )}
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

export default PublisherFormOptions;
