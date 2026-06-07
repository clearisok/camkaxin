import { Router, Request, Response } from 'express';
import { parseId } from '../utils/params.js';
import { query } from '../config/database.js';
import { withFieldMeta, BRAND_FIELDS } from '../utils/fieldMeta.js';
import { trackBrandUsage } from '../services/sequenceService.js';

const router = Router();

const BRAND_WITH_AGENTS_SQL = `
  SELECT b.*,
    COALESCE(
      json_agg(
        json_build_object(
          'id', a.id,
          'name', a.name,
          'default_wastage', a.default_wastage,
          'status', a.status
        ) ORDER BY a.name
      ) FILTER (WHERE a.id IS NOT NULL),
      '[]'
    ) AS agents
  FROM brands b
  LEFT JOIN agents a ON a.brand_id = b.id
`;

async function getBrandById(id: number) {
  const result = await query(
    `${BRAND_WITH_AGENTS_SQL} WHERE b.id = $1 GROUP BY b.id`,
    [id]
  );
  return result.rows[0] as Record<string, unknown> | undefined;
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      ${BRAND_WITH_AGENTS_SQL}
      GROUP BY b.id
      ORDER BY b.last_used_at DESC NULLS LAST, b.use_count DESC, b.name ASC
    `);
    res.json({
      data: result.rows.map((row) => withFieldMeta(row as Record<string, unknown>, BRAND_FIELDS)),
      _field_meta: BRAND_FIELDS,
    });
  } catch (err) {
    // #region agent log
    import('../utils/debugLog.js').then(({ debugLog }) => debugLog('brands.ts:GET/', 'brands list failed', { error: String(err), code: (err as { code?: string }).code }, 'H1')).catch(() => {});
    // #endregion
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const row = await getBrandById(parseId(req.params.id));
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(withFieldMeta(row, BRAND_FIELDS));
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
    const { name, status = 'active' } = req.body;
    const result = await query(
      'INSERT INTO brands (name, status) VALUES ($1, $2) RETURNING *',
      [name, status]
    );
    const brandId = (result.rows[0] as { id: number }).id;
    const row = await getBrandById(brandId);
    res.status(201).json(withFieldMeta(row as Record<string, unknown>, BRAND_FIELDS));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const brandId = parseId(req.params.id);
    const { name, status } = req.body;
    const result = await query(
      `UPDATE brands SET name = COALESCE($1, name),
       status = COALESCE($2, status), updated_at = NOW() WHERE id = $3 RETURNING *`,
      [name, status, brandId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    const row = await getBrandById(brandId);
    res.json(withFieldMeta(row as Record<string, unknown>, BRAND_FIELDS));
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
