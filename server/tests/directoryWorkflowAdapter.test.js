import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({ default: { execute: vi.fn() } }));

import db from '../config/connection.js';
import { getWorkflowModule } from '../modules/shared/workflow/workflowModuleRegistry.js';
import '../modules/shared/workflow/directoryWorkflowAdapter.js';

describe('directory workflow persistence', () => {
  beforeEach(() => vi.mocked(db.execute).mockReset());

  for (const moduleKey of ['organization_directory', 'resource_person_directory']) {
    it(`${moduleKey} approval updates workflow state without overwriting business status`, async () => {
      const adapter = getWorkflowModule(moduleKey).adapter;
      await adapter.updateRecordWorkflowSnapshot(
        7,
        { status: 'completed', stage: 'directory_admin' },
        {
          actor: { userId: 42 },
        },
      );
      const [sql, params] = vi.mocked(db.execute).mock.calls[0];
      expect(sql).not.toMatch(/(^|[\s,])status\s*=/);
      expect(sql).toContain('workflow_state = ?');
      expect(sql).toContain('is_active = ?');
      expect(params).toEqual([
        JSON.stringify({ status: 'completed', stage: 'directory_admin' }),
        1,
        42,
        7,
      ]);
    });

    it(`${moduleKey} rejection marks inactive without overwriting business status`, async () => {
      const adapter = getWorkflowModule(moduleKey).adapter;
      await adapter.updateRecordWorkflowSnapshot(
        8,
        { status: 'rejected' },
        {
          actor: { userId: 42 },
        },
      );
      const [sql, params] = vi.mocked(db.execute).mock.calls[0];
      expect(sql).not.toMatch(/(^|[\s,])status\s*=/);
      expect(params).toEqual([JSON.stringify({ status: 'rejected' }), 0, 42, 8]);
    });
  }
});
