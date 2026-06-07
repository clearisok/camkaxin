import { Router, Request, Response } from 'express';
import { parseId } from '../utils/params.js';
import { query } from '../config/database.js';
import { withFieldMeta, AGENT_FIELDS } from '../utils/fieldMeta.js';

const router = Router();

const AGENT_SELECT_SQL = `
  SELECT a.*, b.name AS brand_name_ref
  FROM agents a
  LEFT JOIN brands b ON b.id = a.brand_id
`;

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query(`${AGENT_SELECT_SQL} ORDER BY a.name ASC`);
    res.json({
      data: result.rows.map((row) => withFieldMeta(row as Record<string, unknown>, AGENT_FIELDS)),
      _field_meta: AGENT_FIELDS,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(`${AGENT_SELECT_SQL} WHERE a.id = $1`, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(withFieldMeta(result.rows[0] as Record<string, unknown>, AGENT_FIELDS));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, status = 'active', default_wastage = 5, brand_id } = req.body;
    const result = await query(
      'INSERT INTO agents (name, status, default_wastage, brand_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, status, default_wastage, brand_id || null]
    );
    const agentId = (result.rows[0] as { id: number }).id;
    const row = await query(`${AGENT_SELECT_SQL} WHERE a.id = $1`, [agentId]);
    res.status(201).json(withFieldMeta(row.rows[0] as Record<string, unknown>, AGENT_FIELDS));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const agentId = parseId(req.params.id);
    const { name, status, default_wastage, brand_id } = req.body;
    const result = await query(
      `UPDATE agents SET name = COALESCE($1, name), status = COALESCE($2, status),
       default_wastage = COALESCE($3, default_wastage), brand_id = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name, status, default_wastage, brand_id ?? null, agentId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    const row = await query(`${AGENT_SELECT_SQL} WHERE a.id = $1`, [agentId]);
    res.json(withFieldMeta(row.rows[0] as Record<string, unknown>, AGENT_FIELDS));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM agents WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
