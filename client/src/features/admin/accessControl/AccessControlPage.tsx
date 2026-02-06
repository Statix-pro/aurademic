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
}

interface RolePermission {
  permission_key: string;
  module_key: string;
  action_key: string;
  description?: string;
}

interface Role {
  id: number;
  role_code: string;
  role_name: string;
  description?: string;
  is_system: boolean;
  is_admin_role: boolean;
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

const AccessControlPage: React.FC = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [userRoleDrafts, setUserRoleDrafts] = useState<Record<number, string[]>>({});

  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
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
      if (!grouped[permission.module_key]) {
        grouped[permission.module_key] = [];
      }

      grouped[permission.module_key].push(permission);
    });

    return grouped;
  }, [permissions]);

  const fetchAccessControlData = async (searchValue = '') => {
    setLoading(true);
    setError('');

    try {
      const [permissionResponse, roleResponse, userResponse] = await Promise.all([
        authenticityUtility.get('/access-control/permissions') as Promise<ApiCollectionResponse<Permission>>,
        authenticityUtility.get('/access-control/roles') as Promise<ApiCollectionResponse<Role>>,
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

      const initialDrafts: Record<number, string[]> = {};
      fetchedUsers.forEach((accessUser) => {
        initialDrafts[accessUser.id] = accessUser.roles.map((role) => role.role_code);
      });
      setUserRoleDrafts(initialDrafts);
    } catch (err: unknown) {
      console.error('Failed to load access control data', err);
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
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

  const toggleRolePermissionSelection = (permissionKey: string) => {
    setSelectedPermissionKeys((prevPermissions) => {
      if (prevPermissions.includes(permissionKey)) {
        return prevPermissions.filter((key) => key !== permissionKey);
      }

      return [...prevPermissions, permissionKey];
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
      console.error('Role creation failed', err);
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setError(
        errorObj.response?.data?.message ||
          errorObj.message ||
          'Failed to create role'
      );
    } finally {
      setRoleCreationLoading(false);
    }
  };

  const toggleUserRoleDraft = (userId: number, roleCodeValue: string) => {
    setUserRoleDrafts((prevDrafts) => {
      const existingDraft = prevDrafts[userId] || [];

      if (existingDraft.includes(roleCodeValue)) {
        return {
          ...prevDrafts,
          [userId]: existingDraft.filter((code) => code !== roleCodeValue),
        };
      }

      return {
        ...prevDrafts,
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
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
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
      users.filter((currentRowUser) => currentRowUser.is_super_admin).length <= 1
    ) {
      setError('Cannot remove Super Admin from your account while you are the only Super Admin.');
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
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
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
          <p>Super Admin can create roles and assign role-based access to admins.</p>
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
                              id={`permission-${permission.permission_key}`}
                              label={`${permission.action_key.toUpperCase()} (${permission.permission_key})`}
                              checked={selectedPermissionKeys.includes(
                                permission.permission_key
                              )}
                              onChange={() =>
                                toggleRolePermissionSelection(permission.permission_key)
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
                <h4>Available Roles</h4>
              </div>
              <div className="role-badges">
                {roles.map((role) => (
                  <div key={role.id} className="role-chip">
                    <div className="role-chip-title">
                      <span>{role.role_name}</span>
                      {role.is_system && <Badge bg="secondary">System</Badge>}
                    </div>
                    <small>{role.role_code}</small>
                    <p>
                      {(role.description || 'No description')}
                    </p>
                    <small>
                      Permissions: {role.permissions.map((permission) => permission.permission_key).join(', ') || 'None'}
                    </small>
                  </div>
                ))}
              </div>
            </section>

            <section className="access-card mt-4">
              <div className="users-header-row">
                <h4>User Access Assignment</h4>
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
                    <th>Assigned Roles</th>
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
                                id={`role-${accessUser.id}-${role.role_code}`}
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
                            variant={accessUser.is_super_admin ? 'danger' : 'outline-success'}
                            onClick={() => toggleSuperAdmin(accessUser)}
                            disabled={savingUserId === accessUser.id}
                          >
                            {accessUser.is_super_admin ? 'Remove Super Admin' : 'Make Super Admin'}
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
