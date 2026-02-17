import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Form, Spinner, Table } from 'react-bootstrap';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import Navbar from '../../../shared/components/layout/navbar/navbar';
import { useAuth } from '../../../contexts/AuthContext';
import './AccessControlPage.css';

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

interface AccessUser {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  is_super_admin: boolean;
  roles: UserRole[];
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

const AccessControlPage: React.FC = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<AccessUser[]>([]);

  const [userRoleDrafts, setUserRoleDrafts] = useState<Record<number, string[]>>({});
  const [rolePermissionDrafts, setRolePermissionDrafts] = useState<Record<number, string[]>>({});
  const [roleMetaDrafts, setRoleMetaDrafts] = useState<Record<number, RoleMetaDraft>>({});

  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);
  const [savingRoleMetaId, setSavingRoleMetaId] = useState<number | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);

  const [roleCreationLoading, setRoleCreationLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [roleName, setRoleName] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<string[]>([]);

  const currentUserId = Number(user?.id);

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

  const fetchAccessControlData = async (searchValue = '') => {
    setLoading(true);
    setError('');

    try {
      const [permissionResponse, roleResponse, userResponse] = await Promise.all([
        authenticityUtility.get('/access-control/permissions') as Promise<
          ApiCollectionResponse<Permission>
        >,
        authenticityUtility.get('/access-control/roles') as Promise<
          ApiCollectionResponse<Role>
        >,
        authenticityUtility.get('/access-control/users', {
          params: { search: searchValue.trim() },
        }) as Promise<ApiCollectionResponse<AccessUser>>,
      ]);

      const fetchedPermissions = Array.isArray(permissionResponse.data)
        ? permissionResponse.data
        : [];
      const fetchedRoles = Array.isArray(roleResponse.data) ? roleResponse.data : [];
      const fetchedUsers = Array.isArray(userResponse.data) ? userResponse.data : [];

      setPermissions(fetchedPermissions);
      setRoles(fetchedRoles);
      setUsers(fetchedUsers);

      const initialUserRoleDrafts: Record<number, string[]> = {};
      fetchedUsers.forEach((accessUser) => {
        initialUserRoleDrafts[accessUser.id] = accessUser.roles.map(
          (assignedRole) => assignedRole.role_code
        );
      });
      setUserRoleDrafts(initialUserRoleDrafts);

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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccessControlData();
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

  const handleDeleteRole = async (role: Role) => {
    if (!window.confirm(`Delete role ${role.role_name}?`)) {
      return;
    }

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

  const saveUserRoles = async (userId: number) => {
    setSavingUserId(userId);
    setError('');
    setSuccessMessage('');

    try {
      await authenticityUtility.put(`/access-control/users/${userId}/roles`, {
        role_codes: userRoleDrafts[userId] || [],
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

  const toggleSuperAdmin = async (targetUser: AccessUser) => {
    if (
      targetUser.id === currentUserId &&
      targetUser.is_super_admin &&
      users.filter((rowUser) => rowUser.is_super_admin).length <= 1
    ) {
      setError(
        'Cannot remove Super Admin from your account while you are the only Super Admin.'
      );
      return;
    }

    setSavingUserId(targetUser.id);
    setError('');
    setSuccessMessage('');

    try {
      await authenticityUtility.put(
        `/access-control/users/${targetUser.id}/super-admin`,
        {
          enabled: !targetUser.is_super_admin,
        }
      );

      setSuccessMessage('Super Admin access updated successfully.');
      await fetchAccessControlData(search);
    } catch (err: unknown) {
      console.error('Failed to update super admin access', err);
      const errorObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setError(
        errorObj.response?.data?.message ||
        errorObj.message ||
        'Failed to update Super Admin access'
      );
    } finally {
      setSavingUserId(null);
    }
  };

  const handleSearchSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await fetchAccessControlData(search);
  };

  return (
    <>
      <Navbar />
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
                            onClick={() => handleDeleteRole(role)}
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
                <h4>User Role Assignment</h4>
                <Form onSubmit={handleSearchSubmit} className="search-form">
                  <Form.Control
                    type="text"
                    placeholder="Search by name or email"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <Button type="submit" variant="outline-primary">
                    Search
                  </Button>
                </Form>
              </div>

              <Table bordered hover responsive className="mt-3">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Roles (multiple allowed)</th>
                    <th>Admin Access</th>
                    <th>Super Admin</th>
                    <th>Save Roles</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((accessUser) => {
                    const draftRoleCodes = userRoleDrafts[accessUser.id] || [];

                    return (
                      <tr key={accessUser.id}>
                        <td>
                          <div className="user-cell">
                            <strong>{accessUser.name || 'Unnamed User'}</strong>
                            <span>{accessUser.email}</span>
                            <small>ID: {accessUser.id}</small>
                          </div>
                        </td>

                        <td>
                          <div className="role-checkboxes">
                            {roles.map((role) => (
                              <Form.Check
                                key={`${accessUser.id}-${role.role_code}`}
                                type="checkbox"
                                id={`user-role-${accessUser.id}-${role.role_code}`}
                                label={role.role_name}
                                checked={draftRoleCodes.includes(role.role_code)}
                                onChange={() =>
                                  toggleUserRoleDraft(accessUser.id, role.role_code)
                                }
                              />
                            ))}
                          </div>
                        </td>

                        <td>
                          {accessUser.is_admin ? (
                            <Badge bg="success">Admin</Badge>
                          ) : (
                            <Badge bg="secondary">User</Badge>
                          )}
                        </td>

                        <td>
                          <Button
                            size="sm"
                            variant={
                              accessUser.is_super_admin ? 'danger' : 'outline-success'
                            }
                            onClick={() => toggleSuperAdmin(accessUser)}
                            disabled={savingUserId === accessUser.id}
                          >
                            {accessUser.is_super_admin
                              ? 'Remove Super Admin'
                              : 'Make Super Admin'}
                          </Button>
                        </td>

                        <td>
                          <Button
                            size="sm"
                            onClick={() => saveUserRoles(accessUser.id)}
                            disabled={savingUserId === accessUser.id}
                          >
                            {savingUserId === accessUser.id ? 'Saving...' : 'Save'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}

                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center">
                        No users found for this search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </section>
          </>
        )}
      </div>
    </>
  );
};

export default AccessControlPage;
