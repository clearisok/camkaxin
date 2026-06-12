import { Router, Request, Response } from 'express';
import { parseId } from '../utils/params.js';
import {
  listStyles,
  getStyleById,
  createStyle,
  updateStyle,
  bulkUpdateStyles,
  getStyleHistory,
  getMonthlySummary,
  seedStylesIfEmpty,
} from '../services/styleService.js';
import { fillEarlyWarningGaps } from '../services/fillEarlyWarningGaps.js';
import { scheduleStyle } from '../services/scheduleStyle.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    await seedStylesIfEmpty();
    const {
      view, closing_month, brand, salesperson, group, unscheduled_only, search, sort_by, sort_order,
    } = req.query;
    const data = await listStyles({
      view: view as 'early_warning' | 'scheduling' | 'closing' | undefined,
      closing_month: closing_month as string | undefined,
      brand: brand as string | undefined,
      salesperson: salesperson as string | undefined,
      group: group as string | undefined,
      unscheduled_only: unscheduled_only === 'true' || unscheduled_only === '1',
      search: search as string | undefined,
      sort_by: sort_by as string | undefined,
      sort_order: sort_order === 'desc' ? 'desc' : sort_order === 'asc' ? 'asc' : undefined,
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

router.post('/fill-gaps', async (_req: Request, res: Response) => {
  try {
    const result = await fillEarlyWarningGaps('fill-early-warning-gaps');
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = await createStyle(req.body as Record<string, unknown>);
    res.status(201).json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
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

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const data = await getStyleById(id);
    if (!data) {
      res.status(404).json({ error: '款式不存在' });
      return;
    }
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:id/schedule', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const { changed_by, ...body } = req.body as Record<string, unknown>;
    const data = await scheduleStyle(
      id,
      body as {
        schedule_qty: number;
        required_days: number;
        is_outsourced: boolean;
        group_name?: string | null;
        outsourced_factory?: string | null;
        outsourced_price?: number | null;
        scheduling_remarks?: string | null;
      },
      (changed_by as string) || 'schedule-style',
    );
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
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
