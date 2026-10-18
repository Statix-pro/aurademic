import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../modules/guesthouse/guesthouseModel.js', () => ({
  default: {
    listGuesthouseBookings: vi.fn(),
    listAccessibleGuesthouseBookingIds: vi.fn(),
    createGuesthouseBooking: vi.fn(),
    listGuesthouseRooms: vi.fn(),
    getActiveEmployeeIdByEmail: vi.fn(),
    beginTransaction: vi.fn(),
    getGuesthouseBookingById: vi.fn(),
  },
}));

vi.mock('../modules/shared/workflow/workflowService.js', () => ({
  actOnWorkflow: vi.fn(),
  startWorkflow: vi.fn(),
  listQueue: vi.fn(),
  getQueueScopeFilters: vi.fn().mockResolvedValue({ forceAll: true }),
  getTimeline: vi.fn(),
  getWorkflowMetadata: vi.fn(),
}));

vi.mock('../modules/shared/workflow/workflowModuleRegistry.js', () => ({
  registerWorkflowModule: vi.fn(),
}));

import guesthouseController from '../modules/guesthouse/guesthouseController.js';
import guesthouseModel from '../modules/guesthouse/guesthouseModel.js';
import { startWorkflow } from '../modules/shared/workflow/workflowService.js';

const makeResponse = () => {
  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return response;
};

describe('Guest House authorization and date-time validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('limits workflow users to records visible in their authorized stage queues', async () => {
    guesthouseModel.listAccessibleGuesthouseBookingIds.mockResolvedValue([42]);
    guesthouseModel.listGuesthouseBookings.mockResolvedValue({ items: [{ id: 42 }], total: 1, page: 1, limit: 20 });
    const response = makeResponse();

    await guesthouseController.listGuesthouseBookings({
      query: {},
      user: { id: 7, roles: ['hod'], permissions: ['guesthouse.workflow.hod'] },
    }, response);

    expect(response.statusCode).toBe(200);
    expect(guesthouseModel.listAccessibleGuesthouseBookingIds).toHaveBeenCalledTimes(1);
    expect(guesthouseModel.listAccessibleGuesthouseBookingIds).toHaveBeenCalledWith([
      { stage: 'hod', filters: { forceAll: true } },
    ]);
    expect(guesthouseModel.listGuesthouseBookings).toHaveBeenCalledWith(expect.objectContaining({
      bookingIds: [42],
    }));
  });

  it('creates a normal user booking using the employee profile linked by email', async () => {
    const tx = { commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
    guesthouseModel.getActiveEmployeeIdByEmail.mockResolvedValue(501);
    guesthouseModel.beginTransaction.mockResolvedValue(tx);
    guesthouseModel.createGuesthouseBooking.mockResolvedValue(91);
    guesthouseModel.getGuesthouseBookingById.mockResolvedValue({ id: 91 });
    startWorkflow.mockResolvedValue({ state: { currentStage: 'hod', status: 'in_progress' } });
    const response = makeResponse();

    await guesthouseController.createGuesthouseBooking({
      user: { id: 17, email: 'staff@example.edu', permissions: [] },
      body: {
        applicant: { name: 'Forged name', employeeId: 999 },
        beneficiary: { beneficiaryType: 'Guest', staffName: '' },
        guests: [{ name: 'Guest', travel: {
          checkInDate: '2026-11-01', checkOutDate: '2026-11-02',
          checkInTime: '10:00', checkOutTime: '10:00',
        } }],
      },
    }, response);

    expect(response.statusCode).toBe(201);
    expect(guesthouseModel.getActiveEmployeeIdByEmail).toHaveBeenCalledWith('staff@example.edu');
    expect(guesthouseModel.createGuesthouseBooking).toHaveBeenCalledWith(
      expect.objectContaining({ applicant: expect.objectContaining({ employeeId: 501 }) }),
      17,
      { tx },
    );
    expect(tx.commit).toHaveBeenCalledOnce();
  });

  it('applies the same queue scope to role-assigned HODs without explicit permission strings', async () => {
    guesthouseModel.listAccessibleGuesthouseBookingIds.mockResolvedValue([43]);
    guesthouseModel.listGuesthouseBookings.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    const response = makeResponse();

    await guesthouseController.listGuesthouseBookings({
      query: {},
      user: { id: 8, roles: ['hod'], permissions: [] },
    }, response);

    expect(response.statusCode).toBe(200);
    expect(guesthouseModel.listAccessibleGuesthouseBookingIds).toHaveBeenCalledWith([
      { stage: 'hod', filters: { forceAll: true } },
    ]);
    expect(guesthouseModel.listGuesthouseBookings).toHaveBeenCalledWith(expect.objectContaining({
      createdByUserId: undefined,
      bookingIds: [43],
    }));
  });

  it('rejects a same-day stay whose checkout instant is not after check-in', async () => {
    const response = makeResponse();
    const request = {
      body: {
        applicant: { name: 'Test Applicant' },
        beneficiary: { beneficiaryType: 'Department' },
        guests: [{
          name: 'Test Guest',
          travel: {
            checkInDate: '2026-10-11',
            checkInTime: '15:00',
            checkOutDate: '2026-10-11',
            checkOutTime: '14:59',
          },
        }],
      },
      user: { id: 7 },
    };

    await guesthouseController.createGuesthouseBooking(request, response);

    expect(response.statusCode).toBe(400);
    expect(guesthouseModel.createGuesthouseBooking).not.toHaveBeenCalled();

    request.body.guests[0].travel.checkOutTime = '15:00:00';
    const equalInstantResponse = makeResponse();
    await guesthouseController.createGuesthouseBooking(request, equalInstantResponse);

    expect(equalInstantResponse.statusCode).toBe(400);
    expect(guesthouseModel.createGuesthouseBooking).not.toHaveBeenCalled();
  });
});
