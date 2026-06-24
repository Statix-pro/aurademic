import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Form, Spinner, Accordion, Card } from 'react-bootstrap';
import { ChevronDown, ChevronRight, ChevronLeft, Edit2, CheckCircle, Shield, ShieldCheck, UserCog, Plus, Trash2, Save, RefreshCw, Search, X } from 'lucide-react';
import Select, { GroupProps, GroupHeadingProps, components } from 'react-select';
import {
  canAccessAdminArea,
  canAccessBudgetApproval,
  canManageAccessControl,
} from '../../../shared/utils/permissionUtils';
import authenticityUtility from '../../../shared/utils/authenticityUtility';

import './AccessControlPage.css';
import AlertModal, { AlertType } from '../../../shared/components/ui/AlertModal';
import DeleteConfirmationModal from '../../../shared/components/ui/DeleteConfirmationModal';

interface Permission {
  id: number;
  module_key: string;
  action_key: string;
  permission_key: string;
  description?: string;
  is_system: boolean;
}

interface RolePermission {
  permission_key: string;
  module_key: string;
  action_key: string;
  description?: string;
  is_system?: boolean;
}

interface Role {
  id: number;
  role_code: string;
  role_name: string;
  description?: string;
  is_system: boolean;
  is_admin_role: boolean;
  assigned_user_count: number;
  permissions: RolePermission[];
}

interface UserRole {
  id: number;
  role_code: string;
  role_name: string;
}

interface EntityRole {
  entity_id: number;
  entity_type: string;
  entity_name: string;
  role_code: string;
  role_name: string;
}

interface AccessUser {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  is_super_admin: boolean;
  roles: UserRole[];
  entity_roles: EntityRole[];
}

interface ApiCollectionResponse<T> {
  data: T[];
}

interface RoleMetaDraft {
  role_name: string;
  description: string;
  is_admin_role: boolean;
}

const getPermissionGroupKey = (permission: Permission): string => {
  if (permission.permission_key?.startsWith('budget.')) {
    return 'budget';
  }

  return permission.module_key;
};

const getRoleBadgeClassName = (roleCode: string): string => {
  const code = roleCode?.toLowerCase();
  if (code === 'super_admin') {
    return 'assigned-role-tag assigned-role-tag-super-admin';
  }

  if (code === 'admin') {
    return 'assigned-role-tag assigned-role-tag-admin';
  }

  if (code === 'hod') {
    return 'assigned-role-tag assigned-role-tag-hod';
  }

  if (code === 'coordinator') {
    return 'assigned-role-tag assigned-role-tag-coordinator';
  }

  return 'assigned-role-tag assigned-role-tag-default';
};

const AccessControlPage: React.FC = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<AccessUser[]>([]);

  const [userRoleDrafts, setUserRoleDrafts] = useState<Record<number, string[]>>({});
  const [userEntityRoleDrafts, setUserEntityRoleDrafts] = useState<Record<number, EntityRole[]>>({});
  const [rolePermissionDrafts, setRolePermissionDrafts] = useState<Record<number, string[]>>({});
  const [roleMetaDrafts, setRoleMetaDrafts] = useState<Record<number, RoleMetaDraft>>({});

  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);
  const [savingRoleMetaId, setSavingRoleMetaId] = useState<number | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);

  const [expandedUser, setExpandedUser] = useState<number | null>(null); // New state for accordion

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const [roleCreationLoading, setRoleCreationLoading] = useState(false);
  const [syncRolesLoading, setSyncRolesLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

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
    type: 'info'
  });

  const showAlert = (message: React.ReactNode, type: AlertType = 'info', title?: string, showCancel = false, confirmText = 'OK', onConfirm?: () => void) => {
    setAlertConfig({ show: true, message, type, title, onConfirm, showCancel, confirmText });
  };

  const closeAlert = () => setAlertConfig(prev => ({ ...prev, show: false }));

  const [deleteModalConfig, setDeleteModalConfig] = useState<{
    show: boolean;
    role: Role | null;
  }>({
    show: false,
    role: null
  });

  const handleSyncRolesClick = () => {
    showAlert(
      'This will update the assigned HODs and Coordinators based on the department and club database. Do you want to continue?',
      'warning',
      'Update Roles',
      true,
      'Update Now',
      () => {
        closeAlert();
        executeSyncRoles();
      }
    );
  };

  const executeSyncRoles = async () => {

    setSyncRolesLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await authenticityUtility.post('/access-control/sync-roles');
      setSuccessMessage((response as any)?.data?.message || 'Roles synchronized successfully.');
      await fetchAccessControlData(search);
    } catch (err: unknown) {
      console.error('Failed to sync roles', err);
      const errorObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setError(
        errorObj.response?.data?.message ||
        errorObj.message ||
        'Failed to sync roles'
      );
    } finally {
      setSyncRolesLoading(false);
    }
  };

  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const toggleGroup = (groupLabel: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupLabel)
        ? prev.filter(g => g !== groupLabel)
        : [...prev, groupLabel]
    );
  };

  const CollapsibleGroupHeading = (props: GroupHeadingProps<any>) => {
    const isExpanded = expandedGroups.includes(props.data.label);
    return (
      <components.GroupHeading {...props}>
        <div
          onClick={(e) => {
            e.stopPropagation();
            toggleGroup(props.data.label);
          }}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--bs-primary)',
            fontWeight: 700,
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {props.children}
        </div>
      </components.GroupHeading>
    );
  };

  const CollapsibleGroup = (props: GroupProps<any>) => {
    const isExpanded = expandedGroups.includes(props.data.label);
    return (
      <components.Group {...props}>
        {isExpanded && props.children}
      </components.Group>
    );
  };

  const [roleName, setRoleName] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<string[]>([]);

  // System Entity references for manual binding
  const [masterEntities, setMasterEntities] = useState<any[]>([]);

  const hodOptions = useMemo(() => {
    return masterEntities
      .filter(e => e.entity_type === 'DEPARTMENT')
      .map(e => ({ label: e.entity_name, value: e.entity_id, type: 'DEPARTMENT' }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [masterEntities]);

  const coordinatorOptions = useMemo(() => {
    const nonDepts = masterEntities.filter(e => e.entity_type !== 'DEPARTMENT');
    const groups: Record<string, { label: string; value: number, type: string }[]> = {};

    nonDepts.forEach(e => {
      const type = e.entity_type || 'OTHER';
      if (!groups[type]) groups[type] = [];
      groups[type].push({ label: e.entity_name, value: e.entity_id, type: e.entity_type });
    });

    return Object.keys(groups)
      .sort()
      .map(type => ({
        label: type,
        options: groups[type].sort((a, b) => a.label.localeCompare(b.label))
      }));
  }, [masterEntities]);

  const permissionsByModule = useMemo(() => {
    const grouped: Record<string, Permission[]> = {};

    permissions.forEach((permission) => {
      const groupKey = getPermissionGroupKey(permission);

      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }

      grouped[groupKey].push(permission);
    });

    return grouped;
  }, [permissions]);

  const fetchAccessControlData = async (
    searchValue = '',
    options: { showPageLoader?: boolean } = {}
  ) => {
    const { showPageLoader = false } = options;

    if (showPageLoader) {
      setLoading(true);
    }
    setError('');

    try {
      const [permissionResponse, roleResponse, userResponse, orgUnitsResponse] = await Promise.all([
        authenticityUtility.get('/access-control/permissions') as Promise<
          ApiCollectionResponse<Permission>
        >,
        authenticityUtility.get('/access-control/roles') as Promise<
          ApiCollectionResponse<Role>
        >,
        authenticityUtility.get('/access-control/users', {
          params: { search: searchValue.trim() },
        }) as Promise<ApiCollectionResponse<AccessUser>>,
        // Need lists of all entities to map against
        authenticityUtility.get('/adminbudget/org-units').catch(() => ({ data: { data: { all: [] } } }))
      ]);

      const fetchedPermissions = Array.isArray(permissionResponse.data)
        ? permissionResponse.data
        : [];
      const fetchedRoles = Array.isArray(roleResponse.data) ? roleResponse.data : [];
      const fetchedUsers = Array.isArray(userResponse.data) ? userResponse.data : [];

      setPermissions(fetchedPermissions);
      setRoles(fetchedRoles);
      setUsers(fetchedUsers);

      // Aggregating available entities
      console.log('ORG_UNITS_API_RESPONSE_LOG', orgUnitsResponse);
      const rawOrgUnits = (orgUnitsResponse as any)?.data?.data?.all || (orgUnitsResponse as any)?.data?.all || [];

      const combinedEntities = rawOrgUnits.map((e: any) => ({
        entity_id: e.id,
        entity_name: e.name,
        entity_type: e.type_code
      }));
      setMasterEntities(combinedEntities);

      const initialUserRoleDrafts: Record<number, string[]> = {};
      const initialUserEntityRoleDrafts: Record<number, EntityRole[]> = {};

      fetchedUsers.forEach((accessUser) => {
        initialUserRoleDrafts[accessUser.id] = accessUser.roles.map(
          (assignedRole) => assignedRole.role_code
        );
        initialUserEntityRoleDrafts[accessUser.id] = accessUser.entity_roles || [];
      });
      setUserRoleDrafts(initialUserRoleDrafts);
      setUserEntityRoleDrafts(initialUserEntityRoleDrafts);

      const initialRolePermissionDrafts: Record<number, string[]> = {};
      const initialRoleMetaDrafts: Record<number, RoleMetaDraft> = {};
      fetchedRoles.forEach((roleItem) => {
        initialRolePermissionDrafts[roleItem.id] = roleItem.permissions.map(
          (permission) => permission.permission_key
        );
        initialRoleMetaDrafts[roleItem.id] = {
          role_name: roleItem.role_name,
          description: roleItem.description || '',
          is_admin_role: roleItem.is_admin_role,
        };
      });

      setRolePermissionDrafts(initialRolePermissionDrafts);
      setRoleMetaDrafts(initialRoleMetaDrafts);
    } catch (err: unknown) {
      console.error('Failed to load access control data', err);
      const errorObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setError(
        errorObj.response?.data?.message ||
        errorObj.message ||
        'Failed to load access control data'
      );
    } finally {
      if (showPageLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void fetchAccessControlData('', { showPageLoader: true });
  }, []);

  const toggleCreateRolePermissionSelection = (permissionKey: string) => {
    setSelectedPermissionKeys((previousKeys) => {
      if (previousKeys.includes(permissionKey)) {
        return previousKeys.filter((key) => key !== permissionKey);
      }

      return [...previousKeys, permissionKey];
    });
  };

  const handleCreateRole = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!roleName.trim()) {
      setError('Role name is required.');
      return;
    }

    setRoleCreationLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      await authenticityUtility.post('/access-control/roles', {
        role_name: roleName.trim(),
        role_code: roleCode.trim() || undefined,
        description: roleDescription.trim() || undefined,
        permission_keys: selectedPermissionKeys,
      });

      setRoleName('');
      setRoleCode('');
      setRoleDescription('');
      setSelectedPermissionKeys([]);

      setSuccessMessage('Role created successfully.');
      await fetchAccessControlData(search);
    } catch (err: unknown) {
      console.error('Failed to create role', err);
      const errorObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setError(
        errorObj.response?.data?.message ||
        errorObj.message ||
        'Failed to create role'
      );
    } finally {
      setRoleCreationLoading(false);
    }
  };

  const toggleRolePermissionDraft = (roleId: number, permissionKey: string) => {
    setRolePermissionDrafts((previousDrafts) => {
      const currentRolePermissions = previousDrafts[roleId] || [];

      if (currentRolePermissions.includes(permissionKey)) {
        return {
          ...previousDrafts,
          [roleId]: currentRolePermissions.filter((key) => key !== permissionKey),
        };
      }

      return {
        ...previousDrafts,
        [roleId]: [...currentRolePermissions, permissionKey],
      };
    });
  };

  const handleSaveRolePermissions = async (roleId: number) => {
    setSavingRoleId(roleId);
    setError('');
    setSuccessMessage('');

    try {
      await authenticityUtility.put(`/access-control/roles/${roleId}/permissions`, {
        permission_keys: rolePermissionDrafts[roleId] || [],
      });

      setSuccessMessage('Role permissions updated successfully.');
      await fetchAccessControlData(search);
    } catch (err: unknown) {
      console.error('Failed to update role permissions', err);
      const errorObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setError(
        errorObj.response?.data?.message ||
        errorObj.message ||
        'Failed to update role permissions'
      );
    } finally {
      setSavingRoleId(null);
    }
  };

  const updateRoleMetaDraft = <K extends keyof RoleMetaDraft>(
    roleId: number,
    key: K,
    value: RoleMetaDraft[K]
  ) => {
    setRoleMetaDrafts((previousDrafts) => ({
      ...previousDrafts,
      [roleId]: {
        ...previousDrafts[roleId],
        [key]: value,
      },
    }));
  };

  const handleSaveRoleMeta = async (roleId: number) => {
    const draft = roleMetaDrafts[roleId];

    if (!draft?.role_name?.trim()) {
      setError('Role name cannot be empty.');
      return;
    }

    setSavingRoleMetaId(roleId);
    setError('');
    setSuccessMessage('');

    try {
      await authenticityUtility.put(`/access-control/roles/${roleId}`, {
        role_name: draft.role_name.trim(),
        description: draft.description.trim(),
        is_admin_role: draft.is_admin_role,
      });

      setSuccessMessage('Role details updated successfully.');
      await fetchAccessControlData(search);
    } catch (err: unknown) {
      console.error('Failed to update role', err);
      const errorObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setError(
        errorObj.response?.data?.message ||
        errorObj.message ||
        'Failed to update role'
      );
    } finally {
      setSavingRoleMetaId(null);
    }
  };

  const handleDeleteRoleClick = (role: Role) => {
    setDeleteModalConfig({ show: true, role });
  };

  const executeDeleteRole = async () => {
    const role = deleteModalConfig.role;
    if (!role) return;

    setDeleteModalConfig(prev => ({ ...prev, show: false }));

    setDeletingRoleId(role.id);
    setError('');
    setSuccessMessage('');

    try {
      await authenticityUtility.delete(`/access-control/roles/${role.id}`);
      setSuccessMessage('Role deleted successfully.');
      await fetchAccessControlData(search);
    } catch (err: unknown) {
      console.error('Failed to delete role', err);
      const errorObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setError(
        errorObj.response?.data?.message ||
        errorObj.message ||
        'Failed to delete role'
      );
    } finally {
      setDeletingRoleId(null);
    }
  };

  const toggleUserRoleDraft = (userId: number, roleCodeValue: string) => {
    setUserRoleDrafts((previousDrafts) => {
      const existingDraft = previousDrafts[userId] || [];

      if (existingDraft.includes(roleCodeValue)) {
        return {
          ...previousDrafts,
          [userId]: existingDraft.filter((roleCode) => roleCode !== roleCodeValue),
        };
      }

      return {
        ...previousDrafts,
        [userId]: [...existingDraft, roleCodeValue],
      };
    });
  };

  const addUserEntityRoleDraft = (userId: number, roleCode: string, entityId: number, entityType?: string) => {
    const selectedEntity = masterEntities.find(e => 
      e.entity_id === entityId && (!entityType || e.entity_type === entityType)
    );
    let selectedRole = roles.find(r => r.role_code === roleCode);

    if (!selectedEntity || !selectedRole) return;

    setUserEntityRoleDrafts(prev => {
      const existing = prev[userId] || [];
      // Prevent duplicates of EXACT same (role, entity) pair
      if (existing.some(er => er.role_code === roleCode && er.entity_id === entityId)) {
        return prev;
      }

      return {
        ...prev,
        [userId]: [...existing, {
          entity_id: selectedEntity.entity_id,
          entity_type: selectedEntity.entity_type,
          entity_name: selectedEntity.entity_name,
          role_code: selectedRole!.role_code,
          role_name: selectedRole!.role_name
        }]
      };
    });
  };

  const removeUserEntityRoleDraft = (userId: number, roleCode: string, entityId: number) => {
    setUserEntityRoleDrafts(prev => {
      const existing = prev[userId] || [];
      return {
        ...prev,
        [userId]: existing.filter(er => !(er.entity_id === entityId && er.role_code === roleCode))
      };
    });
  };

  const saveUserRoles = async (userId: number) => {
    setSavingUserId(userId);
    setError('');
    setSuccessMessage('');

    try {
      await authenticityUtility.put(`/access-control/users/${userId}/roles`, {
        role_codes: userRoleDrafts[userId] || [],
        entity_roles: userEntityRoleDrafts[userId] || []
      });

      setSuccessMessage('User roles updated successfully.');
      await fetchAccessControlData(search);
    } catch (err: unknown) {
      console.error('Failed to update user roles', err);
      const errorObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setError(
        errorObj.response?.data?.message ||
        errorObj.message ||
        'Failed to update user roles'
      );
    } finally {
      setSavingUserId(null);
    }
  };

  const runUserSearch = async () => {
    setCurrentPage(1);
    await fetchAccessControlData(search);
  };

  return (
    <>

      <div className="access-control-wrapper">
        <div className="access-control-header">
          <h2>Access Control</h2>
          <p>
            Fully role-based access: create roles, map existing permissions, and assign
            roles to users.
          </p>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}
        {successMessage && <Alert variant="success">{successMessage}</Alert>}

        {loading ? (
          <div className="loading-state">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        ) : (
          <>
            <section className="access-card">
              <h4>Create New Role</h4>
              <Form onSubmit={handleCreateRole}>
                <div className="role-form-grid">
                  <Form.Group>
                    <Form.Label>Role Name *</Form.Label>
                    <Form.Control
                      type="text"
                      value={roleName}
                      onChange={(event) => setRoleName(event.target.value)}
                      placeholder="e.g. Department Reviewer"
                      required
                    />
                  </Form.Group>

                  <Form.Group>
                    <Form.Label>Role Code (optional)</Form.Label>
                    <Form.Control
                      type="text"
                      value={roleCode}
                      onChange={(event) => setRoleCode(event.target.value)}
                      placeholder="e.g. department_reviewer"
                    />
                  </Form.Group>
                </div>

                <Form.Group className="mt-3">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={roleDescription}
                    onChange={(event) => setRoleDescription(event.target.value)}
                    placeholder="Optional description"
                  />
                </Form.Group>

                <div className="permissions-container mt-3">
                  {Object.keys(permissionsByModule)
                    .sort()
                    .map((moduleKey) => (
                      <div key={moduleKey} className="permission-module-block">
                        <h6>{moduleKey.replace(/_/g, ' ')}</h6>
                        <div className="permission-checkbox-group">
                          {permissionsByModule[moduleKey].map((permission) => (
                            <Form.Check
                              key={permission.permission_key}
                              type="checkbox"
                              id={`new-role-${permission.permission_key}`}
                              label={`${permission.action_key.toUpperCase()} (${permission.permission_key})`}
                              checked={selectedPermissionKeys.includes(
                                permission.permission_key
                              )}
                              onChange={() =>
                                toggleCreateRolePermissionSelection(
                                  permission.permission_key
                                )
                              }
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                </div>

                <Button type="submit" className="mt-3" disabled={roleCreationLoading}>
                  {roleCreationLoading ? 'Creating Role...' : 'Create Role'}
                </Button>
              </Form>
            </section>

            <section className="access-card mt-4">
              <div className="role-overview-header">
                <h4>Manage Roles</h4>
              </div>
              <div className="role-badges">
                {roles.map((role) => {
                  const roleMetaDraft = roleMetaDrafts[role.id];
                  const rolePermissionDraft = rolePermissionDrafts[role.id] || [];

                  return (
                    <div key={role.id} className="role-chip role-chip-detailed">
                      <div className="role-chip-title">
                        <span>{role.role_name}</span>
                        {role.is_system ? (
                          <Badge bg="secondary">System</Badge>
                        ) : (
                          <Badge bg="info">Custom</Badge>
                        )}
                      </div>

                      <small>{role.role_code}</small>
                      <small>Assigned Users: {role.assigned_user_count}</small>

                      <Form.Group>
                        <Form.Label>Role Name</Form.Label>
                        <Form.Control
                          type="text"
                          value={roleMetaDraft?.role_name || ''}
                          disabled={role.is_system}
                          onChange={(event) =>
                            updateRoleMetaDraft(role.id, 'role_name', event.target.value)
                          }
                        />
                      </Form.Group>

                      <Form.Group>
                        <Form.Label>Description</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={roleMetaDraft?.description || ''}
                          disabled={role.is_system}
                          onChange={(event) =>
                            updateRoleMetaDraft(role.id, 'description', event.target.value)
                          }
                        />
                      </Form.Group>

                      <Form.Check
                        type="checkbox"
                        label="Counts as Admin role"
                        checked={Boolean(roleMetaDraft?.is_admin_role)}
                        disabled={role.is_system}
                        onChange={(event) =>
                          updateRoleMetaDraft(
                            role.id,
                            'is_admin_role',
                            event.target.checked
                          )
                        }
                      />

                      {!role.is_system && (
                        <div className="role-action-buttons-wrapper mt-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleSaveRoleMeta(role.id)}
                            disabled={savingRoleMetaId === role.id}
                          >
                            {savingRoleMetaId === role.id ? 'Saving...' : 'Save Role Info'}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDeleteRoleClick(role)}
                            disabled={
                              deletingRoleId === role.id || role.assigned_user_count > 0
                            }
                          >
                            {deletingRoleId === role.id ? 'Deleting...' : 'Delete Role'}
                          </Button>
                        </div>
                      )}

                      <div className="permission-checkbox-group role-permission-grid">
                        {permissions.map((permission) => (
                          <Form.Check
                            key={`${role.id}-${permission.permission_key}`}
                            type="checkbox"
                            id={`role-${role.id}-${permission.permission_key}`}
                            label={permission.permission_key}
                            checked={rolePermissionDraft.includes(permission.permission_key)}
                            onChange={() =>
                              toggleRolePermissionDraft(role.id, permission.permission_key)
                            }
                            disabled={role.role_code === 'super_admin'}
                          />
                        ))}
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleSaveRolePermissions(role.id)}
                        disabled={savingRoleId === role.id || role.role_code === 'super_admin'}
                      >
                        {savingRoleId === role.id
                          ? 'Saving...'
                          : role.role_code === 'super_admin'
                            ? 'Locked'
                            : 'Save Role Permissions'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="access-card mt-4">
              <div className="users-header-row">
                <div className="d-flex align-items-center gap-3">
                  <h4 className="mb-0">User Role Assignment</h4>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSyncRolesClick}
                    disabled={syncRolesLoading}
                  >
                    {syncRolesLoading ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Syncing...
                      </>
                    ) : (
                      'Sync Roles'
                    )}
                  </Button>
                </div>
                <div className="search-form">
                  <Form.Control
                    type="text"
                    placeholder="Search by name or email"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void runUserSearch();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline-primary"
                    onClick={() => void runUserSearch()}
                  >
                    Search
                  </Button>
                </div>
              </div>
              <div className="accordion-wrapper mt-3 bg-white border rounded shadow-sm">
                <div className="d-flex align-items-center text-muted fw-bold px-4 py-3 border-bottom bg-light bg-opacity-50" style={{ fontSize: '0.85rem' }}>
                  <div style={{ flex: '0 0 35%' }}>USER</div>
                  <div style={{ flex: '1' }}>ROLE SUMMARY</div>
                  <div style={{ flex: '0 0 150px', textAlign: 'right' }}>ACTIONS</div>
                </div>

                <Accordion activeKey={expandedUser?.toString()} onSelect={(k) => setExpandedUser(k ? Number(k) : null)} flush>
                  {(() => {
                    const indexOfLastUser = currentPage * rowsPerPage;
                    const indexOfFirstUser = indexOfLastUser - rowsPerPage;
                    const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);

                    if (users.length === 0) {
                      return (
                        <div className="text-center p-5 text-muted">
                          No users found for this search.
                        </div>
                      );
                    }

                    return currentUsers.map((accessUser) => {
                      const draftRoleCodes = userRoleDrafts[accessUser.id] || [];
                      const draftEntityRoles = userEntityRoleDrafts[accessUser.id] || [];
                      const allRoles = [
                        ...accessUser.roles.map(r => ({ ...r, type: 'global' })),
                        ...(accessUser.entity_roles || []).map(r => ({ ...r, type: 'context' }))
                      ].filter((r) => String(r.role_code || '').toLowerCase() !== 'user');
                      const visibleRoles = allRoles.slice(0, 2);
                      const remainingCount = allRoles.length - 2;

                      return (
                        <Accordion.Item eventKey={accessUser.id.toString()} key={accessUser.id} className="border-bottom-0 border-top">
                          <Accordion.Header className="user-accordion-header">
                            <div className="d-flex align-items-center w-100 pe-3">
                              <div className="me-3 text-secondary d-flex align-items-center" style={{ width: '20px' }}>
                                {expandedUser === accessUser.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </div>
                              <div style={{ flex: '0 0 34%' }} className="d-flex flex-column">
                                <strong className="text-dark">{accessUser.name || 'Unnamed User'}</strong>
                                <span className="text-muted small">{accessUser.email}, ID: {accessUser.id}</span>
                              </div>
                              <div style={{ flex: '1' }} className="d-flex align-items-center gap-2">
                                {visibleRoles.map((r, i) => (
                                  <span key={i} className={getRoleBadgeClassName(r.role_code)}>
                                    {r.role_code === 'hod' ? 'Head of Department' : r.role_code === 'coordinator' ? 'Coordinator' : r.role_name}
                                    {r.type === 'context' && (r as any).entity_name && (
                                      <span className="ms-1 opacity-75" style={{ fontSize: '0.9em' }}>
                                        : {(r as any).entity_name}
                                      </span>
                                    )}
                                  </span>
                                ))}
                                {remainingCount > 0 && (
                                  <span className="assigned-role-tag assigned-role-tag-default">
                                    +{remainingCount} more
                                  </span>
                                )}
                                {allRoles.length === 0 && (
                                  <span className="assigned-role-tag assigned-role-tag-empty">No roles assigned</span>
                                )}
                              </div>
                              <div style={{ flex: '0 0 150px', textAlign: 'right' }}>
                                <Button
                                  variant="light"
                                  size="sm"
                                  className="rounded-pill px-3 border shadow-sm fw-medium d-flex align-items-center ms-auto gap-1 bg-white"
                                  style={{ color: '#6c757d', borderColor: '#dee2e6' }}
                                >
                                  <Edit2 size={13} style={{ strokeWidth: 3 }} className="text-muted" /> Edit Roles
                                </Button>
                              </div>
                            </div>
                          </Accordion.Header>
                          <Accordion.Body className="bg-light bg-opacity-50 border-top p-4">
                            <div className="row g-4 mb-4">
                              {/* Global Roles Column */}
                              <div className="col-md-5">
                                <h6 className="fw-bold mb-3 fontSize-sm text-dark">GLOBAL ROLES</h6>
                                <div className="d-flex gap-4 flex-wrap">
                                  {roles
                                    .filter(r => r.is_admin_role && !['hod', 'coordinator'].includes(r.role_code))
                                    .map((role) => (
                                      <Form.Check
                                        key={`${accessUser.id}-${role.role_code}`}
                                        type="checkbox"
                                        id={`user-role-${accessUser.id}-${role.role_code}`}
                                        label={role.role_name}
                                        checked={draftRoleCodes.includes(role.role_code)}
                                        onChange={() => toggleUserRoleDraft(accessUser.id, role.role_code)}
                                        className="mb-0 custom-checkbox"
                                      />
                                    ))}
                                </div>
                              </div>

                              {/* Context Roles Column */}
                              <div className="col-md-7">
                                {/* <h6 className="fw-bold mb-3 fontSize-sm text-dark">CONTEXT ROLES (ENTITY-BASED)</h6> */}
                                <div className="row g-2">
                                  <div className="col-md-6">
                                    <label className="text-secondary small fw-medium mb-1">HOD (Department)</label>
                                    <Select
                                      classNamePrefix="react-select"
                                      options={hodOptions}
                                      value={null}
                                      onChange={(selectedOption: any) => {
                                        if (selectedOption) {
                                          addUserEntityRoleDraft(accessUser.id, 'hod', selectedOption.value, selectedOption.type);
                                        }
                                      }}
                                      placeholder="Select Department..."
                                      isClearable
                                      onMenuOpen={() => { }}
                                      menuPortalTarget={document.body}
                                      styles={{
                                        menuPortal: base => ({ ...base, zIndex: 9999 }),
                                        control: base => ({ ...base, minHeight: '38px', borderRadius: '8px' })
                                      }}
                                    />
                                  </div>
                                  <div className="col-md-6">
                                    <label className="text-secondary small fw-medium mb-1">Coordinator (Club/Other)</label>
                                    <Select
                                      classNamePrefix="react-select"
                                      options={coordinatorOptions}
                                      components={{
                                        GroupHeading: CollapsibleGroupHeading,
                                        Group: CollapsibleGroup
                                      }}
                                      value={null}
                                      onChange={(selectedOption: any) => {
                                        if (selectedOption) {
                                          addUserEntityRoleDraft(accessUser.id, 'coordinator', selectedOption.value, selectedOption.type);
                                        }
                                      }}
                                      placeholder="Select Entity..."
                                      isClearable
                                      menuPortalTarget={document.body}
                                      styles={{
                                        menuPortal: base => ({ ...base, zIndex: 9999 }),
                                        control: base => ({ ...base, minHeight: '38px', borderRadius: '8px' })
                                      }}
                                    />
                                  </div>

                                  {/* Assigned Entity Roles Pills */}
                                  {draftEntityRoles.length > 0 && (
                                    <div className="mt-3 d-flex flex-wrap gap-2">
                                      {draftEntityRoles.map((er, idx) => (
                                        <div
                                          key={`${accessUser.id}-${er.role_code}-${er.entity_id}-${idx}`}
                                          className="d-inline-flex align-items-center bg-light text-dark rounded-pill px-3 py-1 mb-1 border shadow-sm"
                                          style={{ fontSize: '11px', fontWeight: 500 }}
                                        >
                                          <span className="fw-bold text-muted me-2" style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '10px' }}>
                                            {er.role_name}:
                                          </span>
                                          <span className="me-2">{er.entity_name}</span>
                                          <button
                                            className="btn btn-link p-0 text-dark opacity-50 d-flex align-items-center justify-content-center hover-opacity-100"
                                            onClick={() => removeUserEntityRoleDraft(accessUser.id, er.role_code, er.entity_id)}
                                            title="Remove assignment"
                                            style={{ textDecoration: 'none', transition: 'opacity 0.2s' }}
                                          >
                                            <X size={12} strokeWidth={3} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Action Footer */}
                            <div className="d-flex justify-content-end gap-2 pt-3 border-top bg-white px-4 py-3 mx-n4 mb-n4 rounded-bottom" style={{ borderBottomLeftRadius: 'var(--bs-border-radius)', borderBottomRightRadius: 'var(--bs-border-radius)' }}>
                              <Button
                                variant="primary"
                                size="sm"
                                className="px-4 shadow-sm fw-medium"
                                onClick={() => {
                                  showAlert(
                                    `Are you sure you want to save the role assignments for ${accessUser.name}?`,
                                    'info',
                                    'Confirm Save',
                                    true,
                                    'Save',
                                    async () => {
                                      closeAlert();
                                      await saveUserRoles(accessUser.id);
                                      setExpandedUser(null);
                                    }
                                  );
                                }}
                                disabled={savingUserId === accessUser.id}
                              >
                                {savingUserId === accessUser.id ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                variant="light"
                                size="sm"
                                className="px-4 border shadow-sm fw-medium text-secondary"
                                onClick={() => setExpandedUser(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </Accordion.Body>
                        </Accordion.Item>
                      );
                    })
                  })()}
                </Accordion>

                {users.length > 0 && (
                  <div className="d-flex justify-content-end align-items-center py-3 px-4 bg-white border-top rounded-bottom">
                    <div className="d-flex align-items-center gap-4">
                      <div className="d-flex align-items-center gap-2">
                        <span className="text-secondary small fw-medium">Rows per page:</span>
                        <Form.Select
                          size="sm"
                          className="border rounded shadow-sm d-inline-block w-auto"
                          style={{ minWidth: '70px', padding: '0.25rem 2.25rem 0.25rem 0.75rem', fontSize: '0.85rem' }}
                          value={rowsPerPage}
                          onChange={e => {
                            setRowsPerPage(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </Form.Select>
                      </div>

                      <span className="text-secondary small fw-medium">
                        {(currentPage - 1) * rowsPerPage + 1}-{Math.min(currentPage * rowsPerPage, users.length)} of {users.length}
                      </span>

                      <div className="d-flex align-items-center gap-1 ms-2">
                        <Button
                          variant="light"
                          size="sm"
                          className="d-flex align-items-center gap-1 text-secondary border-0 bg-transparent fw-medium pagination-nav-btn"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        >
                          <ChevronLeft size={16} /> Previous
                        </Button>

                        <div className="d-flex align-items-center gap-1">
                          {Array.from({ length: Math.ceil(users.length / rowsPerPage) }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === Math.ceil(users.length / rowsPerPage) || Math.abs(p - currentPage) <= 1)
                            .map((p, idx, arr) => (
                              <React.Fragment key={p}>
                                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-muted px-1">...</span>}
                                <Button
                                  variant={currentPage === p ? 'primary' : 'light'}
                                  size="sm"
                                  className={`rounded fw-medium ${currentPage === p ? 'shadow-sm px-3' : 'border-0 bg-transparent text-secondary'}`}
                                  style={{ minWidth: '32px' }}
                                  onClick={() => setCurrentPage(p)}
                                >
                                  {p}
                                </Button>
                              </React.Fragment>
                            ))}
                        </div>

                        <Button
                          variant="light"
                          size="sm"
                          className="d-flex align-items-center gap-1 text-secondary border-0 bg-transparent fw-medium pagination-nav-btn"
                          disabled={currentPage === Math.ceil(users.length / rowsPerPage) || Math.ceil(users.length / rowsPerPage) === 0}
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(users.length / rowsPerPage)))}
                        >
                          Next <ChevronRight size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

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

      <DeleteConfirmationModal
        show={deleteModalConfig.show}
        onHide={() => setDeleteModalConfig(prev => ({ ...prev, show: false }))}
        onConfirm={executeDeleteRole}
        itemName={deleteModalConfig.role?.role_name}
        isDeleting={deletingRoleId !== null}
        title="Confirm Role Deletion"
      />
    </>
  );
};

export default AccessControlPage;
