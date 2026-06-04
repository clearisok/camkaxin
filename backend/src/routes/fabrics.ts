import { Router, Request, Response } from 'express';
import { parseId } from '../utils/params.js';
import { query } from '../config/database.js';
import { withFieldMeta, FABRIC_FIELDS } from '../utils/fieldMeta.js';
import { calcGrossWidth } from '../utils/calculation.js';
import { trackFabricUsage } from '../services/sequenceService.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT *, (net_width + 5) as gross_width
      FROM fabric_library
      WHERE status = 'active'
      ORDER BY last_used_at DESC NULLS LAST, use_count DESC, name ASC
    `);
    res.json({
      data: result.rows.map((row) => withFieldMeta(row as Record<string, unknown>, FABRIC_FIELDS)),
      _field_meta: FABRIC_FIELDS,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/all', async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT *, (net_width + 5) as gross_width FROM fabric_library ORDER BY name ASC
    `);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, composition, weight, net_width, unit = 'meter', reference_price, status = 'active' } = req.body;
    const result = await query(
      `INSERT INTO fabric_library (name, composition, weight, net_width, unit, reference_price, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, composition, weight, net_width, unit, reference_price, status]
    );
    const row = result.rows[0] as Record<string, unknown>;
    row.gross_width = calcGrossWidth(Number(net_width || 0));
    res.status(201).json(withFieldMeta(row, FABRIC_FIELDS));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, composition, weight, net_width, unit, reference_price, status } = req.body;
    const result = await query(
      `UPDATE fabric_library SET
        name = COALESCE($1, name), composition = COALESCE($2, composition),
        weight = COALESCE($3, weight), net_width = COALESCE($4, net_width),
        unit = COALESCE($5, unit), reference_price = COALESCE($6, reference_price),
        status = COALESCE($7, status), updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [name, composition, weight, net_width, unit, reference_price, status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(withFieldMeta(result.rows[0] as Record<string, unknown>, FABRIC_FIELDS));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:id/track-usage', async (req: Request, res: Response) => {
  try {
    await trackFabricUsage(parseId(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM fabric_library WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
