import { useMemo, useState } from 'react';
import { Button, Checkbox, InputNumber, Popover } from 'antd';
import { SettingOutlined, HolderOutlined } from '@ant-design/icons';
import type { ColumnPrefItem, ColumnPreferences } from '@/utils/quotationListColumnPrefs';
import {
  COLUMN_WIDTH_MAX,
  COLUMN_WIDTH_MIN,
  clampColumnWidth,
  normalizeColumnPreferencesForDefs,
  saveColumnPreferences,
} from '@/utils/quotationListColumnPrefs';

interface TableColumnSettingsProps {
  columns: ColumnPrefItem[];
  value: ColumnPreferences;
  onChange: (prefs: ColumnPreferences) => void;
  /** 传入则写入对应存储；不传则沿用报价单列表的 localStorage */
  onPersist?: (prefs: ColumnPreferences) => void;
}

export default function TableColumnSettings({ columns, value, onChange, onPersist }: TableColumnSettingsProps) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const orderedItems = useMemo(() => {
    const map = new Map(columns.map((c) => [c.key, c]));
    return value.order.map((key) => map.get(key)).filter(Boolean) as ColumnPrefItem[];
  }, [columns, value.order]);

  const apply = (next: ColumnPreferences) => {
    const normalized = normalizeColumnPreferencesForDefs(next, columns);
    onChange(normalized);
    if (onPersist) {
      onPersist(normalized);
    } else {
      saveColumnPreferences(normalized);
    }
  };

  const toggleVisible = (key: string, checked: boolean) => {
    apply({ ...value, visible: { ...value.visible, [key]: checked } });
  };

  const setWidth = (key: string, width: number | null) => {
    const col = columns.find((c) => c.key === key);
    const fallback = col?.defaultWidth ?? COLUMN_WIDTH_MIN;
    if (width == null) return;
    apply({
      ...value,
      widths: { ...value.widths, [key]: clampColumnWidth(width, fallback) },
    });
  };

  const reorder = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    const order = [...value.order];
    const fromIdx = order.indexOf(fromKey);
    const toIdx = order.indexOf(toKey);
    if (fromIdx < 0 || toIdx < 0) return;
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, fromKey);
    apply({ ...value, order });
  };

  const reset = () => {
    apply(normalizeColumnPreferencesForDefs(null, columns));
  };

  const content = (
    <div className="w-80">
      <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-700">列显示、顺序与宽度</span>
        <Button type="link" size="small" className="!px-0 !h-auto" onClick={reset}>
          恢复默认
        </Button>
      </div>
      <div className="flex items-center gap-2 px-2 pb-1 text-xs text-gray-400">
        <span className="w-[14px] shrink-0" />
        <span className="flex-1">列名</span>
        <span className="w-16 text-right shrink-0">宽度</span>
      </div>
      <div className="max-h-80 overflow-y-auto space-y-1">
        {orderedItems.map((col) => {
          const hideable = col.hideable !== false;
          return (
            <div
              key={col.key}
              draggable={hideable}
              onDragStart={() => setDragKey(col.key)}
              onDragOver={(e) => { if (hideable) e.preventDefault(); }}
              onDrop={() => {
                if (dragKey && hideable) reorder(dragKey, col.key);
                setDragKey(null);
              }}
              onDragEnd={() => setDragKey(null)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md border border-transparent ${
                hideable ? 'cursor-grab hover:bg-gray-50 hover:border-gray-200' : 'bg-gray-50'
              } ${dragKey === col.key ? 'opacity-50' : ''}`}
            >
              {hideable ? (
                <HolderOutlined className="text-gray-400 shrink-0" />
              ) : (
                <span className="w-[14px] shrink-0" />
              )}
              <Checkbox
                checked={value.visible[col.key] !== false}
                disabled={!hideable}
                onChange={(e) => toggleVisible(col.key, e.target.checked)}
                className="flex-1 min-w-0"
              >
                <span className="text-sm truncate">{col.title}</span>
              </Checkbox>
              <InputNumber
                size="small"
                min={COLUMN_WIDTH_MIN}
                max={COLUMN_WIDTH_MAX}
                step={8}
                value={value.widths[col.key] ?? col.defaultWidth}
                onChange={(v) => setWidth(col.key, v)}
                className="!w-16 shrink-0"
                controls={false}
              />
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
        拖拽调整顺序，宽度 {COLUMN_WIDTH_MIN}–{COLUMN_WIDTH_MAX}px，设置自动保存
      </p>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
    >
      <Button icon={<SettingOutlined />}>列设置</Button>
    </Popover>
  );
}
