import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(
  '../modules/organizationDirectory/organizationDirectoryModel.js',
  async (importOriginal) => {
    const actual = await importOriginal();
    return {
      ...actual,
      default: { listApproved: vi.fn(), submit: vi.fn(), review: vi.fn(), update: vi.fn() },
    };
  },
);
vi.mock('../modules/resourcepersonDirectory/resourcepersonDirectoryModel.js', () => ({
  default: { list: vi.fn(), submit: vi.fn(), review: vi.fn(), update: vi.fn() },
}));

import organizationController from '../modules/organizationDirectory/organizationDirectoryController.js';
import organizationModel, {
  normalizePayload,
} from '../modules/organizationDirectory/organizationDirectoryModel.js';
import resourcePersonController from '../modules/resourcepersonDirectory/resourcepersonDirectoryController.js';
import resourcePersonModel from '../modules/resourcepersonDirectory/resourcepersonDirectoryModel.js';

const response = () => {
  const res = { json: vi.fn() };
  res.status = vi.fn().mockReturnValue(res);
  return res;
};

const request = (overrides = {}) => ({
  body: {},
  files: {},
  params: { id: '7' },
  user: { id: 1 },
  ...overrides,
});

describe('directory controller error envelopes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it.each([
    ['organization', organizationController, organizationModel, 'update'],
    ['resource person', resourcePersonController, resourcePersonModel, 'update'],
  ])(
    'does not disclose duplicate database errors for %s',
    async (_name, controller, model, method) => {
      model[method].mockRejectedValueOnce({
        code: 'ER_DUP_ENTRY',
        message: 'Duplicate entry uq_organizations_name',
      });
      const res = response();

      await controller.update(request(), res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json.mock.calls[0][0].message).not.toMatch(
        /Duplicate entry|uq_organizations_name|ER_DUP_ENTRY/,
      );
    },
  );

  it('returns a friendly 409 when the same owner submits a duplicate organization name', async () => {
    organizationModel.submit.mockRejectedValueOnce({
      code: 'ER_DUP_ENTRY',
      message: "Duplicate entry 'Local Org' for key 'uq_organizations_created_by_name'",
    });
    const res = response();

    await organizationController.submit(request({ body: { name: 'Local Org' } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0]).toEqual({
      success: false,
      message: 'An organization with this name already exists.',
    });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(
      /Duplicate entry|uq_organizations/,
    );
  });

  it.each(['Approved', 'Pending', 'Rejected'])(
    'does not disclose the conflicting organization’s %s state',
    async (_state) => {
      organizationModel.update.mockRejectedValueOnce({
        code: 'ER_DUP_ENTRY',
        errno: 1062,
        message: 'Duplicate entry for key uq_organizations_name',
      });
      const res = response();

      await organizationController.update(request({ user: { id: 2 } }), res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(
        /owner|status|"id"|Duplicate entry|uq_organizations_name/,
      );
    },
  );

  it.each([
    [
      'organization',
      organizationController,
      organizationModel,
      'Organization not found',
      'Organization not found.',
    ],
    [
      'resource person',
      resourcePersonController,
      resourcePersonModel,
      'Resource person not found',
      'Person not found.',
    ],
  ])(
    'returns the same 404 for missing and non-owner %s updates',
    async (_name, controller, model, errorMessage, message) => {
      for (const _case of ['missing', 'non-owner']) {
        model.update.mockRejectedValueOnce(new Error(errorMessage));
        const res = response();
        await controller.update(request(), res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ success: false, message });
      }
    },
  );

  it.each([
    ['organization', organizationController, organizationModel, 'Organization name is required'],
    [
      'resource person',
      resourcePersonController,
      resourcePersonModel,
      'First name and last name are required',
    ],
  ])('keeps known %s validation errors at 400', async (_name, controller, model, message) => {
    model.update.mockRejectedValueOnce(new Error(message));
    const res = response();

    await controller.update(request(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message });
  });

  it('returns 400 for malformed resource-person profession payloads', async () => {
    const error = new Error('Professions must be a JSON array');
    error.status = 400;
    resourcePersonModel.submit.mockRejectedValueOnce(error);
    const res = response();

    await resourcePersonController.submit(request(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Professions must be a JSON array',
    });
  });

  it.each([
    ['organization', organizationController, organizationModel],
    ['resource person', resourcePersonController, resourcePersonModel],
  ])('uses a generic 500 body for unexpected %s errors', async (_name, controller, model) => {
    model.update.mockRejectedValueOnce(new Error('boom'));
    const res = response();

    await controller.update(request(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Internal server error' });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('boom');
  });

  it.each([
    ['organization', organizationController, organizationModel, 'Organization not found.'],
    ['resource person', resourcePersonController, resourcePersonModel, 'Person not found.'],
  ])(
    'maps workflow review not-found errors to a %s 404',
    async (_name, controller, model, message) => {
      const error = new Error('Record not found');
      error.status = 404;
      model.review.mockRejectedValueOnce(error);
      const res = response();

      await controller.review(request({ body: { decision: 'approve' } }), res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message });
    },
  );

  it.each([
    ['organization', organizationController, organizationModel],
    ['resource person', resourcePersonController, resourcePersonModel],
  ])(
    'preserves terminal workflow status codes for %s reviews',
    async (_name, controller, model) => {
      const error = new Error('Workflow is already in a terminal state');
      error.statusCode = 409;
      model.review.mockRejectedValueOnce(error);
      const res = response();

      await controller.review(request({ body: { decision: 'approve' } }), res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Workflow is already in a terminal state',
      });
    },
  );

  it.each([
    ['organization', organizationController, organizationModel, 'list', 'listApproved'],
    ['resource person', resourcePersonController, resourcePersonModel, 'list', 'list'],
  ])(
    'returns an empty 200 list for a %s user with no records',
    async (_name, controller, model, method, modelMethod) => {
      model[modelMethod].mockResolvedValueOnce([]);
      const res = response();

      await controller[method](request(), res);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
    },
  );

  it('defaults an organization payload category, tag, and status', () => {
    expect(normalizePayload({ name: 'X' })).toMatchObject({
      category: 'Academic',
      name: 'X',
      status: 'Active',
      tag: 'General',
    });
  });

  // `funding` is an ENUM column: a value outside it would fail the whole save under strict
  // mode, so the payload keeps only the two known values and stores anything else as unknown.
  it.each([
    ['Private', 'Private'],
    ['Public', 'Public'],
    [undefined, null],
    ['', null],
    ['public', null],
    ['Government', null],
  ])('keeps funding %j as %j', (funding, expected) => {
    expect(normalizePayload({ name: 'X', funding }).funding).toBe(expected);
  });

  // 404/409/400 are expected outcomes; logging their stacks buried real faults in the log.
  it.each([
    ['organization', 404, organizationController, organizationModel, false],
    ['organization', 409, organizationController, organizationModel, false],
    ['organization', 500, organizationController, organizationModel, true],
    ['resource person', 404, resourcePersonController, resourcePersonModel, false],
    ['resource person', 409, resourcePersonController, resourcePersonModel, false],
    ['resource person', 500, resourcePersonController, resourcePersonModel, true],
  ])(
    'logs a %s %i only when it is a server fault',
    async (_name, status, controller, model, logged) => {
      const error = new Error(status === 500 ? 'database down' : 'expected outcome');
      error.status = status;
      model.update.mockRejectedValueOnce(error);
      const res = response();

      await controller.update(request({ body: { name: 'X', firstName: 'A', lastName: 'B' } }), res);

      expect(res.status).toHaveBeenCalledWith(status);
      expect(console.error).toHaveBeenCalledTimes(logged ? 1 : 0);
    },
  );
});
