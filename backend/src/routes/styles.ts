import { Router, Request, Response } from 'express';
import { parseId } from '../utils/params.js';
import {
  listStyles,
  updateStyle,
  bulkUpdateStyles,
  getStyleHistory,
  getMonthlySummary,
  seedStylesIfEmpty,
} from '../services/styleService.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    await seedStylesIfEmpty();
    const { view, closing_month, group, unscheduled_only, search } = req.query;
    const data = await listStyles({
      view: view as 'early_warning' | 'scheduling' | 'closing' | undefined,
      closing_month: closing_month as string | undefined,
      group: group as string | undefined,
      unscheduled_only: unscheduled_only === 'true' || unscheduled_only === '1',
      search: search as string | undefined,
    });
    res.json({ data });
  } catch (err) {
    // #region agent log
    import('../utils/debugLog.js').then(({ debugLog }) => debugLog('styles.ts:GET/', 'styles list failed', { error: String(err), code: (err as { code?: string }).code, view: req.query.view }, 'H2')).catch(() => {});
    // #endregion
    res.status(500).json({ error: String(err) });
  }
});

router.get('/monthly-summary', async (_req: Request, res: Response) => {
  try {
    const data = await getMonthlySummary();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/bulk', async (req: Request, res: Response) => {
  try {
    const { updates, changed_by } = req.body as {
      updates: Array<{ id: number } & Record<string, unknown>>;
      changed_by?: string;
    };
    if (!Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({ error: 'updates array required' });
      return;
    }
    const data = await bulkUpdateStyles(updates, changed_by || 'system');
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const data = await getStyleHistory(id);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const { changed_by, ...body } = req.body as Record<string, unknown>;
    const data = await updateStyle(id, body, (changed_by as string) || 'system');
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
