import { Fragment, useCallback, useEffect, useState } from 'react';

import authenticityUtility from '../../../shared/utils/authenticityUtility';

interface RouteStat {
  route: string;
  count: number;
  errors4xx: number;
  errors5xx: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

interface SlowQuery {
  time: string;
  durationMs: number;
  requestId: string | null;
  sql: string;
}

interface RecentRequest {
  time: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  requestId: string;
  userId: number | null;
}

interface MetricsData {
  startedAt: string;
  uptimeSeconds: number;
  process: { rssMb: number; heapUsedMb: number; heapTotalMb: number; nodeVersion: string };
  db: { totalQueries: number; totalErrors: number; avgMs: number; slowQueries: SlowQuery[] };
  routes: RouteStat[];
  recentRequests: RecentRequest[];
}

interface ServerError {
  time: string;
  requestId?: string | null;
  method?: string;
  path?: string;
  statusCode?: number;
  message: string;
  stack?: string;
  source?: string;
  userId?: number | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

interface ClientError {
  time: string;
  sessionId: string;
  userEmail: string | null;
  url: string;
  source: string;
  message: string;
  stack?: string;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

interface WebVital {
  time: string;
  sessionId: string;
  url: string;
  name: string;
  value: number;
  rating: string;
}

type ApiResponse<T> = { success: boolean; data: T };

type Tab = 'metrics' | 'errors' | 'vitals';

const formatTime = (iso: string) => new Date(iso).toLocaleString();

const statusBadge = (status: number) =>
  status >= 500 ? 'bg-danger' : status >= 400 ? 'bg-warning text-dark' : 'bg-success';

const parseUserAgent = (ua?: string | null) => {
  if (!ua) return { browser: 'Unknown', os: 'Unknown' };

  let browser = 'Unknown';
  if (ua.includes('Edg/')) browser = `Edge ${ua.match(/Edg\/(\d+)/)?.[1] || ''}`;
  else if (ua.includes('Chrome/')) browser = `Chrome ${ua.match(/Chrome\/(\d+)/)?.[1] || ''}`;
  else if (ua.includes('Firefox/')) browser = `Firefox ${ua.match(/Firefox\/(\d+)/)?.[1] || ''}`;
  else if (ua.includes('Safari/') && !ua.includes('Chrome'))
    browser = `Safari ${ua.match(/Version\/(\d+)/)?.[1] || ''}`;

  let os = 'Unknown';
  if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11';
  else if (ua.includes('Windows NT')) os = 'Windows (Older)';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return { browser, os };
};

const ratingBadge = (rating: string) =>
  rating === 'good'
    ? 'bg-success'
    : rating === 'needs-improvement'
      ? 'bg-warning text-dark'
      : rating === 'poor'
        ? 'bg-danger'
        : 'bg-secondary';

const ObservabilityPage = () => {
  const [tab, setTab] = useState<Tab>('metrics');
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [serverErrors, setServerErrors] = useState<ServerError[]>([]);
  const [clientErrors, setClientErrors] = useState<ClientError[]>([]);
  const [vitals, setVitals] = useState<WebVital[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedError, setExpandedError] = useState<string | null>(null);

  const loadTab = useCallback(async (nextTab: Tab) => {
    setLoading(true);
    try {
      if (nextTab === 'metrics') {
        const res = (await authenticityUtility.get(
          '/observability/metrics',
        )) as unknown as ApiResponse<MetricsData>;
        setMetrics(res.data);
      } else if (nextTab === 'errors') {
        const res = (await authenticityUtility.get(
          '/observability/errors',
        )) as unknown as ApiResponse<{ serverErrors: ServerError[]; clientErrors: ClientError[] }>;
        setServerErrors(res.data.serverErrors);
        setClientErrors(res.data.clientErrors);
      } else if (nextTab === 'vitals') {
        const res = (await authenticityUtility.get(
          '/observability/vitals',
        )) as unknown as ApiResponse<WebVital[]>;
        setVitals(res.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTab(tab);
  }, [tab, loadTab]);

  const renderMetrics = () =>
    metrics && (
      <>
        <div className="row g-3 mb-4">
          <div className="col-6 col-md-3">
            <div className="card h-100">
              <div className="card-body">
                <div className="text-muted small">Uptime</div>
                <div className="fs-5 fw-semibold">
                  {Math.floor(metrics.uptimeSeconds / 3600)}h{' '}
                  {Math.floor((metrics.uptimeSeconds % 3600) / 60)}m
                </div>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card h-100">
              <div className="card-body">
                <div className="text-muted small">Memory (RSS / heap)</div>
                <div className="fs-5 fw-semibold">
                  {metrics.process.rssMb} MB / {metrics.process.heapUsedMb} MB
                </div>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card h-100">
              <div className="card-body">
                <div className="text-muted small">DB queries (avg)</div>
                <div className="fs-5 fw-semibold">
                  {metrics.db.totalQueries.toLocaleString()} ({metrics.db.avgMs} ms)
                </div>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card h-100">
              <div className="card-body">
                <div className="text-muted small">DB errors</div>
                <div className="fs-5 fw-semibold">{metrics.db.totalErrors}</div>
              </div>
            </div>
          </div>
        </div>

        <h6>API latency by route (since server start)</h6>
        <div className="table-responsive mb-4" style={{ maxHeight: 360, overflowY: 'auto' }}>
          <table className="table table-sm table-hover align-middle">
            <thead className="table-light" style={{ position: 'sticky', top: 0 }}>
              <tr>
                <th>Route</th>
                <th className="text-end">Calls</th>
                <th className="text-end">4xx</th>
                <th className="text-end">5xx</th>
                <th className="text-end">Avg</th>
                <th className="text-end">p50</th>
                <th className="text-end">p95</th>
                <th className="text-end">p99</th>
                <th className="text-end">Max</th>
              </tr>
            </thead>
            <tbody>
              {metrics.routes.map((r) => (
                <tr key={r.route}>
                  <td className="font-monospace small">{r.route}</td>
                  <td className="text-end">{r.count}</td>
                  <td className="text-end">{r.errors4xx || ''}</td>
                  <td className={`text-end ${r.errors5xx ? 'text-danger fw-bold' : ''}`}>
                    {r.errors5xx || ''}
                  </td>
                  <td className="text-end">{r.avgMs} ms</td>
                  <td className="text-end">{r.p50Ms} ms</td>
                  <td className="text-end">{r.p95Ms} ms</td>
                  <td className="text-end">{r.p99Ms} ms</td>
                  <td className="text-end">{r.maxMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h6>Slow DB queries</h6>
        {metrics.db.slowQueries.length === 0 ? (
          <p className="text-muted">No slow queries recorded.</p>
        ) : (
          <div className="table-responsive mb-4" style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table className="table table-sm align-middle">
              <thead className="table-light" style={{ position: 'sticky', top: 0 }}>
                <tr>
                  <th>Time</th>
                  <th className="text-end">Duration</th>
                  <th>Request</th>
                  <th>SQL</th>
                </tr>
              </thead>
              <tbody>
                {metrics.db.slowQueries.map((q, i) => (
                  <tr key={`${q.time}-${i}`}>
                    <td className="text-nowrap small">{formatTime(q.time)}</td>
                    <td className="text-end text-danger">{q.durationMs} ms</td>
                    <td className="font-monospace small">{q.requestId?.slice(0, 8) || '—'}</td>
                    <td className="font-monospace small">{q.sql}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h6>Recent requests (trace log)</h6>
        <div className="table-responsive" style={{ maxHeight: 360, overflowY: 'auto' }}>
          <table className="table table-sm table-hover align-middle">
            <thead className="table-light" style={{ position: 'sticky', top: 0 }}>
              <tr>
                <th>Time</th>
                <th>Request ID</th>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th className="text-end">Duration</th>
                <th>User</th>
              </tr>
            </thead>
            <tbody>
              {metrics.recentRequests.map((r) => (
                <tr key={r.requestId + r.time}>
                  <td className="text-nowrap small">{formatTime(r.time)}</td>
                  <td className="font-monospace small">{r.requestId.slice(0, 8)}</td>
                  <td>{r.method}</td>
                  <td className="font-monospace small">{r.path}</td>
                  <td>
                    <span className={`badge ${statusBadge(r.statusCode)}`}>{r.statusCode}</span>
                  </td>
                  <td className="text-end">{r.durationMs} ms</td>
                  <td className="small">{r.userId ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );

  const renderErrorTable = (errors: (ServerError | ClientError)[], keyPrefix: string) =>
    errors.length === 0 ? (
      <p className="text-muted">No errors recorded.</p>
    ) : (
      <div className="table-responsive mb-4" style={{ maxHeight: 400, overflowY: 'auto' }}>
        <table className="table table-sm table-hover align-middle">
          <thead className="table-light" style={{ position: 'sticky', top: 0 }}>
            <tr>
              <th>Time</th>
              <th>Source / Path</th>
              <th>Message</th>
              <th>Request ID</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((e, i) => {
              const rowKey = `${keyPrefix}-${i}`;
              const source =
                'path' in e && e.path
                  ? `${(e as ServerError).method || ''} ${e.path}`
                  : e.source || '';
              return (
                <Fragment key={rowKey}>
                  <tr
                    style={{ cursor: 'pointer' }}
                    onClick={() => setExpandedError(expandedError === rowKey ? null : rowKey)}
                  >
                    <td className="text-nowrap small">{formatTime(e.time)}</td>
                    <td className="font-monospace small">{source}</td>
                    <td className="small text-truncate" style={{ maxWidth: 300 }}>
                      {e.message}
                    </td>
                    <td className="font-monospace small">{e.requestId?.slice(0, 8) || '—'}</td>
                  </tr>
                  {expandedError === rowKey && (
                    <tr>
                      <td colSpan={4} className="p-0 border-0">
                        <div
                          className="bg-light p-3 border-bottom"
                          style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}
                        >
                          <div className="row g-3 small mb-3">
                            <div className="col-md-6">
                              <div className="fw-bold text-muted mb-1">Time</div>
                              <div>{formatTime(e.time)}</div>
                            </div>
                            <div className="col-md-6">
                              <div className="fw-bold text-muted mb-1">Request ID</div>
                              <div className="font-monospace">{e.requestId || '—'}</div>
                            </div>

                            {'userId' in e ? (
                              <div className="col-md-6">
                                <div className="fw-bold text-muted mb-1">User (Server)</div>
                                <div>
                                  {e.userName ||
                                    e.userEmail ||
                                    (e.userId ? `User ID: ${e.userId}` : 'Unknown')}
                                  {e.userRole && (
                                    <span className="ms-2 badge bg-secondary">{e.userRole}</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="col-md-6">
                                <div className="fw-bold text-muted mb-1">User (Client)</div>
                                <div>{(e as ClientError).userEmail || 'Anonymous'}</div>
                              </div>
                            )}

                            <div className="col-md-6">
                              <div className="fw-bold text-muted mb-1">Path / URL</div>
                              <div className="font-monospace">
                                {'path' in e ? e.path : (e as ClientError).url}
                              </div>
                            </div>

                            <div className="col-md-6">
                              <div className="fw-bold text-muted mb-1">API / Method</div>
                              <div className="font-monospace">
                                {'method' in e ? e.method : (e as ClientError).source}
                                {'statusCode' in e && (
                                  <span
                                    className={`ms-2 badge ${statusBadge(e.statusCode as number)}`}
                                  >
                                    {e.statusCode}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="col-md-6">
                              <div className="fw-bold text-muted mb-1">Client Details</div>
                              <div>
                                {(() => {
                                  const ua = parseUserAgent(e.userAgent);
                                  return `${ua.browser} on ${ua.os}`;
                                })()}
                                {e.ip && <span className="ms-2 text-muted">({e.ip})</span>}
                              </div>
                            </div>
                          </div>

                          <div className="fw-bold text-muted mb-1 small">Error</div>
                          <div className="mb-2 fw-semibold text-break">{e.message}</div>

                          {e.stack && (
                            <>
                              <div className="fw-bold text-muted mb-1 small">Stack Trace</div>
                              <pre
                                className="p-3 bg-white border rounded small font-monospace"
                                style={{
                                  whiteSpace: 'pre-wrap',
                                  maxHeight: 300,
                                  overflowY: 'auto',
                                }}
                              >
                                {e.stack}
                              </pre>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );

  const renderVitals = () =>
    vitals.length === 0 ? (
      <p className="text-muted">No web vitals recorded yet.</p>
    ) : (
      <div className="table-responsive" style={{ maxHeight: 500, overflowY: 'auto' }}>
        <table className="table table-sm table-hover align-middle">
          <thead className="table-light" style={{ position: 'sticky', top: 0 }}>
            <tr>
              <th>Time</th>
              <th>Metric</th>
              <th className="text-end">Value</th>
              <th>Rating</th>
              <th>Page</th>
              <th>Session</th>
            </tr>
          </thead>
          <tbody>
            {vitals.map((v, i) => (
              <tr key={`${v.time}-${i}`}>
                <td className="text-nowrap small">{formatTime(v.time)}</td>
                <td className="fw-semibold">{v.name}</td>
                <td className="text-end">
                  {v.name === 'CLS' ? v.value : `${Math.round(v.value)} ms`}
                </td>
                <td>
                  <span className={`badge ${ratingBadge(v.rating)}`}>{v.rating}</span>
                </td>
                <td className="font-monospace small">{v.url}</td>
                <td className="font-monospace small">{v.sessionId.slice(0, 8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Observability</h4>
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => loadTab(tab)}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <ul className="nav nav-tabs mb-3">
        {(
          [
            ['metrics', 'Performance & Tracing'],
            ['errors', 'Errors'],
            ['vitals', 'Web Vitals'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <li className="nav-item" key={key}>
            <button
              className={`nav-link ${tab === key ? 'active' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>

      {tab === 'metrics' && renderMetrics()}
      {tab === 'errors' && (
        <>
          <h6>Server errors (5xx & crashes)</h6>
          {renderErrorTable(serverErrors, 'server')}
          <h6>Browser errors</h6>
          {renderErrorTable(clientErrors, 'client')}
        </>
      )}
      {tab === 'vitals' && renderVitals()}
    </div>
  );
};

export default ObservabilityPage;
