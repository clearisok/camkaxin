import { Router, Request, Response } from 'express';
import { parseId } from '../utils/params.js';
import { query } from '../config/database.js';
import { withFieldMeta, BRAND_FIELDS } from '../utils/fieldMeta.js';
import { trackBrandUsage } from '../services/sequenceService.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT b.*, a.name as agent_name_ref
      FROM brands b
      LEFT JOIN agents a ON b.agent_id = a.id
      ORDER BY b.last_used_at DESC NULLS LAST, b.use_count DESC, b.name ASC
    `);
    res.json({
      data: result.rows.map((row) => withFieldMeta(row as Record<string, unknown>, BRAND_FIELDS)),
      _field_meta: BRAND_FIELDS,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT b.*, a.name as agent_name_ref FROM brands b
       LEFT JOIN agents a ON b.agent_id = a.id WHERE b.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(withFieldMeta(result.rows[0] as Record<string, unknown>, BRAND_FIELDS));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id/default-accessories', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM brand_default_accessories WHERE brand_id = $1 ORDER BY sort_order',
      [req.params.id]
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, agent_id, status = 'active' } = req.body;
    const result = await query(
      'INSERT INTO brands (name, agent_id, status) VALUES ($1, $2, $3) RETURNING *',
      [name, agent_id, status]
    );
    res.status(201).json(withFieldMeta(result.rows[0] as Record<string, unknown>, BRAND_FIELDS));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, agent_id, status } = req.body;
    const result = await query(
      `UPDATE brands SET name = COALESCE($1, name), agent_id = COALESCE($2, agent_id),
       status = COALESCE($3, status), updated_at = NOW() WHERE id = $4 RETURNING *`,
      [name, agent_id, status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(withFieldMeta(result.rows[0] as Record<string, unknown>, BRAND_FIELDS));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:id/track-usage', async (req: Request, res: Response) => {
  try {
    await trackBrandUsage(parseId(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id/default-accessories', async (req: Request, res: Response) => {
  try {
    const brandId = parseId(req.params.id);
    const accessories = req.body.accessories || [];

    await query('DELETE FROM brand_default_accessories WHERE brand_id = $1', [brandId]);

    for (let i = 0; i < accessories.length; i++) {
      const acc = accessories[i];
      await query(
        `INSERT INTO brand_default_accessories (brand_id, name, consumption, wastage, unit_price, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [brandId, acc.name, acc.consumption ?? 1, acc.wastage ?? 5, acc.unit_price ?? 0, i]
      );
    }

    const result = await query(
      'SELECT * FROM brand_default_accessories WHERE brand_id = $1 ORDER BY sort_order',
      [brandId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM brands WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
