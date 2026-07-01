import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import { upload, compressImage, processVideo, getRelativePath } from '../middleware/upload.js';
import { exportQuotationToExcel } from '../services/excelExport.js';
import {
  createExportTemplate,
  deleteExportTemplate,
  getExportTemplateById,
  listExportTemplates,
  updateExportTemplate,
  type ExportTemplateConfig,
  type ExportTemplateView,
} from '../services/exportTemplateService.js';
import path from 'path';
import fs from 'fs';
import {
  getClosingIncludeProcessing,
  setClosingIncludeProcessing,
} from '../services/settingsService.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM settings ORDER BY key');
    const settings: Record<string, string> = {};
    for (const row of result.rows) {
      settings[(row as { key: string; value: string }).key] = (row as { key: string; value: string }).value;
    }
    res.json({ data: settings });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/exchange-rate', async (req: Request, res: Response) => {
  try {
    const { value } = req.body;
    const rate = parseFloat(value);
    if (isNaN(rate) || rate <= 0) {
      return res.status(400).json({ error: 'Invalid exchange rate' });
    }
    await query(
      `INSERT INTO settings (key, value, updated_at) VALUES ('usd_to_rmb_rate', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [rate.toFixed(4)]
    );
    res.json({ key: 'usd_to_rmb_rate', value: rate.toFixed(4) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/closing-include-processing', async (req: Request, res: Response) => {
  try {
    const { value } = req.body as { value?: boolean };
    if (typeof value !== 'boolean') {
      return res.status(400).json({ error: 'value 须为 boolean' });
    }
    await setClosingIncludeProcessing(value);
    res.json({ key: 'closing_include_processing', value });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/closing-settings', async (_req: Request, res: Response) => {
  try {
    const include = await getClosingIncludeProcessing();
    res.json({ data: { closing_include_processing: include } });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/templates', async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM excel_templates ORDER BY is_default DESC, created_at DESC');
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/templates', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const destPath = path.join('./uploads/templates', req.file.filename);
    fs.renameSync(req.file.path, destPath);

    const { name, is_default = false } = req.body;
    if (is_default === 'true' || is_default === true) {
      await query('UPDATE excel_templates SET is_default = FALSE');
    }

    const result = await query(
      `INSERT INTO excel_templates (name, file_path, is_default) VALUES ($1, $2, $3) RETURNING *`,
      [name || req.file.originalname, getRelativePath(destPath), is_default === 'true' || is_default === true]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT file_path FROM excel_templates WHERE id = $1', [req.params.id]);
    if (result.rows[0]) {
      const fp = (result.rows[0] as { file_path: string }).file_path;
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await query('DELETE FROM excel_templates WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/early-warning-export-templates', async (_req: Request, res: Response) => {
  try {
    const data = await listEarlyWarningExportTemplates();
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.get('/early-warning-export-templates', async (_req: Request, res: Response) => {
  try {
    const data = await listExportTemplates('early_warning');
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.get('/scheduling-export-templates', async (_req: Request, res: Response) => {
  try {
    const data = await listExportTemplates('scheduling');
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.get('/scheduling-export-templates/:id', async (req: Request, res: Response) => {
  try {
    const tpl = await getExportTemplateById(Number(req.params.id));
    if (!tpl || tpl.view !== 'scheduling') {
      res.status(404).json({ error: '模板不存在' });
      return;
    }
    res.json({ data: tpl });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.post('/scheduling-export-templates', async (req: Request, res: Response) => {
  try {
    const { name, config, is_default } = req.body as {
      name?: string;
      config?: ExportTemplateConfig;
      is_default?: boolean;
    };
    if (!name?.trim()) {
      res.status(400).json({ error: '模板名称不能为空' });
      return;
    }
    if (!config) {
      res.status(400).json({ error: '模板配置不能为空' });
      return;
    }
    const created = await createExportTemplate('scheduling', name, config, Boolean(is_default));
    res.status(201).json({ data: created });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.put('/scheduling-export-templates/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, config, is_default } = req.body as {
      name?: string;
      config?: ExportTemplateConfig;
      is_default?: boolean;
    };
    const existing = await getExportTemplateById(id);
    if (!existing || existing.view !== 'scheduling') {
      res.status(404).json({ error: '模板不存在' });
      return;
    }
    const updated = await updateExportTemplate(id, { name, config, is_default });
    res.json({ data: updated });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.delete('/scheduling-export-templates/:id', async (req: Request, res: Response) => {
  try {
    const existing = await getExportTemplateById(Number(req.params.id));
    if (!existing || existing.view !== 'scheduling') {
      res.status(404).json({ error: '模板不存在' });
      return;
    }
    await deleteExportTemplate(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/early-warning-export-templates/:id', async (req: Request, res: Response) => {
  try {
    const tpl = await getExportTemplateById(Number(req.params.id));
    if (!tpl || tpl.view !== 'early_warning') {
      res.status(404).json({ error: '模板不存在' });
      return;
    }
    res.json({ data: tpl });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.post('/early-warning-export-templates', async (req: Request, res: Response) => {
  try {
    const { name, config, is_default } = req.body as {
      name?: string;
      config?: ExportTemplateConfig;
      is_default?: boolean;
    };
    if (!name?.trim()) {
      res.status(400).json({ error: '模板名称不能为空' });
      return;
    }
    if (!config) {
      res.status(400).json({ error: '模板配置不能为空' });
      return;
    }
    const created = await createExportTemplate('early_warning', name, config, Boolean(is_default));
    res.status(201).json({ data: created });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.put('/early-warning-export-templates/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, config, is_default } = req.body as {
      name?: string;
      config?: ExportTemplateConfig;
      is_default?: boolean;
    };
    const updated = await updateExportTemplate(id, { name, config, is_default });
    if (!updated) {
      res.status(404).json({ error: '模板不存在' });
      return;
    }
    res.json({ data: updated });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.delete('/early-warning-export-templates/:id', async (req: Request, res: Response) => {
  try {
    const ok = await deleteExportTemplate(Number(req.params.id));
    if (!ok) {
      res.status(404).json({ error: '模板不存在' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext)) {
      filePath = await compressImage(filePath);
    } else if (['.mp4', '.avi', '.mov', '.webm', '.mkv'].includes(ext)) {
      filePath = await processVideo(filePath);
    }

    res.json({
      path: getRelativePath(filePath),
      originalName: req.file.originalname,
      size: req.file.size,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/export-excel', async (req: Request, res: Response) => {
  try {
    const { quotation_id, template_id, split_by_item = false, filename: customFilename } = req.body;

    let templatePath: string;
    if (template_id) {
      const tpl = await query('SELECT file_path FROM excel_templates WHERE id = $1', [template_id]);
      if (!tpl.rows[0]) return res.status(404).json({ error: 'Template not found' });
      templatePath = (tpl.rows[0] as { file_path: string }).file_path;
    } else {
      const tpl = await query('SELECT file_path FROM excel_templates WHERE is_default = TRUE LIMIT 1');
      if (!tpl.rows[0]) return res.status(404).json({ error: 'No default template found' });
      templatePath = (tpl.rows[0] as { file_path: string }).file_path;
    }

    const { buildExportData } = await import('../services/quotationService.js');
    const { exportQuotationToExcel, buildQuotationExportFilename } = await import('../services/excelExport.js');
    const exportData = await buildExportData(quotation_id);

    const buffer = await exportQuotationToExcel(templatePath, exportData as Parameters<typeof exportQuotationToExcel>[1], {
      splitByItem: split_by_item,
    });

    const fname = buildQuotationExportFilename(exportData as Parameters<typeof buildQuotationExportFilename>[0], customFilename);
    const encoded = encodeURIComponent(fname);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/export-summary', async (req: Request, res: Response) => {
  try {
    const { quotation_ids } = req.body as { quotation_ids: number[] };
    if (!quotation_ids?.length) {
      return res.status(400).json({ error: '请选择至少一个报价单' });
    }

    const { exportSummaryExcel, buildSummaryFilename } = await import('../services/summaryExport.js');
    const buffer = await exportSummaryExcel(quotation_ids);
    const fname = buildSummaryFilename();
    const encoded = encodeURIComponent(fname);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/export-filename/:quotationId', async (req: Request, res: Response) => {
  try {
    const { buildExportData } = await import('../services/quotationService.js');
    const { buildQuotationExportFilename } = await import('../services/excelExport.js');
    const exportData = await buildExportData(Number(req.params.quotationId));
    res.json({ filename: buildQuotationExportFilename(exportData as Parameters<typeof buildQuotationExportFilename>[0]) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
