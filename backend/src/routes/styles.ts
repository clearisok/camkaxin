import { Router, Request, Response } from 'express';
import { parseId } from '../utils/params.js';
import {
  listStyles,
  listStyleFieldOptions,
  getStyleById,
  createStyle,
  updateStyle,
  bulkUpdateStyles,
  getStyleHistory,
  getMonthlySummary,
  seedStylesIfEmpty,
  type StyleListQuery,
} from '../services/styleService.js';
import { fillEarlyWarningGaps } from '../services/fillEarlyWarningGaps.js';
import { scheduleStyle } from '../services/scheduleStyle.js';
import {
  moveStyleToTarget,
  reorderStyleInGroup,
  offlineStyle,
  extendStyleWorkdays,
  listOfflineNotifications,
  batchConfirmOffline,
  batchExtendWorkdays,
  previewOutsourceDates,
  outsourceExistingStyle,
} from '../services/schedulingOperations.js';
import { previewSandboxScheduling } from '../services/sandboxPreview.js';
import {
  assertFieldsEditable,
  collectStyleFieldCodes,
} from '../services/fieldPermissionService.js';
import {
  listClosingLocks,
  lockClosingMonth,
  unlockClosingMonth,
} from '../services/closingLockService.js';
import {
  buildEarlyWarningExportFilename,
  exportEarlyWarningExcel,
  type EarlyWarningExportMeta,
} from '../services/earlyWarningExport.js';
import {
  listExportTemplates,
  resolveExportColumns,
  resolveTemplateForExport,
  type ExportTemplateView,
} from '../services/exportTemplateService.js';
import {
  buildSchedulingExportFilename,
  exportSchedulingExcel,
  type SchedulingExportMeta,
} from '../services/schedulingExport.js';
import { cancelStyleOrder } from '../services/styleCancelService.js';

const router = Router();

router.get('/closing-locks', async (_req: Request, res: Response) => {
  try {
    const data = await listClosingLocks();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/closing-locks', async (req: Request, res: Response) => {
  try {
    const { closing_month } = req.body as { closing_month?: string };
    const changedBy = req.user?.username ?? 'system';
    const data = await lockClosingMonth(String(closing_month ?? ''), changedBy);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.delete('/closing-locks/:month', async (req: Request, res: Response) => {
  try {
    const month = decodeURIComponent(req.params.month);
    await unlockClosingMonth(month);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.get('/offline-notifications', async (_req: Request, res: Response) => {
  try {
    const data = await listOfflineNotifications();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/scheduling/preview-outsource-dates', async (req: Request, res: Response) => {
  try {
    const data = await previewOutsourceDates(req.body as {
      online_time?: string | null;
      offline_time?: string | null;
      required_days?: number | null;
    });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.post('/scheduling/batch-offline', async (req: Request, res: Response) => {
  try {
    const { ids, changed_by } = req.body as { ids: number[]; changed_by?: string };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids array required' });
      return;
    }
    const data = await batchConfirmOffline(ids, changed_by || 'batch-offline');
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.post('/scheduling/batch-extend', async (req: Request, res: Response) => {
  try {
    const { items, changed_by } = req.body as {
      items: Array<{ id: number; extra_workdays: number }>;
      changed_by?: string;
    };
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'items array required' });
      return;
    }
    const data = await batchExtendWorkdays(items, changed_by || 'batch-extend');
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.post('/scheduling/sandbox-preview', async (req: Request, res: Response) => {
  try {
    const { ops } = req.body as { ops?: Array<Record<string, unknown>> };
    if (!Array.isArray(ops)) {
      res.status(400).json({ error: 'ops array required' });
      return;
    }
    const data = await previewSandboxScheduling(ops as Parameters<typeof previewSandboxScheduling>[0]);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.get('/field-options', async (req: Request, res: Response) => {
  try {
    const { field, view, closing_month, unscheduled_only, q } = req.query;
    if (!field || typeof field !== 'string') {
      res.status(400).json({ error: 'field required' });
      return;
    }
    const data = await listStyleFieldOptions(field, {
      view: view as StyleListQuery['view'],
      closing_month: closing_month as string | undefined,
      unscheduled_only: unscheduled_only === 'true' || unscheduled_only === '1',
      q: q as string | undefined,
    });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.get('/export-templates', async (req: Request, res: Response) => {
  try {
    const view = (req.query.view === 'scheduling' ? 'scheduling' : 'early_warning') as ExportTemplateView;
    const data = await listExportTemplates(view);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.post('/export/scheduling', async (req: Request, res: Response) => {
  try {
    const { style_ids, column_keys, meta, template_id } = req.body as {
      style_ids?: unknown;
      column_keys?: unknown;
      meta?: SchedulingExportMeta;
      template_id?: number | null;
    };

    if (meta && (meta as { sandbox_mode?: boolean }).sandbox_mode) {
      res.status(400).json({ error: '排单沙箱模式下不可导出，请先退出沙箱' });
      return;
    }

    const ids = Array.isArray(style_ids)
      ? style_ids
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
      : [];
    if (!ids.length) {
      res.status(400).json({ error: '没有可导出的款式' });
      return;
    }

    const userKeys = Array.isArray(column_keys)
      ? column_keys.filter(
        (k): k is string => typeof k === 'string' && k.length > 0 && k !== 'action' && k !== 'row_edit' && k !== 'move_target',
      )
      : [];
    if (!userKeys.length) {
      res.status(400).json({ error: '请至少选择一个导出字段' });
      return;
    }

    const template = await resolveTemplateForExport('scheduling', template_id);
    const { keys, unconfigured } = resolveExportColumns(template?.config, userKeys);
    if (!keys.length) {
      res.status(400).json({ error: '请至少选择一个导出字段' });
      return;
    }

    const exportMeta: SchedulingExportMeta = {
      ...(meta ?? {}),
      template_name: template?.name,
    };
    const buffer = await exportSchedulingExcel(ids, keys, exportMeta, template?.config ?? null);
    const filename = buildSchedulingExportFilename();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    if (unconfigured.length > 0) {
      res.setHeader('X-Export-Unconfigured-Fields', unconfigured.join(','));
    }
    res.send(buffer);
  } catch (err) {
    console.error('[export/scheduling]', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

router.post('/export/early-warning', async (req: Request, res: Response) => {
  try {
    const { style_ids, column_keys, meta, template_id } = req.body as {
      style_ids?: unknown;
      column_keys?: unknown;
      meta?: EarlyWarningExportMeta;
      template_id?: number | null;
    };

    const ids = Array.isArray(style_ids)
      ? style_ids
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
      : [];
    if (!ids.length) {
      res.status(400).json({ error: '没有可导出的款式' });
      return;
    }

    const userKeys = Array.isArray(column_keys)
      ? column_keys.filter(
        (k): k is string => typeof k === 'string' && k.length > 0 && k !== 'action' && k !== 'row_edit',
      )
      : [];
    if (!userKeys.length) {
      res.status(400).json({ error: '请至少选择一个导出字段' });
      return;
    }

    const template = await resolveTemplateForExport('early_warning', template_id);
    const { keys, unconfigured } = resolveExportColumns(template?.config, userKeys);
    if (!keys.length) {
      res.status(400).json({ error: '请至少选择一个导出字段' });
      return;
    }

    const exportMeta: EarlyWarningExportMeta = {
      ...(meta ?? {}),
      template_name: template?.name,
    };
    const buffer = await exportEarlyWarningExcel(ids, keys, exportMeta, template?.config ?? null);
    const filename = buildEarlyWarningExportFilename();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    if (unconfigured.length > 0) {
      res.setHeader('X-Export-Unconfigured-Fields', unconfigured.join(','));
    }
    res.send(buffer);
  } catch (err) {
    console.error('[export/early-warning]', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    await seedStylesIfEmpty();
    const {
      view, closing_month, brand, salesperson, group, unscheduled_only, search,
      search_exact, exclude_locked, locked_only,
      filter_field, filter_values, sort_by, sort_order,
    } = req.query;
    const data = await listStyles({
      view: view as 'early_warning' | 'scheduling' | 'closing' | undefined,
      closing_month: closing_month as string | undefined,
      brand: brand as string | undefined,
      salesperson: salesperson as string | undefined,
      group: group as string | undefined,
      unscheduled_only: unscheduled_only === 'true' || unscheduled_only === '1',
      search: search as string | undefined,
      search_exact: search_exact === 'true' || search_exact === '1',
      exclude_locked: exclude_locked === 'true' || exclude_locked === '1',
      locked_only: locked_only === 'true' || locked_only === '1',
      filter_field: filter_field as string | undefined,
      filter_values: filter_values as string | undefined,
      sort_by: sort_by as string | undefined,
      sort_order: sort_order === 'desc' ? 'desc' : sort_order === 'asc' ? 'asc' : undefined,
    });
    res.json({ data });
  } catch (err) {
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
    if (req.user) {
      assertFieldsEditable(req.user, collectStyleFieldCodes(req.body as Record<string, unknown>));
    }
    const data = await createStyle(req.body as Record<string, unknown>);
    res.status(201).json({ data });
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err);
    res.status(msg.includes('无权限') ? 403 : 400).json({ error: msg });
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
    if (req.user) {
      for (const update of updates) {
        assertFieldsEditable(req.user, collectStyleFieldCodes(update));
      }
    }
    const data = await bulkUpdateStyles(updates, changed_by || 'system');
    res.json({ data });
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err);
    res.status(msg.includes('无权限') ? 403 : 500).json({ error: msg });
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

router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const { cancel_qty, cancel_all, reason, changed_by } = req.body as {
      cancel_qty?: number;
      cancel_all?: boolean;
      reason?: string;
      changed_by?: string;
    };
    const data = await cancelStyleOrder(
      id,
      { cancel_qty, cancel_all, reason },
      changed_by || req.user?.username || 'cancel-order',
    );
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
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
        online_time?: string | null;
        offline_time?: string | null;
      },
      (changed_by as string) || 'schedule-style',
    );
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.post('/:id/move', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const { target, changed_by } = req.body as {
      target: string;
      changed_by?: string;
    };
    if (!target) {
      res.status(400).json({ error: 'target required' });
      return;
    }
    const data = await moveStyleToTarget(id, target, changed_by || 'move-style');
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.post('/:id/reorder', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const { direction, changed_by } = req.body as { direction: 'up' | 'down'; changed_by?: string };
    if (direction !== 'up' && direction !== 'down') {
      res.status(400).json({ error: 'direction must be up or down' });
      return;
    }
    const data = await reorderStyleInGroup(id, direction, changed_by || 'reorder-style');
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.post('/:id/offline', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const { changed_by } = req.body as { changed_by?: string };
    const { style } = await offlineStyle(id, changed_by || 'offline-style');
    res.json({ data: style });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.post('/:id/extend-days', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const { extra_workdays, changed_by } = req.body as { extra_workdays: number; changed_by?: string };
    const data = await extendStyleWorkdays(id, extra_workdays, changed_by || 'extend-style');
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.post('/:id/outsource', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const { changed_by, ...body } = req.body as Record<string, unknown>;
    const data = await outsourceExistingStyle(
      id,
      body as {
        outsourced_factory: string;
        outsourced_price?: number | null;
        online_time?: string | null;
        offline_time?: string | null;
        required_days?: number | null;
      },
      (changed_by as string) || 'outsource-style',
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
    if (req.user) {
      assertFieldsEditable(req.user, collectStyleFieldCodes(body));
    }
    const data = await updateStyle(id, body, (changed_by as string) || 'system');
    res.json({ data });
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err);
    res.status(msg.includes('无权限') ? 403 : 500).json({ error: msg });
  }
});

export default router;
