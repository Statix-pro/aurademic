import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../schema/migrations/20260804_create_directory_module.sql',
);
const migration = fs.readFileSync(migrationPath, 'utf8');
const nameIndexMigrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../schema/migrations/20261015_scope_organization_name_uniqueness_to_submitter.sql',
);
const nameIndexMigration = fs.readFileSync(nameIndexMigrationPath, 'utf8');
const directoryAdminMigration = fs.readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../schema/migrations/20261024_create_directory_admin_role.sql',
  ),
  'utf8',
);
const routePaths = [
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../modules/organizationDirectory/organizationDirectoryRoutes.js',
  ),
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../modules/resourcepersonDirectory/resourcepersonDirectoryRoutes.js',
  ),
];
const routePermissions = routePaths.flatMap((routePath) => {
  const route = fs.readFileSync(routePath, 'utf8');
  return [...route.matchAll(/permissionMiddleware\(\s*\[\s*'([^']+)'/g)].map(
    ([, permissionKey]) => permissionKey,
  );
});

describe('directory permission migration', () => {
  it('grants every permission used by directory routes to every seeded role', () => {
    const permissionValues = [...migration.matchAll(/\('directory',\s*'[^']+',\s*'([^']+)'/g)].map(
      ([, permissionKey]) => permissionKey,
    );
    const roleGrant = migration.match(
      /INSERT INTO `role_permissions`[\s\S]*?SELECT r\.id, p\.id[\s\S]*?FROM `roles` r[\s\S]*?JOIN `permissions` p ON p\.module_key = 'directory'([\s\S]*?)ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;/,
    );

    expect(routePermissions).toContain('directory.read');
    expect(routePermissions).toContain('directory.create');
    expect(routePermissions).toContain('directory.edit');
    expect(
      new Set(routePermissions.filter((permissionKey) => permissionKey.startsWith('directory.'))),
    ).toEqual(new Set(permissionValues));
    expect(roleGrant).toBeTruthy();
    expect(roleGrant[1]).not.toMatch(/WHERE\s+r\.role_code/i);
    expect(migration).toContain('ON DUPLICATE KEY UPDATE `description` = VALUES(`description`)');
    expect(migration).toContain('ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`');
  });

  // Review keys go to the Directory Admin role only, never to every role: holding one
  // makes the user an approver and a recipient of every directory submission.
  it('creates every review permission the routes use and grants it to directory_admin only', () => {
    const reviewPermissions = routePermissions.filter((key) => key.includes('.workflow.'));

    expect(new Set(reviewPermissions)).toEqual(
      new Set([
        'organization_directory.workflow.directory_admin',
        'resource_person_directory.workflow.directory_admin',
      ]),
    );
    for (const permissionKey of reviewPermissions) {
      expect(directoryAdminMigration).toContain(`'${permissionKey}'`);
      expect(migration).not.toContain(permissionKey);
    }
    expect(directoryAdminMigration).toMatch(/WHERE r\.role_code = 'directory_admin'/);
    expect(directoryAdminMigration).toMatch(
      /'directory_admin',\s*'Directory Admin',[\s\S]*?,\s*1,\s*0\s*\)/,
    );
  });

  it('covers every role ID referenced by the developer seed', () => {
    const seedPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../schema/developer_seed.sql',
    );
    const seed = fs.readFileSync(seedPath, 'utf8');
    const globalRoleIds = [...seed.matchAll(/\(9999,\s*(\d+)\)/g)].map(([, roleId]) =>
      Number(roleId),
    );
    const entityRoleIds = [
      ...seed.matchAll(/\(9999,\s*\d+,\s*'(?:DEPARTMENT|CELL)',\s*(\d+)\)/g),
    ].map(([, roleId]) => Number(roleId));
    const seededRoleIds = new Set([...globalRoleIds, ...entityRoleIds]);
    const grant = migration.match(
      /INSERT INTO `role_permissions`[\s\S]*?SELECT r\.id, p\.id[\s\S]*?FROM `roles` r[\s\S]*?JOIN `permissions` p ON p\.module_key = 'directory'([\s\S]*?)ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;/,
    );

    expect(seededRoleIds).toEqual(new Set([1, 3, 4, 5, 13, 15, 38]));
    expect(grant).toBeTruthy();
    expect(grant[1]).not.toMatch(/\bWHERE\b/);
  });

  it('replaces the global organization-name key with an idempotent owner-scoped key', () => {
    expect(nameIndexMigration).toMatch(/index_name = 'uq_organizations_name'/);
    expect(nameIndexMigration).toMatch(/DROP INDEX `uq_organizations_name`/);
    expect(nameIndexMigration).toMatch(/index_name = 'uq_organizations_created_by_name'/);
    expect(nameIndexMigration).toMatch(
      /ADD UNIQUE KEY `uq_organizations_created_by_name` \(`created_by`, `name`\)/,
    );
    expect(nameIndexMigration).toContain('PREPARE drop_global_organization_name_index_stmt');
    expect(nameIndexMigration).toContain('PREPARE add_submitter_organization_name_index_stmt');
  });
});
