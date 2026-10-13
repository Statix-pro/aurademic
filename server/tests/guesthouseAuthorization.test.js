import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../modules/guesthouse/guesthouseModel.js', () => ({
  default: {
    listGuesthouseBookings: vi.fn(),
    createGuesthouseBooking: vi.fn(),
    listGuesthouseRooms: vi.fn(),
  },
}));

vi.mock('../modules/shared/workflow/workflowService.js', () => ({
  actOnWorkflow: vi.fn(),
  startWorkflow: vi.fn(),
  listQueue: vi.fn(),
  getQueueScopeFilters: vi.fn(),
  getTimeline: vi.fn(),
  getWorkflowMetadata: vi.fn(),
}));

vi.mock('../modules/shared/workflow/workflowModuleRegistry.js', () => ({
  registerWorkflowModule: vi.fn(),
}));

import guesthouseController from '../modules/guesthouse/guesthouseController.js';
import guesthouseModel from '../modules/guesthouse/guesthouseModel.js';
import { listQueue } from '../modules/shared/workflow/workflowService.js';

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
    listQueue.mockResolvedValue({ items: [{ id: 42 }], total: 1 });
    guesthouseModel.listGuesthouseBookings.mockResolvedValue({ items: [{ id: 42 }], total: 1, page: 1, limit: 20 });
    const response = makeResponse();

    await guesthouseController.listGuesthouseBookings({
      query: {},
      user: { id: 7, roles: ['hod'], permissions: ['guesthouse.workflow.hod'] },
    }, response);

    expect(response.statusCode).toBe(200);
    expect(listQueue).toHaveBeenCalledTimes(1);
    expect(listQueue).toHaveBeenCalledWith(expect.objectContaining({
      moduleKey: 'guesthouse',
      stage: 'hod',
      filters: expect.objectContaining({ workflowStatus: 'all', page: 1, limit: 100 }),
    }));
    expect(guesthouseModel.listGuesthouseBookings).toHaveBeenCalledWith(expect.objectContaining({
      bookingIds: [42],
    }));
  });

  it('applies the same queue scope to role-assigned HODs without explicit permission strings', async () => {
    listQueue.mockResolvedValue({ items: [{ id: 43 }], total: 1 });
    guesthouseModel.listGuesthouseBookings.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    const response = makeResponse();

    await guesthouseController.listGuesthouseBookings({
      query: {},
      user: { id: 8, roles: ['hod'], permissions: [] },
    }, response);

    expect(response.statusCode).toBe(200);
    expect(listQueue).toHaveBeenCalledWith(expect.objectContaining({ stage: 'hod' }));
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
