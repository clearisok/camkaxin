import { Router, type Request, type Response } from 'express';
import { cookieOptions, COOKIE_NAME, login } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    const { user, token } = await login(String(username ?? ''), String(password ?? ''));
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.json({ data: { user, token } });
  } catch (err) {
    res.status(400).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

router.post('/logout', requireAuth, (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ data: { ok: true } });
});

router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ data: { user: req.user } });
});

export default router;
