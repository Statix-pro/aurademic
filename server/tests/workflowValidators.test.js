import { describe, expect, it } from 'vitest';

import {
  WorkflowError,
  validateWorkflowMeta,
} from '../modules/shared/workflow/workflowValidators.js';

describe('workflowValidators', () => {
  it('allows topup as a workflow origin', () => {
    const meta = validateWorkflowMeta({
      origin: 'topup',
      requestId: null,
      moduleMetaVersion: 1,
      moduleMeta: null,
    });

    expect(meta.origin).toBe('topup');
  });

  it('rejects unknown workflow origins', () => {
    expect(() =>
      validateWorkflowMeta({
        origin: 'manual',
      }),
    ).toThrow(WorkflowError);
  });
});
