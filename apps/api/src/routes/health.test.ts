import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import healthRoute from './health.js';

describe('API Routes - /health', () => {
  it('should respond with status 200 and ok payload', async () => {
    const app = Fastify();
    await app.register(healthRoute);

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.payload);
    expect(json.status).toBe('ok');
    expect(json.services).toBeDefined();
  });
});
