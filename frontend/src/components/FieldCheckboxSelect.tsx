import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Checkbox, Input, Popover, Spin } from 'antd';
import { SortAscendingOutlined, SortDescendingOutlined } from '@ant-design/icons';

export interface FieldCheckboxSelectProps {
  /** 可选值列表（由外部加载） */
  options: string[];
  loading?: boolean;
  value: string[];
  onChange: (values: string[]) => void;
  /** 打开时重新加载选项 */
  onLoadOptions?: (keyword: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

type SortDir = 'asc' | 'desc';

export default function FieldCheckboxSelect({
  options,
  loading = false,
  value,
  onChange,
  onLoadOptions,
  placeholder = '请选择',
  disabled = false,
}: FieldCheckboxSelectProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [draft, setDraft] = useState<string[]>(value);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const onLoadRef = useRef(onLoadOptions);
  onLoadRef.current = onLoadOptions;

  useEffect(() => {
    if (open) {
      setDraft(value);
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    setKeyword('');
    onLoadRef.current?.('');
  }, [open]);

  const sortedOptions = useMemo(() => {
    const list = [...options];
    list.sort((a, b) => (sortDir === 'asc' ? 1 : -1) * a.localeCompare(b, 'zh-CN'));
    return list;
  }, [options, sortDir]);

  const filteredOptions = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return sortedOptions;
    return sortedOptions.filter((o) => o.toLowerCase().includes(q));
  }, [sortedOptions, keyword]);

  const allChecked = filteredOptions.length > 0 && filteredOptions.every((o) => draft.includes(o));
  const indeterminate = filteredOptions.some((o) => draft.includes(o)) && !allChecked;

  const toggleAll = (checked: boolean) => {
    if (checked) {
      const merged = [...new Set([...draft, ...filteredOptions])];
      setDraft(merged);
    } else {
      const remove = new Set(filteredOptions);
      setDraft(draft.filter((v) => !remove.has(v)));
    }
  };

  const toggleOne = (opt: string, checked: boolean) => {
    setDraft((prev) => (checked ? [...prev, opt] : prev.filter((v) => v !== opt)));
  };

  const handleSearch = () => {
    onChange(draft);
    setOpen(false);
  };

  const handleReset = () => {
    setDraft([]);
    setKeyword('');
    onLoadRef.current?.('');
  };

  const handleKeywordChange = useCallback((v: string) => {
    setKeyword(v);
    onLoadRef.current?.(v);
  }, []);

  const triggerLabel = value.length > 0 ? `已选 ${value.length} 项` : placeholder;

  const content = (
    <div className="field-checkbox-select-panel">
      <div className="field-checkbox-select-title">请选择</div>
      <Input
        placeholder="搜索"
        allowClear
        value={keyword}
        onChange={(e) => handleKeywordChange(e.target.value)}
        className="field-checkbox-select-search"
      />
      <div className="field-checkbox-select-toolbar">
        <Checkbox
          indeterminate={indeterminate}
          checked={allChecked}
          onChange={(e) => toggleAll(e.target.checked)}
        >
          全部
        </Checkbox>
        <span className="field-checkbox-select-sort">
          <Button
            type={sortDir === 'asc' ? 'link' : 'text'}
            size="small"
            icon={<SortAscendingOutlined />}
            aria-label="升序"
            onClick={() => setSortDir('asc')}
          />
          <Button
            type={sortDir === 'desc' ? 'link' : 'text'}
            size="small"
            icon={<SortDescendingOutlined />}
            aria-label="降序"
            onClick={() => setSortDir('desc')}
          />
        </span>
      </div>
      <div className="field-checkbox-select-list">
        {loading ? (
          <div className="field-checkbox-select-loading"><Spin size="small" /></div>
        ) : filteredOptions.length === 0 ? (
          <div className="field-checkbox-select-empty">暂无选项</div>
        ) : (
          filteredOptions.map((opt) => (
            <label key={opt} className="field-checkbox-select-item" title={opt}>
              <Checkbox
                checked={draft.includes(opt)}
                onChange={(e) => toggleOne(opt, e.target.checked)}
              />
              <span className="field-checkbox-select-item-label">{opt}</span>
            </label>
          ))
        )}
      </div>
      <div className="field-checkbox-select-footer">
        <Button type="primary" block onClick={handleSearch}>
          搜索
        </Button>
        <Button block onClick={handleReset}>
          重置
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomLeft"
      content={content}
      overlayClassName="field-checkbox-select-popover"
    >
      <Button disabled={disabled} className="field-checkbox-select-trigger">
        {triggerLabel}
      </Button>
    </Popover>
  );
}
