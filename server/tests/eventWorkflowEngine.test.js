import { describe, expect, it } from 'vitest';

import {
  WORKFLOW_STAGES,
  getNextStage,
  getRequiredApproverRole,
  canUserApproveStage,
  parseWorkflowState,
} from '../modules/events/eventWorkflowEngine.js';

describe('Event Approval Workflow Engine Unit Tests', () => {
  it('correctly transitions through approval sequence: HOD -> IQAC -> Principal -> Approved', () => {
    expect(getNextStage(WORKFLOW_STAGES.DRAFT)).toBe(WORKFLOW_STAGES.HOD_PENDING);
    expect(getNextStage(WORKFLOW_STAGES.RETURN)).toBe(WORKFLOW_STAGES.HOD_PENDING);
    expect(getNextStage(WORKFLOW_STAGES.HOD_PENDING)).toBe(WORKFLOW_STAGES.IQAC_PENDING);
    expect(getNextStage(WORKFLOW_STAGES.IQAC_PENDING)).toBe(WORKFLOW_STAGES.PRINCIPAL_PENDING);
    expect(getNextStage(WORKFLOW_STAGES.PRINCIPAL_PENDING)).toBe(WORKFLOW_STAGES.APPROVED);
  });

  it('identifies required approver role for each stage', () => {
    expect(getRequiredApproverRole(WORKFLOW_STAGES.DRAFT)).toBe('Creator');
    expect(getRequiredApproverRole(WORKFLOW_STAGES.HOD_PENDING)).toBe('HOD');
    expect(getRequiredApproverRole(WORKFLOW_STAGES.IQAC_PENDING)).toBe('IQAC');
    expect(getRequiredApproverRole(WORKFLOW_STAGES.PRINCIPAL_PENDING)).toBe('Principal');
    expect(getRequiredApproverRole(WORKFLOW_STAGES.APPROVED)).toBe('None');
  });

  it('validates user role permissions strictly per stage', () => {
    const hodUser = { id: 1, roles: ['hod'] };
    const iqacUser = { id: 2, roles: ['iqac'] };
    const principalUser = { id: 3, roles: ['principal'] };
    const randomFaculty = { id: 4, roles: ['faculty'] };

    // HOD Stage
    expect(canUserApproveStage(hodUser, WORKFLOW_STAGES.HOD_PENDING)).toBe(true);
    expect(canUserApproveStage(iqacUser, WORKFLOW_STAGES.HOD_PENDING)).toBe(false);
    expect(canUserApproveStage(principalUser, WORKFLOW_STAGES.HOD_PENDING)).toBe(false);
    expect(canUserApproveStage(randomFaculty, WORKFLOW_STAGES.HOD_PENDING)).toBe(false);

    // IQAC Stage
    expect(canUserApproveStage(hodUser, WORKFLOW_STAGES.IQAC_PENDING)).toBe(false);
    expect(canUserApproveStage(iqacUser, WORKFLOW_STAGES.IQAC_PENDING)).toBe(true);
    expect(canUserApproveStage(principalUser, WORKFLOW_STAGES.IQAC_PENDING)).toBe(false);

    // Principal Stage
    expect(canUserApproveStage(hodUser, WORKFLOW_STAGES.PRINCIPAL_PENDING)).toBe(false);
    expect(canUserApproveStage(iqacUser, WORKFLOW_STAGES.PRINCIPAL_PENDING)).toBe(false);
    expect(canUserApproveStage(principalUser, WORKFLOW_STAGES.PRINCIPAL_PENDING)).toBe(true);
  });

  it('parses JSON workflow states gracefully', () => {
    const jsonState = JSON.stringify({
      status: WORKFLOW_STAGES.HOD_PENDING,
      submittedAt: '2026-09-28T10:00:00.000Z',
    });

    const parsed = parseWorkflowState(jsonState);
    expect(parsed.status).toBe(WORKFLOW_STAGES.HOD_PENDING);
    expect(parsed.currentApproverRole).toBe('HOD');
    expect(parsed.submittedAt).toBe('2026-09-28T10:00:00.000Z');
  });
});
