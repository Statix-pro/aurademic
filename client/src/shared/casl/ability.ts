import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { User } from '../../types';

// ─── Subject types matching your modules ───────────────────────────────
// Add new subjects here as your app grows.
export type Subjects =
    | 'AdminDashboard'
    | 'FormOptions'
    | 'BudgetProposal'
    | 'BudgetAdmin'
    | 'Finance'
    | 'Event'
    | 'Journal'
    | 'Project'
    | 'Report'
    | 'AccessControl'
    | 'MasterData'
    | 'GuestHouse'
    | 'Profile'
    | 'all'; // CASL's wildcard for "everything"

// ─── Action types ──────────────────────────────────────────────────────
export type Actions = 'manage' | 'create' | 'read' | 'edit' | 'delete' | 'approve';

// ─── The Ability type used across the app ──────────────────────────────
export type AppAbility = MongoAbility<[Actions, Subjects]>;

// ─── Permission key → CASL rule mapping ────────────────────────────────
// This auto-translates your existing permission strings (e.g. "admin_dashboard.read")
// into CASL rules (e.g. can('read', 'AdminDashboard')).
const PERMISSION_MAP: Record<string, { action: Actions; subject: Subjects }> = {
    // Admin Dashboard
    'admin_dashboard.read': { action: 'read', subject: 'AdminDashboard' },
    'admin_dashboard.edit': { action: 'edit', subject: 'AdminDashboard' },
    'admin_dashboard.approve': { action: 'approve', subject: 'AdminDashboard' },
    'admin_dashboard.manage': { action: 'manage', subject: 'AdminDashboard' },

    // Form Options
    'form_options.read': { action: 'read', subject: 'FormOptions' },
    'form_options.edit': { action: 'edit', subject: 'FormOptions' },
    'form_options.manage': { action: 'manage', subject: 'FormOptions' },

    // Budget
    'budget.proposal.manage': { action: 'manage', subject: 'BudgetProposal' },
    'budget.workflow.level1': { action: 'approve', subject: 'BudgetProposal' },
    'budget.workflow.dof': { action: 'approve', subject: 'BudgetProposal' },
    'budget.workflow.principal': { action: 'approve', subject: 'BudgetProposal' },
    'budget.admin.view': { action: 'read', subject: 'BudgetAdmin' },
    'budget.admin.manage': { action: 'manage', subject: 'BudgetAdmin' },

    // Finance
    'finance.read': { action: 'read', subject: 'Finance' },
    'finance.edit': { action: 'edit', subject: 'Finance' },
    'finance.approve': { action: 'approve', subject: 'Finance' },
    'finance.manage': { action: 'manage', subject: 'Finance' },

    // Events
    'events.read': { action: 'read', subject: 'Event' },
    'events.edit': { action: 'edit', subject: 'Event' },

    // Reports
    'reports.read': { action: 'read', subject: 'Report' },
    'reports.manage': { action: 'manage', subject: 'Report' },

    // Access Control
    'access_control.read': { action: 'read', subject: 'AccessControl' },
    'access_control.manage': { action: 'manage', subject: 'AccessControl' },
};

// ─── Helper: check if user is super admin ──────────────────────────────
const checkSuperAdmin = (user: User): boolean => {
    if (user.is_super_admin) return true;

    const roles = Array.isArray(user.roles) ? user.roles : [];
    return roles.some((role) => String(role || '').toLowerCase() === 'super_admin');
};

// ─── Main: build ability from user ─────────────────────────────────────
export function defineAbilityFor(user: User | null): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (!user) {
        // Unauthenticated — no abilities
        return build();
    }

    // ── Super Admin: full access ──
    if (checkSuperAdmin(user)) {
        can('manage', 'all');
        return build();
    }

    // ── Admin: admin area access ──
    if (user.is_admin) {
        can('read', 'AdminDashboard');
        can('edit', 'AdminDashboard');
    }

    // ── All authenticated users: basic access ──
    can('read', 'Journal');
    can('read', 'Project');
    can('read', 'Event');
    can('read', 'Profile');
    can('create', 'Journal');
    can('create', 'Project');

    // ── Map permission keys to CASL rules ──
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];

    for (const permissionKey of permissions) {
        const mapping = PERMISSION_MAP[permissionKey];
        if (mapping) {
            can(mapping.action, mapping.subject);
        }
    }

    return build();
}

// ─── Default empty ability (used before user is loaded) ────────────────
export const defaultAbility = createMongoAbility<[Actions, Subjects]>();
