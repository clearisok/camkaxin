import { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Input, Select, Space, message, Popconfirm, Modal, Checkbox, Input as AntInput } from 'antd';
import { PlusOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import FilterField from '@/components/FilterField';
import TableColumnSettings from '@/components/TableColumnSettings';
import ResizableTableHeader from '@/components/ResizableTableHeader';
import {
  getQuotations, deleteQuotation, copyQuotation, exportExcel, getTemplates, exportSummary, getExportFilename,
  getBrands, getAgents,
} from '@/api';
import type { Quotation, Brand, Agent } from '@/types';
import {
  QUOTATION_LIST_COLUMN_DEFS,
  loadColumnPreferences,
  clampColumnWidth,
  normalizeColumnPreferences,
  saveColumnPreferences,
  type ColumnPreferences,
} from '@/utils/quotationListColumnPrefs';
import {
  applyColumnPreferences,
  buildQuotationListColumns,
  estimateTableScrollX,
} from '@/utils/quotationListColumns';
import { todayYmdCompact } from '@/utils/beijingTime';

const statusMap: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  sent: { color: 'processing', text: '已发送' },
  confirmed: { color: 'success', text: '已确认' },
  expired: { color: 'error', text: '已过期' },
};

function downloadBlob(data: Blob, filename: string) {
  const url = window.URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

const TABLE_HEADER_COMPONENTS = { header: { cell: ResizableTableHeader } };

const DEFAULT_WIDTH_BY_KEY = Object.fromEntries(
  QUOTATION_LIST_COLUMN_DEFS.map((c) => [c.key, c.defaultWidth])
);

export default function QuotationList() {
  const navigate = useNavigate();
  const [data, setData] = useState<Quotation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [brandId, setBrandId] = useState<number | undefined>();
  const [agentName, setAgentName] = useState<string | undefined>();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [page, setPage] = useState(1);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [columnPrefs, setColumnPrefs] = useState<ColumnPreferences>(() => loadColumnPreferences());
  const [exportModal, setExportModal] = useState<{ visible: boolean; id?: number }>({ visible: false });
  const [templates, setTemplates] = useState<Array<{ id: number; name: string }>>([]);
  const [exportOptions, setExportOptions] = useState({
    templateId: undefined as number | undefined,
    splitByItem: false,
    filename: '',
  });

  useEffect(() => {
    Promise.all([getBrands(), getAgents()])
      .then(([b, a]) => {
        setBrands(b.data || []);
        setAgents(a.data || []);
      })
      .catch(() => {});
  }, []);

  const agentOptions = useMemo(() => {
    const list = brandId
      ? agents.filter((a) => a.brand_id === brandId)
      : agents;
    return list.map((a) => ({ value: a.name, label: a.name }));
  }, [agents, brandId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getQuotations({
        search: search || undefined,
        status,
        brand_id: brandId,
        agent_name: agentName,
        page,
        pageSize: 20,
      });
      setData(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [search, status, brandId, agentName, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCopy = async (id: number) => {
    try {
      const res = await copyQuotation(id);
      message.success('复制成功');
      navigate(`/quotations/${res.id}/edit`);
    } catch (err) {
      message.error(String(err));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteQuotation(id);
      message.success('删除成功');
      loadData();
    } catch (err) {
      message.error(String(err));
    }
  };

  const handleExport = async () => {
    if (!exportModal.id) return;
    try {
      const res = await exportExcel(
        exportModal.id,
        exportOptions.templateId,
        exportOptions.splitByItem,
        exportOptions.filename || undefined
      );
      downloadBlob(new Blob([res.data]), exportOptions.filename || `quotation_${exportModal.id}.xlsx`);
      setExportModal({ visible: false });
      message.success('导出成功');
    } catch (err) {
      message.error(String(err));
    }
  };

  const handleSummaryExport = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择报价单');
      return;
    }
    try {
      const res = await exportSummary(selectedRowKeys);
      const date = todayYmdCompact();
      downloadBlob(new Blob([res.data]), `报价汇总_${date}.xlsx`);
      message.success('汇总导出成功');
    } catch (err) {
      message.error(String(err));
    }
  };

  const openExport = async (id: number) => {
    try {
      const [tplRes, nameRes] = await Promise.all([getTemplates(), getExportFilename(id)]);
      setTemplates(tplRes.data || []);
      setExportOptions({
        templateId: undefined,
        splitByItem: false,
        filename: nameRes.filename || '',
      });
    } catch {
      setExportOptions({ templateId: undefined, splitByItem: false, filename: '' });
    }
    setExportModal({ visible: true, id });
  };

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const handleColumnResize = useCallback((key: string, width: number) => {
    setColumnPrefs((prev) => {
      const fallback = prev.widths[key] ?? DEFAULT_WIDTH_BY_KEY[key] ?? 120;
      return normalizeColumnPreferences({
        ...prev,
        widths: { ...prev.widths, [key]: clampColumnWidth(width, fallback) },
      });
    });
  }, []);

  const handleColumnResizeStop = useCallback((key: string, width: number) => {
    setColumnPrefs((prev) => {
      const fallback = prev.widths[key] ?? DEFAULT_WIDTH_BY_KEY[key] ?? 120;
      const next = normalizeColumnPreferences({
        ...prev,
        widths: { ...prev.widths, [key]: clampColumnWidth(width, fallback) },
      });
      saveColumnPreferences(next);
      return next;
    });
  }, []);

  const allColumns = useMemo(
    () => buildQuotationListColumns({
      navigate,
      onCopy: handleCopy,
      onDelete: handleDelete,
      onExport: openExport,
    }),
    [navigate]
  );

  const columns = useMemo(
    () => applyColumnPreferences(
      allColumns,
      columnPrefs.order,
      columnPrefs.visible,
      columnPrefs.widths,
      { onResize: handleColumnResize, onResizeStop: handleColumnResizeStop }
    ),
    [allColumns, columnPrefs, handleColumnResize, handleColumnResizeStop]
  );

  const scrollX = useMemo(() => estimateTableScrollX(columns), [columns]);

  return (
    <div className="page-container">
      <div className="card-panel mb-4">
        <Space wrap className="w-full justify-between" align="end">
          <div className="filter-toolbar">
            <FilterField label="搜索">
              <Input.Search
                placeholder="报价单号 / 品牌 / 款号"
                allowClear
                style={{ width: 260 }}
                onSearch={handleSearch}
              />
            </FilterField>
            <FilterField label="品牌">
              <Select
                placeholder="全部"
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ width: 150 }}
                value={brandId}
                onChange={(v) => {
                  setBrandId(v);
                  setAgentName(undefined);
                  setPage(1);
                }}
                options={brands.map((b) => ({ value: b.id, label: b.name }))}
              />
            </FilterField>
            <FilterField label="业务员">
              <Select
                placeholder="全部"
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ width: 140 }}
                value={agentName}
                onChange={(v) => { setAgentName(v); setPage(1); }}
                options={agentOptions}
              />
            </FilterField>
            <FilterField label="状态">
              <Select
                placeholder="全部"
                allowClear
                style={{ width: 130 }}
                value={status}
                onChange={(v) => { setStatus(v); setPage(1); }}
                options={Object.entries(statusMap).map(([k, v]) => ({ value: k, label: v.text }))}
              />
            </FilterField>
          </div>
          <Space wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/quotations/new')}>
              新建报价单
            </Button>
            <Button
              icon={<FileExcelOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={handleSummaryExport}
            >
              导出汇总 {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
            </Button>
            <TableColumnSettings
              columns={QUOTATION_LIST_COLUMN_DEFS}
              value={columnPrefs}
              onChange={setColumnPrefs}
            />
          </Space>
        </Space>
      </div>

      <div className="card-panel">
        <Table
          className="quotation-list-table"
          rowKey="id"
          tableLayout="fixed"
          components={TABLE_HEADER_COMPONENTS}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as number[]),
          }}
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: scrollX }}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </div>

      <Modal
        title="导出标价表"
        open={exportModal.visible}
        onOk={handleExport}
        onCancel={() => setExportModal({ visible: false })}
        width={480}
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm text-gray-600 block mb-1">文件名</label>
            <AntInput
              value={exportOptions.filename}
              onChange={(e) => setExportOptions({ ...exportOptions, filename: e.target.value })}
              placeholder="品牌_款号_日期.xlsx"
            />
            <p className="text-xs text-gray-400 mt-1">默认规则：品牌_款号_日期，多款号时追加「等」</p>
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">选择模板</label>
            <Select
              className="w-full"
              placeholder="使用默认模板"
              allowClear
              value={exportOptions.templateId}
              onChange={(v) => setExportOptions({ ...exportOptions, templateId: v })}
              options={templates.map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>
          <Checkbox
            checked={exportOptions.splitByItem}
            onChange={(e) => setExportOptions({ ...exportOptions, splitByItem: e.target.checked })}
          >
            按明细行分 Sheet
          </Checkbox>
        </div>
      </Modal>
    </div>
  );
}
