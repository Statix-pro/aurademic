import { AsyncLocalStorage } from 'node:async_hooks';

// Carries per-request context (requestId, user) across async boundaries so
// logs emitted deep inside models/controllers can be correlated to a request.
const storage = new AsyncLocalStorage();

export const runWithRequestContext = (context, fn) => storage.run(context, fn);

export const getRequestContext = () => storage.getStore() || null;

export const getRequestId = () => storage.getStore()?.requestId || null;

export default storage;
