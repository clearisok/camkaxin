import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { AuthUser } from './types/auth.js';

const mockUser: AuthUser = {
  id: 1,
  username: 'admin',
  displayName: '管理员',
  isSuperAdmin: true,
  roles: ['admin'],
  permissions: ['menu.quotations.view', 'scheduling.view'],
  fieldPermissions: {},
};

vi.mock('./config/database.js', () => ({
  query: vi.fn(async (sql: string) => {
    if (sql.includes('COUNT(*)')) {
      return { rows: [{ count: '1' }] };
    }
    if (sql.includes('FROM quotations')) {
      return {
        rows: [{
          id: 1,
          quotation_no: 'Q20260001',
          status: 'draft',
          brand_name: 'BODEN',
          fabric_total: 0,
          accessory_total: 0,
          labor_rmb: 0,
        }],
      };
    }
    if (sql.includes('UPDATE users')) {
      return { rows: [] };
    }
    return { rows: [] };
  }),
}));

vi.mock('./services/authService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/authService.js')>();
  return {
    ...actual,
    login: vi.fn(async () => ({
      user: mockUser,
      token: actual.signAccessToken({ id: mockUser.id, username: mockUser.username }),
    })),
    resolveUserFromToken: vi.fn(async () => mockUser),
  };
});

vi.mock('./services/styleService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/styleService.js')>();
  return {
    ...actual,
    seedStylesIfEmpty: vi.fn(async () => undefined),
    listStyles: vi.fn(async () => ([
      {
        id: 476,
        style_number: 'D1821-1',
        brand: 'BODEN',
        quantity: 3560,
      },
    ])),
  };
});

const { createApp } = await import('./app.js');

describe('API integration', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timezone).toBe('Asia/Shanghai');
  });

  it('POST /api/auth/login returns user and sets cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'test' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe('admin');
    expect(res.body.data.token).toBeTruthy();
    expect(res.headers['set-cookie']?.[0]).toMatch(/access_token=/);
  });

  it('GET /api/quotations requires authentication', async () => {
    const res = await request(app).get('/api/quotations');
    expect(res.status).toBe(401);
  });

  it('GET /api/quotations returns list when authenticated', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'test' });
    const token = login.body.data.token as string;

    const res = await request(app)
      .get('/api/quotations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBe(1);
  });

  it('GET /api/styles returns early warning list when authenticated', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'test' });
    const token = login.body.data.token as string;

    const res = await request(app)
      .get('/api/styles?view=early_warning')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].style_number).toBe('D1821-1');
  });
});
