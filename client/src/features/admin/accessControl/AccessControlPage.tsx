import { Check, ChevronLeft, ChevronRight, Eye, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Form, Spinner, Table } from 'react-bootstrap';

import { useAuth } from '../../../contexts/AuthContext';
import AlertModal, { AlertType } from '../../../shared/components/ui/AlertModal';
import CustomButton from '../../../shared/components/ui/CustomButton';
import CustomCheckbox from '../../../shared/components/ui/CustomCheckbox';
import CustomDropdown, { OptionType } from '../../../shared/components/ui/CustomDropdown';
import CustomInput from '../../../shared/components/ui/CustomInput';
import CustomModal from '../../../shared/components/ui/CustomModal';
import CustomToggle from '../../../shared/components/ui/CustomToggle';
import DeleteConfirmationModal from '../../../shared/components/ui/DeleteConfirmationModal';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { isSuperAdmin } from '../../../shared/utils/permissionUtils';
import { AdminIconButton, AdminScreenHeader, AdminTabs } from '../components/AdminScreen';

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

interface EntityOption extends OptionType {
  type: string;
}

type TabKey = 'users' | 'roles';

// Roles held per department or club are assigned through the two pickers, and every signed-in
// user holds `user` implicitly — none of them is a checkbox.
const NON_GLOBAL_ROLE_CODES = ['user', 'hod', 'coordinator'];

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50];

// How long typing must pause before the users list is searched.
const SEARCH_DEBOUNCE_MS = 300;

// Role filter value for people who hold nothing beyond the base role. Not a role_code, so it
// cannot collide with one.
const NO_ROLES_FILTER = '__none__';

const getPermissionGroupKey = (permission: { permission_key: string; module_key: string }) => {
  if (permission.permission_key?.startsWith('budget.')) {
    return 'budget';
  }

  return permission.module_key;
};

const formatModuleLabel = (moduleKey: string): string => {
  const words = moduleKey.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const getRoleTagClassName = (roleCode: string): string => {
  const code = roleCode?.toLowerCase();
  const variant = ['super_admin', 'admin', 'hod', 'coordinator'].includes(code)
    ? code.replace('_', '-')
    : 'default';

  return `admin-badge ac-role-tag ac-role-tag--${variant}`;
};

// Order-insensitive, so ticking a box and unticking it again counts as no change.
const sameKeys = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((key) => b.includes(key));

const getErrorMessage = (err: unknown, fallback: string): string => {
  const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
  return errorObj.response?.data?.message || errorObj.message || fallback;
};

interface PermissionPickerProps {
  groups: [string, Permission[]][];
  selectedKeys: string[];
  idPrefix: string;
  onToggle: (permissionKey: string) => void;
  onToggleGroup: (permissionKeys: string[], select: boolean) => void;
}

/** Every permission as a checkbox, grouped by module, with select-all per module. */
const PermissionPicker: React.FC<PermissionPickerProps> = ({
  groups,
  selectedKeys,
  idPrefix,
  onToggle,
  onToggleGroup,
}) => (
  <div className="ac-permission-groups">
    {groups.map(([moduleKey, modulePermissions]) => {
      const keys = modulePermissions.map((permission) => permission.permission_key);
      const selectedCount = keys.filter((key) => selectedKeys.includes(key)).length;
      const allSelected = selectedCount === keys.length;

      return (
        <div key={moduleKey} className="ac-permission-group">
          <div className="ac-permission-group__header">
            <span className="ac-permission-group__title">{formatModuleLabel(moduleKey)}</span>
            <button
              type="button"
              className="ac-link-btn"
              onClick={() => onToggleGroup(keys, !allSelected)}
            >
              {allSelected ? 'Clear' : 'Select all'}
            </button>
          </div>
          {modulePermissions.map((permission) => (
            <div key={permission.permission_key} className="ac-permission-option">
              <CustomCheckbox
                id={`${idPrefix}-${permission.permission_key}`}
                name={`${idPrefix}-${permission.permission_key}`}
                label={permission.description || permission.action_key}
                checked={selectedKeys.includes(permission.permission_key)}
                onChange={() => onToggle(permission.permission_key)}
              />
              <span className="ac-permission-key">{permission.permission_key}</span>
            </div>
          ))}
        </div>
      );
    })}
  </div>
);

const AccessControlPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  // Mirrors the server (accessControlRoutes / updateUserRoles): below Super Admin you assign
  // existing roles to other people, but you do not define roles, grant Super Admin, or edit your
  // own access. The server enforces it; this only keeps the screen from offering what will 403.
  const viewerIsSuperAdmin = isSuperAdmin(currentUser);
  const isCurrentUser = (userId: number) => Number(currentUser?.id) === userId;
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<AccessUser[]>([]);

  const [userRoleDrafts, setUserRoleDrafts] = useState<Record<number, string[]>>({});
  const [userEntityRoleDrafts, setUserEntityRoleDrafts] = useState<Record<number, EntityRole[]>>(
    {},
  );
  const [rolePermissionDrafts, setRolePermissionDrafts] = useState<Record<number, string[]>>({});
  const [roleMetaDrafts, setRoleMetaDrafts] = useState<Record<number, RoleMetaDraft>>({});

  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);
  const [savingRoleMetaId, setSavingRoleMetaId] = useState<number | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('users');
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [viewingRoleId, setViewingRoleId] = useState<number | null>(null);
  // Role permissions open read-only; changing them is a deliberate second step.
  const [editingRolePermissions, setEditingRolePermissions] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const [roleCreationLoading, setRoleCreationLoading] = useState(false);
  const [syncRolesLoading, setSyncRolesLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
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

  const [deleteModalConfig, setDeleteModalConfig] = useState<{
    show: boolean;
    role: Role | null;
  }>({
    show: false,
    role: null,
  });

  const [roleName, setRoleName] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<string[]>([]);

  // System Entity references for manual binding
  const [masterEntities, setMasterEntities] = useState<any[]>([]);

  const hodOptions = useMemo<EntityOption[]>(() => {
    return masterEntities
      .filter((e) => e.entity_type === 'DEPARTMENT')
      .map((e) => ({ label: e.entity_name, value: e.entity_id, type: 'DEPARTMENT' }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [masterEntities]);

  const coordinatorOptions = useMemo(() => {
    const nonDepts = masterEntities.filter((e) => e.entity_type !== 'DEPARTMENT');
    const groups: Record<string, EntityOption[]> = {};

    nonDepts.forEach((e) => {
      const type = e.entity_type || 'OTHER';
      if (!groups[type]) groups[type] = [];
      groups[type].push({ label: e.entity_name, value: e.entity_id, type: e.entity_type });
    });

    return Object.keys(groups)
      .sort()
      .map((type) => ({
        label: type,
        options: groups[type].sort((a, b) => a.label.localeCompare(b.label)),
      }));
  }, [masterEntities]);

  const permissionGroups = useMemo(() => {
    const grouped: Record<string, Permission[]> = {};

    permissions.forEach((permission) => {
      const groupKey = getPermissionGroupKey(permission);

      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }

      grouped[groupKey].push(permission);
    });

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  // Every role a person holds institution-wide. Not filtered on is_admin_role: Directory Admin is
  // deliberately not an admin role (it would open all of /api/admin) yet is still assigned here.
  const globalRoles = useMemo(
    () => roles.filter((role) => !NON_GLOBAL_ROLE_CODES.includes(role.role_code)),
    [roles],
  );

  const applyUsers = (fetchedUsers: AccessUser[]) => {
    const initialUserRoleDrafts: Record<number, string[]> = {};
    const initialUserEntityRoleDrafts: Record<number, EntityRole[]> = {};

    fetchedUsers.forEach((accessUser) => {
      initialUserRoleDrafts[accessUser.id] = accessUser.roles.map(
        (assignedRole) => assignedRole.role_code,
      );
      initialUserEntityRoleDrafts[accessUser.id] = accessUser.entity_roles || [];
    });

    setUsers(fetchedUsers);
    setUserRoleDrafts(initialUserRoleDrafts);
    setUserEntityRoleDrafts(initialUserEntityRoleDrafts);
  };

  const fetchAccessControlData = async (
    searchValue = '',
    options: { showPageLoader?: boolean } = {},
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
        authenticityUtility.get('/access-control/roles') as Promise<ApiCollectionResponse<Role>>,
        authenticityUtility.get('/access-control/users', {
          params: { search: searchValue.trim() },
        }) as Promise<ApiCollectionResponse<AccessUser>>,
        // Need lists of all entities to map against
        authenticityUtility
          .get('/adminbudget/org-units')
          .catch(() => ({ data: { data: { all: [] } } })),
      ]);

      const fetchedPermissions = Array.isArray(permissionResponse.data)
        ? permissionResponse.data
        : [];
      const fetchedRoles = Array.isArray(roleResponse.data) ? roleResponse.data : [];
      const fetchedUsers = Array.isArray(userResponse.data) ? userResponse.data : [];

      setPermissions(fetchedPermissions);
      setRoles(fetchedRoles);
      applyUsers(fetchedUsers);

      const rawOrgUnits =
        (orgUnitsResponse as any)?.data?.data?.all || (orgUnitsResponse as any)?.data?.all || [];

      const combinedEntities = rawOrgUnits.map((e: any) => ({
        entity_id: e.id,
        entity_name: e.name,
        entity_type: e.type_code,
      }));
      setMasterEntities(combinedEntities);

      const initialRolePermissionDrafts: Record<number, string[]> = {};
      const initialRoleMetaDrafts: Record<number, RoleMetaDraft> = {};
      fetchedRoles.forEach((roleItem) => {
        initialRolePermissionDrafts[roleItem.id] = roleItem.permissions.map(
          (permission) => permission.permission_key,
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
      setError(getErrorMessage(err, 'Failed to load access control data'));
    } finally {
      if (showPageLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void fetchAccessControlData('', { showPageLoader: true });
  }, []);

  // Search as you type. Only the users list is refetched — roles, permissions and org units do
  // not change with the query — and only once typing pauses. Each request is numbered so a slow
  // answer to an older query cannot replace the list for a newer one.
  const searchRequestRef = useRef(0);
  const lastSearchRef = useRef('');

  useEffect(() => {
    const query = search.trim();
    if (query === lastSearchRef.current) return undefined;

    const timer = window.setTimeout(async () => {
      lastSearchRef.current = query;
      const requestId = ++searchRequestRef.current;
      // A failed search's message would otherwise stay up over the next search's results.
      setError('');

      try {
        const response = (await authenticityUtility.get('/access-control/users', {
          params: { search: query },
        })) as ApiCollectionResponse<AccessUser>;

        if (requestId !== searchRequestRef.current) return;
        applyUsers(Array.isArray(response.data) ? response.data : []);
        setCurrentPage(1);
      } catch (err: unknown) {
        if (requestId !== searchRequestRef.current) return;
        console.error('Failed to search users', err);
        setError(getErrorMessage(err, 'Failed to search users'));
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [search]);

  // A confirmation has done its job once read; left up, it pushed the tabs down indefinitely.
  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = window.setTimeout(() => setSuccessMessage(''), 4000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

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
      },
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
      setError(getErrorMessage(err, 'Failed to sync roles'));
    } finally {
      setSyncRolesLoading(false);
    }
  };

  const toggleKey = (keys: string[], key: string) =>
    keys.includes(key) ? keys.filter((existing) => existing !== key) : [...keys, key];

  const toggleKeyGroup = (keys: string[], groupKeys: string[], select: boolean) =>
    select
      ? Array.from(new Set([...keys, ...groupKeys]))
      : keys.filter((key) => !groupKeys.includes(key));

  const resetCreateRoleForm = () => {
    setRoleName('');
    setRoleCode('');
    setRoleDescription('');
    setSelectedPermissionKeys([]);
  };

  const closeCreateRole = () => {
    setShowCreateRole(false);
    setError('');
    resetCreateRoleForm();
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

      resetCreateRoleForm();
      setShowCreateRole(false);
      setSuccessMessage('Role created successfully.');
      await fetchAccessControlData(search);
    } catch (err: unknown) {
      console.error('Failed to create role', err);
      setError(getErrorMessage(err, 'Failed to create role'));
    } finally {
      setRoleCreationLoading(false);
    }
  };

  const viewingRole = roles.find((role) => role.id === viewingRoleId) || null;

  const resetRoleDrafts = (role: Role) => {
    setRolePermissionDrafts((prev) => ({
      ...prev,
      [role.id]: role.permissions.map((permission) => permission.permission_key),
    }));
    setRoleMetaDrafts((prev) => ({
      ...prev,
      [role.id]: {
        role_name: role.role_name,
        description: role.description || '',
        is_admin_role: role.is_admin_role,
      },
    }));
  };

  const openRole = (role: Role) => {
    setError('');
    resetRoleDrafts(role);
    setEditingRolePermissions(false);
    setViewingRoleId(role.id);
  };

  const closeRole = () => {
    if (viewingRole) resetRoleDrafts(viewingRole);
    setError('');
    setEditingRolePermissions(false);
    setViewingRoleId(null);
  };

  const cancelRolePermissionEdit = () => {
    if (viewingRole) {
      setRolePermissionDrafts((prev) => ({
        ...prev,
        [viewingRole.id]: viewingRole.permissions.map((permission) => permission.permission_key),
      }));
    }
    setError('');
    setEditingRolePermissions(false);
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
      setEditingRolePermissions(false);
      await fetchAccessControlData(search);
    } catch (err: unknown) {
      console.error('Failed to update role permissions', err);
      setError(getErrorMessage(err, 'Failed to update role permissions'));
    } finally {
      setSavingRoleId(null);
    }
  };

  const confirmSaveRolePermissions = (role: Role) => {
    const draftCount = (rolePermissionDrafts[role.id] || []).length;
    const holders = role.assigned_user_count;
    const impact =
      holders === 0
        ? 'No one holds this role yet.'
        : `This changes access for the ${holders} user${holders === 1 ? '' : 's'} who hold it.`;

    showAlert(
      `Save ${draftCount} permission${draftCount === 1 ? '' : 's'} for ${role.role_name}? ${impact}`,
      'warning',
      'Change role permissions',
      true,
      'Save',
      () => {
        closeAlert();
        void handleSaveRolePermissions(role.id);
      },
    );
  };

  const updateRoleMetaDraft = <K extends keyof RoleMetaDraft>(
    roleId: number,
    key: K,
    value: RoleMetaDraft[K],
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
      setError(getErrorMessage(err, 'Failed to update role'));
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

    setDeleteModalConfig((prev) => ({ ...prev, show: false }));

    setDeletingRoleId(role.id);
    setError('');
    setSuccessMessage('');

    try {
      await authenticityUtility.delete(`/access-control/roles/${role.id}`);
      if (viewingRoleId === role.id) setViewingRoleId(null);
      setSuccessMessage('Role deleted successfully.');
      await fetchAccessControlData(search);
    } catch (err: unknown) {
      console.error('Failed to delete role', err);
      setError(getErrorMessage(err, 'Failed to delete role'));
    } finally {
      setDeletingRoleId(null);
    }
  };

  const editingUser = users.find((accessUser) => accessUser.id === editingUserId) || null;

  const resetUserDrafts = (accessUser: AccessUser) => {
    setUserRoleDrafts((prev) => ({
      ...prev,
      [accessUser.id]: accessUser.roles.map((assignedRole) => assignedRole.role_code),
    }));
    setUserEntityRoleDrafts((prev) => ({
      ...prev,
      [accessUser.id]: accessUser.entity_roles || [],
    }));
  };

  const openUser = (accessUser: AccessUser) => {
    setError('');
    resetUserDrafts(accessUser);
    setEditingUserId(accessUser.id);
  };

  // Cancelling drops the unsaved ticks, so reopening the user shows what is actually stored.
  const closeUser = () => {
    if (editingUser) resetUserDrafts(editingUser);
    setError('');
    setEditingUserId(null);
  };

  const toggleUserRoleDraft = (userId: number, roleCodeValue: string) => {
    setUserRoleDrafts((previousDrafts) => ({
      ...previousDrafts,
      [userId]: toggleKey(previousDrafts[userId] || [], roleCodeValue),
    }));
  };

  const addUserEntityRoleDraft = (
    userId: number,
    roleCode: string,
    entityId: number,
    entityType?: string,
  ) => {
    const selectedEntity = masterEntities.find(
      (e) => e.entity_id === entityId && (!entityType || e.entity_type === entityType),
    );
    const selectedRole = roles.find((r) => r.role_code === roleCode);

    if (!selectedEntity || !selectedRole) return;

    setUserEntityRoleDrafts((prev) => {
      const existing = prev[userId] || [];
      // Prevent duplicates of EXACT same (role, entity) pair
      if (existing.some((er) => er.role_code === roleCode && er.entity_id === entityId)) {
        return prev;
      }

      return {
        ...prev,
        [userId]: [
          ...existing,
          {
            entity_id: selectedEntity.entity_id,
            entity_type: selectedEntity.entity_type,
            entity_name: selectedEntity.entity_name,
            role_code: selectedRole.role_code,
            role_name: selectedRole.role_name,
          },
        ],
      };
    });
  };

  const removeUserEntityRoleDraft = (userId: number, roleCode: string, entityId: number) => {
    setUserEntityRoleDrafts((prev) => {
      const existing = prev[userId] || [];
      return {
        ...prev,
        [userId]: existing.filter(
          (er) => !(er.entity_id === entityId && er.role_code === roleCode),
        ),
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
        entity_roles: userEntityRoleDrafts[userId] || [],
      });

      setEditingUserId(null);
      setSuccessMessage('User roles updated successfully.');
      await fetchAccessControlData(search);
    } catch (err: unknown) {
      console.error('Failed to update user roles', err);
      setError(getErrorMessage(err, 'Failed to update user roles'));
    } finally {
      setSavingUserId(null);
    }
  };

  // Every role a user holds, globally or for a department/club. The base `user` role is everyone's,
  // so it says nothing and is left out.
  const heldRoleCodes = (accessUser: AccessUser): string[] =>
    [
      ...accessUser.roles.map((r) => r.role_code),
      ...(accessUser.entity_roles || []).map((r) => r.role_code),
    ].filter((code) => String(code || '').toLowerCase() !== 'user');

  const roleFilterOptions = useMemo(() => {
    const holders: Record<string, number> = {};
    let withoutRoles = 0;

    users.forEach((accessUser) => {
      const codes = new Set(heldRoleCodes(accessUser));
      if (codes.size === 0) withoutRoles += 1;
      codes.forEach((code) => {
        holders[code] = (holders[code] || 0) + 1;
      });
    });

    return {
      roles: roles
        .filter((role) => role.role_code !== 'user')
        .map((role) => ({
          value: role.role_code,
          label: role.role_code === 'hod' ? 'HOD' : role.role_name,
          count: holders[role.role_code] || 0,
        })),
      withoutRoles,
    };
  }, [users, roles]);

  const filteredUsers = !roleFilter
    ? users
    : users.filter((accessUser) => {
        const codes = heldRoleCodes(accessUser);
        return roleFilter === NO_ROLES_FILTER ? codes.length === 0 : codes.includes(roleFilter);
      });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / rowsPerPage));

  // Saving a user can take them out of the role filter, leaving fewer pages than the one shown —
  // an empty page, and with 10 or fewer left no pager to leave it by.
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pageUsers = filteredUsers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // A failure while a dialog is open is shown inside it, where the person is looking.
  const dialogOpen = editingUserId !== null || viewingRoleId !== null || showCreateRole;
  const dialogError = dialogOpen && error ? <Alert variant="danger">{error}</Alert> : null;

  const renderUserRoleTags = (accessUser: AccessUser) => {
    const allRoles = [
      ...accessUser.roles.map((r) => ({ ...r, entity_name: '' })),
      ...(accessUser.entity_roles || []),
    ].filter((r) => String(r.role_code || '').toLowerCase() !== 'user');

    if (allRoles.length === 0) {
      return <span className="admin-muted">No roles</span>;
    }

    const visibleRoles = allRoles.slice(0, 3);
    const remainingCount = allRoles.length - visibleRoles.length;

    return (
      <div className="ac-role-tags">
        {visibleRoles.map((r, i) => (
          <span key={`${r.role_code}-${i}`} className={getRoleTagClassName(r.role_code)}>
            {r.role_code === 'hod' ? 'HOD' : r.role_name}
            {r.entity_name ? `: ${r.entity_name}` : ''}
          </span>
        ))}
        {remainingCount > 0 && (
          <span
            className="admin-badge ac-role-tag ac-role-tag--default"
            title={allRoles
              .slice(3)
              .map((r) => (r.entity_name ? `${r.role_name}: ${r.entity_name}` : r.role_name))
              .join(', ')}
          >
            +{remainingCount} more
          </span>
        )}
      </div>
    );
  };

  const renderUsersTab = () => (
    <>
      <div className="admin-toolbar">
        <div className="admin-toolbar__filters">
          <Form.Select
            className="ac-role-filter"
            aria-label="Show users with a role"
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All roles</option>
            {roleFilterOptions.roles.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({option.count})
              </option>
            ))}
            <option value={NO_ROLES_FILTER}>No roles ({roleFilterOptions.withoutRoles})</option>
          </Form.Select>
          <Form.Control
            type="search"
            placeholder="Search by name or email"
            aria-label="Search users by name or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="admin-card table-responsive">
        <Table hover className="ac-users-table ac-stack-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Roles</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageUsers.map((accessUser) => (
              <tr key={accessUser.id}>
                <td>
                  <div className="admin-name">{accessUser.name || 'Unnamed User'}</div>
                  <div className="ac-secondary">
                    {accessUser.email} · ID {accessUser.id}
                  </div>
                </td>
                <td>{renderUserRoleTags(accessUser)}</td>
                <td>
                  <div className="admin-actions">
                    <CustomButton
                      size="sm"
                      variant="light"
                      className="admin-btn-secondary ac-row-btn"
                      onClick={() => openUser(accessUser)}
                      disabled={!viewerIsSuperAdmin && isCurrentUser(accessUser.id)}
                      title={
                        !viewerIsSuperAdmin && isCurrentUser(accessUser.id)
                          ? 'Ask a Super Admin to change your own roles'
                          : undefined
                      }
                    >
                      Edit roles
                    </CustomButton>
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={3} className="admin-empty">
                  {users.length > 0 && roleFilter
                    ? 'Nobody here holds this role.'
                    : 'No users found for this search.'}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {filteredUsers.length > ROWS_PER_PAGE_OPTIONS[0] && (
        <div className="ac-pager">
          <label className="ac-pager__rows">
            Rows per page
            <Form.Select
              className="ac-pager__select"
              value={rowsPerPage}
              onChange={(event) => {
                setRowsPerPage(Number(event.target.value));
                setCurrentPage(1);
              }}
            >
              {ROWS_PER_PAGE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Form.Select>
          </label>
          <span className="ac-secondary">
            {(currentPage - 1) * rowsPerPage + 1}–
            {Math.min(currentPage * rowsPerPage, filteredUsers.length)} of {filteredUsers.length}
          </span>
          <div className="ac-pager__nav">
            <AdminIconButton
              icon={<ChevronLeft size={16} aria-hidden="true" />}
              label="Previous page"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            />
            <span className="ac-secondary">
              Page {currentPage} of {totalPages}
            </span>
            <AdminIconButton
              icon={<ChevronRight size={16} aria-hidden="true" />}
              label="Next page"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            />
          </div>
        </div>
      )}
    </>
  );

  const renderRolesTab = () => (
    <div className="admin-card table-responsive">
      <Table hover className="ac-roles-table ac-stack-table">
        <thead>
          <tr>
            <th>Role</th>
            <th>Type</th>
            <th>Users</th>
            <th>Permissions</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role.id}>
              <td>
                <div className="admin-name">{role.role_name}</div>
                {role.description && <div className="ac-secondary">{role.description}</div>}
              </td>
              <td>
                <span
                  className={`admin-badge ${role.is_system ? 'admin-badge--muted' : 'admin-badge--info'}`}
                >
                  {role.is_system ? 'System' : 'Custom'}
                </span>
              </td>
              <td
                className="ac-number"
                data-label={role.assigned_user_count === 1 ? 'user' : 'users'}
              >
                {role.assigned_user_count}
              </td>
              <td
                className="ac-number"
                data-label={role.permissions.length === 1 ? 'permission' : 'permissions'}
              >
                {role.permissions.length}
              </td>
              <td>
                <div className="admin-actions">
                  <AdminIconButton
                    icon={<Eye size={16} aria-hidden="true" />}
                    label={`View ${role.role_name}`}
                    onClick={() => openRole(role)}
                  />
                  {viewerIsSuperAdmin && !role.is_system && (
                    <AdminIconButton
                      icon={<Trash2 size={16} aria-hidden="true" />}
                      label={
                        role.assigned_user_count > 0
                          ? 'Remove this role from every user before deleting it'
                          : `Delete ${role.role_name}`
                      }
                      variant="danger"
                      disabled={deletingRoleId === role.id || role.assigned_user_count > 0}
                      onClick={() => handleDeleteRoleClick(role)}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
          {roles.length === 0 && (
            <tr>
              <td colSpan={5} className="admin-empty">
                No roles found.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );

  const renderUserModal = () => {
    if (!editingUser) return null;

    const draftRoleCodes = userRoleDrafts[editingUser.id] || [];
    const draftEntityRoles = userEntityRoleDrafts[editingUser.id] || [];
    const selectedGlobalCount = globalRoles.filter((role) =>
      draftRoleCodes.includes(role.role_code),
    ).length;
    const entityRoleKey = (er: EntityRole) => `${er.role_code}:${er.entity_id}`;
    const userChanged =
      !sameKeys(
        draftRoleCodes,
        editingUser.roles.map((r) => r.role_code),
      ) ||
      !sameKeys(
        draftEntityRoles.map(entityRoleKey),
        (editingUser.entity_roles || []).map(entityRoleKey),
      );

    return (
      <CustomModal
        show
        onHide={closeUser}
        title={`Edit roles — ${editingUser.name || 'Unnamed User'}`}
        className="admin-modal ac-user-modal"
        footer={
          <>
            <CustomButton variant="light" className="admin-btn-secondary" onClick={closeUser}>
              Cancel
            </CustomButton>
            <CustomButton
              onClick={() => void saveUserRoles(editingUser.id)}
              loading={savingUserId === editingUser.id}
              disabled={!userChanged}
            >
              Save
            </CustomButton>
          </>
        }
      >
        {dialogError}
        <p className="ac-secondary ac-modal-lead">{editingUser.email}</p>

        <div className="ac-section-label ac-section-label--split">
          Roles
          <span className="ac-secondary">{selectedGlobalCount} selected</span>
        </div>
        <div className="ac-role-list">
          {globalRoles.map((role) => {
            const checkboxId = `user-${editingUser.id}-role-${role.role_code}`;
            const selected = draftRoleCodes.includes(role.role_code);
            // Shown, not hidden, so an Admin can still see who is a Super Admin.
            const locked = role.role_code === 'super_admin' && !viewerIsSuperAdmin;
            const description = locked
              ? 'Only a Super Admin can grant or remove this role'
              : role.description;

            return (
              <div
                key={role.role_code}
                className={`ac-role-row ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`.trim()}
              >
                <CustomCheckbox
                  id={checkboxId}
                  name={checkboxId}
                  label={role.role_name}
                  checked={selected}
                  disabled={locked}
                  onChange={() => toggleUserRoleDraft(editingUser.id, role.role_code)}
                />
                {/* A label too, so the whole row toggles; the full text shows on hover when
                    it is cut short. */}
                <label
                  htmlFor={checkboxId}
                  className="ac-role-row__desc"
                  title={description || undefined}
                >
                  {description}
                </label>
              </div>
            );
          })}
        </div>

        <div className="ac-section-label">Department &amp; club roles</div>
        <div className="admin-form-grid">
          <CustomDropdown
            label="HOD of department"
            name={`user-${editingUser.id}-hod`}
            options={hodOptions}
            value={null}
            placeholder="Add a department..."
            onChange={(selected) => {
              const option = selected as EntityOption | null;
              if (option) {
                addUserEntityRoleDraft(editingUser.id, 'hod', Number(option.value), option.type);
              }
            }}
          />
          <CustomDropdown
            label="Coordinator of club / cell"
            name={`user-${editingUser.id}-coordinator`}
            options={coordinatorOptions}
            value={null}
            placeholder="Add a club or cell..."
            onChange={(selected) => {
              const option = selected as EntityOption | null;
              if (option) {
                addUserEntityRoleDraft(
                  editingUser.id,
                  'coordinator',
                  Number(option.value),
                  option.type,
                );
              }
            }}
          />
        </div>

        {draftEntityRoles.length > 0 ? (
          <div className="ac-scope-chips">
            {draftEntityRoles.map((er) => (
              <span key={`${er.role_code}-${er.entity_id}`} className="ac-scope-chip">
                <span className="ac-scope-chip__role">
                  {er.role_code === 'hod' ? 'HOD' : er.role_name}
                </span>
                {er.entity_name}
                <button
                  type="button"
                  className="ac-scope-chip__remove"
                  aria-label={`Remove ${er.role_name} of ${er.entity_name}`}
                  title="Remove"
                  onClick={() =>
                    removeUserEntityRoleDraft(editingUser.id, er.role_code, er.entity_id)
                  }
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="ac-secondary">Not HOD or coordinator of anything.</p>
        )}
      </CustomModal>
    );
  };

  const renderRoleModal = () => {
    if (!viewingRole) return null;

    const isSuperAdminRole = viewingRole.role_code === 'super_admin';
    const draftKeys = rolePermissionDrafts[viewingRole.id] || [];
    const metaDraft = roleMetaDrafts[viewingRole.id];
    const permissionsChanged = !sameKeys(
      draftKeys,
      viewingRole.permissions.map((permission) => permission.permission_key),
    );
    const detailsChanged =
      !!metaDraft &&
      (metaDraft.role_name !== viewingRole.role_name ||
        metaDraft.description !== (viewingRole.description || '') ||
        metaDraft.is_admin_role !== viewingRole.is_admin_role);
    const grantedGroups = permissionGroups
      .map(
        ([moduleKey, modulePermissions]) =>
          [
            moduleKey,
            modulePermissions.filter((permission) =>
              viewingRole.permissions.some(
                (granted) => granted.permission_key === permission.permission_key,
              ),
            ),
          ] as [string, Permission[]],
      )
      .filter(([, granted]) => granted.length > 0);

    const footer = editingRolePermissions ? (
      <>
        <CustomButton
          variant="light"
          className="admin-btn-secondary"
          onClick={cancelRolePermissionEdit}
        >
          Cancel
        </CustomButton>
        <CustomButton
          onClick={() => confirmSaveRolePermissions(viewingRole)}
          loading={savingRoleId === viewingRole.id}
          disabled={!permissionsChanged}
        >
          Save permissions
        </CustomButton>
      </>
    ) : (
      <>
        <CustomButton variant="light" className="admin-btn-secondary" onClick={closeRole}>
          Close
        </CustomButton>
        {viewerIsSuperAdmin && !isSuperAdminRole && (
          <CustomButton onClick={() => setEditingRolePermissions(true)}>
            Edit permissions
          </CustomButton>
        )}
      </>
    );

    return (
      <CustomModal
        show
        onHide={closeRole}
        title={viewingRole.role_name}
        className="admin-modal ac-role-modal"
        scrollable
        footer={footer}
      >
        {dialogError}
        <div className="ac-role-meta">
          <span
            className={`admin-badge ${viewingRole.is_system ? 'admin-badge--muted' : 'admin-badge--info'}`}
          >
            {viewingRole.is_system ? 'System' : 'Custom'}
          </span>
          {viewingRole.is_admin_role && (
            <span className="admin-badge admin-badge--yes">Opens the admin area</span>
          )}
          <span className="ac-secondary">
            {viewingRole.assigned_user_count} user
            {viewingRole.assigned_user_count === 1 ? '' : 's'} · code {viewingRole.role_code}
          </span>
        </div>
        {(viewingRole.is_system || !viewerIsSuperAdmin) && viewingRole.description && (
          <p className="ac-modal-lead">{viewingRole.description}</p>
        )}

        {viewerIsSuperAdmin && !viewingRole.is_system && metaDraft && (
          <div className="ac-role-details">
            <div className="admin-form-grid">
              <CustomInput
                label="Role name"
                name={`role-${viewingRole.id}-name`}
                value={metaDraft.role_name}
                onChange={(value) => updateRoleMetaDraft(viewingRole.id, 'role_name', value)}
                required
              />
              <CustomInput
                label="Description"
                name={`role-${viewingRole.id}-description`}
                value={metaDraft.description}
                onChange={(value) => updateRoleMetaDraft(viewingRole.id, 'description', value)}
              />
            </div>
            <div className="ac-role-details__actions">
              <CustomToggle
                name={`role-${viewingRole.id}-admin`}
                label="Opens the admin area"
                checked={metaDraft.is_admin_role}
                onChange={(checked) =>
                  updateRoleMetaDraft(viewingRole.id, 'is_admin_role', checked)
                }
              />
              <CustomButton
                size="sm"
                onClick={() => void handleSaveRoleMeta(viewingRole.id)}
                loading={savingRoleMetaId === viewingRole.id}
                disabled={!detailsChanged}
              >
                Save details
              </CustomButton>
            </div>
          </div>
        )}

        <div className="ac-section-label">
          {editingRolePermissions
            ? `Permissions — ${draftKeys.length} of ${permissions.length} selected`
            : `Permissions (${viewingRole.permissions.length})`}
        </div>

        {isSuperAdminRole ? (
          <p className="ac-secondary">Super Admin&apos;s permissions are locked.</p>
        ) : (
          !viewerIsSuperAdmin && (
            <p className="ac-secondary">Only a Super Admin can change what a role allows.</p>
          )
        )}

        {editingRolePermissions ? (
          <PermissionPicker
            groups={permissionGroups}
            selectedKeys={draftKeys}
            idPrefix={`role-${viewingRole.id}`}
            onToggle={(key) =>
              setRolePermissionDrafts((prev) => ({
                ...prev,
                [viewingRole.id]: toggleKey(prev[viewingRole.id] || [], key),
              }))
            }
            onToggleGroup={(keys, select) =>
              setRolePermissionDrafts((prev) => ({
                ...prev,
                [viewingRole.id]: toggleKeyGroup(prev[viewingRole.id] || [], keys, select),
              }))
            }
          />
        ) : grantedGroups.length > 0 ? (
          <div className="ac-permission-groups">
            {grantedGroups.map(([moduleKey, granted]) => (
              <div key={moduleKey} className="ac-permission-group">
                <div className="ac-permission-group__header">
                  <span className="ac-permission-group__title">{formatModuleLabel(moduleKey)}</span>
                </div>
                {granted.map((permission) => (
                  <div key={permission.permission_key} className="ac-permission-granted">
                    <Check size={16} aria-hidden="true" className="ac-permission-granted__icon" />
                    <div>
                      <div>{permission.description || permission.action_key}</div>
                      <span className="ac-permission-key">{permission.permission_key}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="ac-secondary">This role has no permissions.</p>
        )}
      </CustomModal>
    );
  };

  const renderCreateRoleModal = () => (
    <CustomModal
      show={showCreateRole}
      onHide={closeCreateRole}
      title="New role"
      className="admin-modal ac-role-modal"
      scrollable
      footer={
        <>
          <CustomButton variant="light" className="admin-btn-secondary" onClick={closeCreateRole}>
            Cancel
          </CustomButton>
          <CustomButton type="submit" form="ac-create-role-form" loading={roleCreationLoading}>
            Create role
          </CustomButton>
        </>
      }
    >
      <Form id="ac-create-role-form" onSubmit={handleCreateRole}>
        {dialogError}
        <div className="admin-form-grid">
          <CustomInput
            label="Role name"
            name="new-role-name"
            value={roleName}
            onChange={setRoleName}
            placeholder="e.g. Department Reviewer"
            required
          />
          <CustomInput
            label="Role code (optional)"
            name="new-role-code"
            value={roleCode}
            onChange={setRoleCode}
            placeholder="e.g. department_reviewer"
          />
          <CustomInput
            label="Description"
            name="new-role-description"
            className="admin-field--full"
            value={roleDescription}
            onChange={setRoleDescription}
            placeholder="Optional description"
          />
        </div>

        <div className="ac-section-label">
          Permissions — {selectedPermissionKeys.length} of {permissions.length} selected
        </div>
        <PermissionPicker
          groups={permissionGroups}
          selectedKeys={selectedPermissionKeys}
          idPrefix="new-role"
          onToggle={(key) => setSelectedPermissionKeys((prev) => toggleKey(prev, key))}
          onToggleGroup={(keys, select) =>
            setSelectedPermissionKeys((prev) => toggleKeyGroup(prev, keys, select))
          }
        />
      </Form>
    </CustomModal>
  );

  return (
    <>
      <div className="admin-screen ac-screen">
        <AdminScreenHeader
          title="Access Control"
          description="Give people roles, and see what each role lets them do."
          actions={
            activeTab === 'users' ? (
              <CustomButton
                variant="light"
                className="admin-btn-secondary"
                onClick={handleSyncRolesClick}
                disabled={syncRolesLoading || loading}
              >
                {syncRolesLoading ? (
                  <Spinner as="span" animation="border" size="sm" aria-hidden="true" />
                ) : (
                  <RefreshCw size={16} aria-hidden="true" />
                )}
                Sync HODs &amp; coordinators
              </CustomButton>
            ) : viewerIsSuperAdmin ? (
              <CustomButton
                onClick={() => {
                  setError('');
                  setShowCreateRole(true);
                }}
                disabled={loading}
              >
                <Plus size={16} aria-hidden="true" />
                New role
              </CustomButton>
            ) : null
          }
        />

        {!dialogOpen && error && <Alert variant="danger">{error}</Alert>}
        {successMessage && (
          <Alert variant="success" dismissible onClose={() => setSuccessMessage('')}>
            {successMessage}
          </Alert>
        )}

        <AdminTabs<TabKey>
          tabs={[
            { key: 'users', label: 'Users', count: users.length },
            { key: 'roles', label: 'Roles', count: roles.length },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />

        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        ) : activeTab === 'users' ? (
          renderUsersTab()
        ) : (
          renderRolesTab()
        )}
      </div>

      {renderUserModal()}
      {renderRoleModal()}
      {renderCreateRoleModal()}

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
        onHide={() => setDeleteModalConfig((prev) => ({ ...prev, show: false }))}
        onConfirm={executeDeleteRole}
        itemName={deleteModalConfig.role?.role_name}
        isDeleting={deletingRoleId !== null}
        title="Confirm Role Deletion"
      />
    </>
  );
};

export default AccessControlPage;
