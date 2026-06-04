import { Router, Request, Response } from 'express';
import { parseId } from '../utils/params.js';
import { query } from '../config/database.js';
import { withFieldMeta, ACCESSORY_FIELDS } from '../utils/fieldMeta.js';
import { trackAccessoryUsage } from '../services/sequenceService.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT * FROM accessory_library
      WHERE status = 'active'
      ORDER BY last_used_at DESC NULLS LAST, use_count DESC, name ASC
    `);
    res.json({
      data: result.rows.map((row) => withFieldMeta(row as Record<string, unknown>, ACCESSORY_FIELDS)),
      _field_meta: ACCESSORY_FIELDS,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/all', async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM accessory_library ORDER BY name ASC');
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, reference_price, status = 'active' } = req.body;
    const result = await query(
      'INSERT INTO accessory_library (name, reference_price, status) VALUES ($1, $2, $3) RETURNING *',
      [name, reference_price, status]
    );
    res.status(201).json(withFieldMeta(result.rows[0] as Record<string, unknown>, ACCESSORY_FIELDS));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, reference_price, status } = req.body;
    const result = await query(
      `UPDATE accessory_library SET name = COALESCE($1, name), reference_price = COALESCE($2, reference_price),
       status = COALESCE($3, status), updated_at = NOW() WHERE id = $4 RETURNING *`,
      [name, reference_price, status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(withFieldMeta(result.rows[0] as Record<string, unknown>, ACCESSORY_FIELDS));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:id/track-usage', async (req: Request, res: Response) => {
  try {
    await trackAccessoryUsage(parseId(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM accessory_library WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
