import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import { withFieldMeta, AGENT_FIELDS, BRAND_FIELDS } from '../utils/fieldMeta.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM agents ORDER BY name ASC'
    );
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
    const result = await query('SELECT * FROM agents WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(withFieldMeta(result.rows[0] as Record<string, unknown>, AGENT_FIELDS));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, status = 'active' } = req.body;
    const result = await query(
      'INSERT INTO agents (name, status) VALUES ($1, $2) RETURNING *',
      [name, status]
    );
    res.status(201).json(withFieldMeta(result.rows[0] as Record<string, unknown>, AGENT_FIELDS));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, status } = req.body;
    const result = await query(
      'UPDATE agents SET name = COALESCE($1, name), status = COALESCE($2, status), updated_at = NOW() WHERE id = $3 RETURNING *',
      [name, status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(withFieldMeta(result.rows[0] as Record<string, unknown>, AGENT_FIELDS));
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
