import { Router, Request, Response } from 'express';
import { parseId } from '../utils/params.js';
import {
  createCalendarException,
  deleteCalendarException,
  getCalendarExceptionById,
  getCalendarRulesSummary,
  listCalendarExceptions,
  listCalendarWithEffective,
  syncCambodiaHolidays,
  updateCalendarException,
} from '../services/calendarExceptionService.js';

const router = Router();

router.get('/rules', (_req: Request, res: Response) => {
  res.json({ data: getCalendarRulesSummary() });
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const effective = req.query.effective === 'true' || req.query.effective === '1';
    const data = effective && year
      ? await listCalendarWithEffective({ year })
      : await listCalendarExceptions({ year: Number.isFinite(year) ? year : undefined });
    res.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // #region agent log
    fetch('http://127.0.0.1:7669/ingest/daa40a17-44e4-44ed-a06e-87b0a593d701',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d04cd5'},body:JSON.stringify({sessionId:'d04cd5',location:'calendarExceptions.ts:GET/',message:'list failed',data:{error:message,year:req.query.year},timestamp:Date.now(),hypothesisId:'C',runId:'post-fix'})}).catch(()=>{});
    // #endregion
    res.status(500).json({ error: message });
  }
});

router.post('/sync-cambodia', async (req: Request, res: Response) => {
  try {
    const yearsRaw = req.body?.years ?? req.query.years;
    let years: number[] | undefined;
    if (Array.isArray(yearsRaw)) {
      years = yearsRaw.map(Number).filter((n) => Number.isFinite(n));
    } else if (typeof yearsRaw === 'string' && yearsRaw.trim()) {
      years = yearsRaw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
    }
    const result = await syncCambodiaHolidays(years);
    res.json({ data: result, message: `已同步 ${result.inserted} 条时间段` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = await createCalendarException(req.body);
    res.status(201).json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const existing = await getCalendarExceptionById(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = await updateCalendarException(id, req.body);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const ok = await deleteCalendarException(id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
