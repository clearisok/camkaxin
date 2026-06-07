import { Router, Request, Response } from 'express';
import { parseId } from '../utils/params.js';
import { query } from '../config/database.js';
import { withFieldMeta, QUOTATION_FIELDS, ITEM_FIELDS } from '../utils/fieldMeta.js';
import {
  getQuotationFull,
  createQuotation,
  updateQuotation,
  copyQuotation,
  reviseItem,
  computeItemTotals,
} from '../services/quotationService.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, search, brand_id, agent_name, page = '1', pageSize = '20' } = req.query;
    const offset = (parseInt(page as string, 10) - 1) * parseInt(pageSize as string, 10);
    let where = 'WHERE 1=1';
    const params: unknown[] = [];
    let paramIdx = 1;

    if (status) {
      where += ` AND q.status = $${paramIdx++}`;
      params.push(status);
    }
    if (brand_id) {
      where += ` AND q.brand_id = $${paramIdx++}`;
      params.push(parseInt(brand_id as string, 10));
    }
    if (agent_name) {
      where += ` AND q.agent_name = $${paramIdx++}`;
      params.push(agent_name);
    }
    if (search) {
      where += ` AND (q.quotation_no ILIKE $${paramIdx} OR b.name ILIKE $${paramIdx} OR EXISTS (
        SELECT 1 FROM quotation_items qi
        WHERE qi.quotation_id = q.id AND qi.is_current = TRUE AND qi.product_code ILIKE $${paramIdx}
      ))`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM quotations q LEFT JOIN brands b ON q.brand_id = b.id ${where}`,
      params
    );
    const total = parseInt((countResult.rows[0] as { count: string }).count, 10);

    params.push(parseInt(pageSize as string, 10), offset);
    const result = await query(
      `SELECT q.*, b.name as brand_name,
        COALESCE(i.fabric_total, 0) as fabric_total,
        COALESCE(i.accessory_total, 0) as accessory_total,
        COALESCE(i.labor_rmb, 0) as labor_rmb,
        COALESCE(i.total_quantity, 0) as total_quantity,
        i.product_codes,
        COALESCE(NULLIF(q.style_image, ''), i.first_style_image) as list_style_image
       FROM quotations q
       LEFT JOIN brands b ON q.brand_id = b.id
       LEFT JOIN (
         SELECT quotation_id,
           SUM(fabric_total) as fabric_total,
           SUM(accessory_total) as accessory_total,
           SUM(labor_rmb) as labor_rmb,
           SUM(quantity) as total_quantity,
           string_agg(NULLIF(product_code, ''), '、' ORDER BY sort_order, id) as product_codes,
           (array_agg(style_image ORDER BY sort_order, id)
             FILTER (WHERE style_image IS NOT NULL AND style_image != ''))[1] as first_style_image
         FROM quotation_items
         WHERE is_current = TRUE
         GROUP BY quotation_id
       ) i ON i.quotation_id = q.id
       ${where} ORDER BY q.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      params
    );

    res.json({
      data: result.rows.map((row) => withFieldMeta(row as Record<string, unknown>, QUOTATION_FIELDS)),
      total,
      page: parseInt(page as string, 10),
      pageSize: parseInt(pageSize as string, 10),
      _field_meta: QUOTATION_FIELDS,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const quotation = await getQuotationFull(parseId(req.params.id));
    if (!quotation) return res.status(404).json({ error: 'Not found' });
    res.json({
      ...withFieldMeta(quotation as Record<string, unknown>, QUOTATION_FIELDS),
      items: ((quotation as { items: unknown[] }).items || []).map((item) =>
        withFieldMeta(item as Record<string, unknown>, ITEM_FIELDS)
      ),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const quotation = await createQuotation(req.body);
    res.status(201).json(quotation);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const quotation = await updateQuotation(parseId(req.params.id), req.body);
    if (!quotation) return res.status(404).json({ error: 'Not found' });
    res.json(quotation);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:id/copy', async (req: Request, res: Response) => {
  try {
    const quotation = await copyQuotation(parseId(req.params.id));
    res.status(201).json(quotation);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/items/:itemId/revise', async (req: Request, res: Response) => {
  try {
    const { update_note, ...itemData } = req.body;
    const quotation = await reviseItem(parseId(req.params.itemId), itemData, update_note);
    res.json(quotation);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/items/:itemId/snapshots', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM item_version_snapshots WHERE item_id = $1 ORDER BY version DESC',
      [req.params.itemId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const { item, exchange_rate, currency, profit_margin } = req.body;
    const result = computeItemTotals(item, exchange_rate, currency, profit_margin);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM quotations WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
