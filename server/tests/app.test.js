import request from 'supertest';
import { describe, expect, it } from 'vitest';

import app from '../server.js';

describe('server app', () => {
  it('returns health status', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      environment: process.env.NODE_ENV || 'development',
    });
  });

  it('returns a JSON 404 response for unknown routes', async () => {
    const response = await request(app).get('/not-a-real-route').expect(404);

    expect(response.body).toMatchObject({
      error: 'Route not found',
      path: '/not-a-real-route',
      method: 'GET',
    });
  });

  it('handles CORS preflight requests from the local frontend', async () => {
    const response = await request(app)
      .options('/api/health')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});
