import { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Switch, Input, Space, Button, message } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import TableColumnSettings from '@/components/TableColumnSettings';
import StyleHistoryDrawer from '@/components/scheduling/StyleHistoryDrawer';
import StyleImageCell from '@/components/scheduling/StyleImageCell';
import { getStyles } from '@/api/styles';
import type { StyleRecord } from '@/types/style';
import { enrichStyleClient, formatDate, formatMoney, isUnscheduled } from '@/utils/styleCalculations';
import {
  EARLY_WARNING_COLUMNS,
  EARLY_WARNING_STORAGE_KEY,
  loadViewColumnPreferences,
  saveViewColumnPreferences,
} from '@/utils/schedulingColumnPrefs';
import type { ColumnPreferences } from '@/utils/quotationListColumnPrefs';
import { applyViewColumnPreferences, estimateScrollX } from '@/utils/viewColumnUtils';

export default function EarlyWarningView() {
  const [data, setData] = useState<StyleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [unscheduledOnly, setUnscheduledOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [columnPrefs, setColumnPrefs] = useState<ColumnPreferences>(() =>
    loadViewColumnPreferences(EARLY_WARNING_STORAGE_KEY, EARLY_WARNING_COLUMNS)
  );
  const [historyStyle, setHistoryStyle] = useState<StyleRecord | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getStyles({
        view: 'early_warning',
        unscheduled_only: unscheduledOnly,
        search: search || undefined,
      });
      setData((res.data || []).map(enrichStyleClient));
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [unscheduledOnly, search]);

  useEffect(() => { loadData(); }, [loadData]);

  const allColumns: ColumnsType<StyleRecord> = useMemo(() => [
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 100, ellipsis: true },
    { title: '款号', dataIndex: 'style_number', key: 'style_number', width: 110 },
    { title: '款式名称', dataIndex: 'style_name', key: 'style_name', width: 120, ellipsis: true },
    { title: '关账月份', dataIndex: 'closing_month', key: 'closing_month', width: 100 },
    {
      title: '款式图', dataIndex: 'style_image', key: 'style_image', width: 72,
      render: (v: string) => <StyleImageCell src={v} />,
    },
    { title: '面料结构', dataIndex: 'fabric_structure', key: 'fabric_structure', width: 110, ellipsis: true },
    { title: '面料进度', dataIndex: 'fabric_readiness', key: 'fabric_readiness', width: 90 },
    { title: '辅料进度', dataIndex: 'accessories_readiness', key: 'accessories_readiness', width: 90 },
    { title: '样衣进度', dataIndex: 'sample_progress', key: 'sample_progress', width: 90 },
    { title: 'PO号', dataIndex: 'po_number', key: 'po_number', width: 110 },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
    {
      title: '加工单价', dataIndex: 'processing_unit_price', key: 'processing_unit_price', width: 100,
      render: (v: number) => formatMoney(v),
    },
    {
      title: '加工产值', dataIndex: 'processing_output_value', key: 'processing_output_value', width: 100,
      render: (v: number) => formatMoney(v),
    },
    {
      title: '销售单价', dataIndex: 'sales_price', key: 'sales_price', width: 100,
      render: (v: number) => formatMoney(v),
    },
    {
      title: '销售产值', dataIndex: 'sales_output_value', key: 'sales_output_value', width: 100,
      render: (v: number) => formatMoney(v),
    },
    { title: '印绣花', dataIndex: 'printing_embroidery', key: 'printing_embroidery', width: 100, ellipsis: true },
    { title: '跟单员', dataIndex: 'order_follower', key: 'order_follower', width: 90 },
    {
      title: '要求出货日', dataIndex: 'required_shipping_date', key: 'required_shipping_date', width: 110,
      render: (v: string) => formatDate(v),
    },
    { title: '备注', dataIndex: 'remarks', key: 'remarks', width: 140, ellipsis: true },
    {
      title: '操作', key: 'action', width: 80, fixed: 'right',
      render: (_: unknown, record: StyleRecord) => (
        <Button
          type="link"
          size="small"
          icon={<HistoryOutlined />}
          onClick={() => setHistoryStyle(record)}
        />
      ),
    },
  ], []);

  const columns = useMemo(
    () => applyViewColumnPreferences(allColumns, columnPrefs),
    [allColumns, columnPrefs]
  );

  return (
    <div>
      <div className="card-panel mb-4">
        <Space wrap className="w-full justify-between">
          <Space wrap>
            <Input.Search
              placeholder="搜索款号/品牌/PO"
              allowClear
              style={{ width: 220 }}
              onSearch={setSearch}
            />
            <Space>
              <span className="text-sm text-gray-500">仅未排单</span>
              <Switch checked={unscheduledOnly} onChange={setUnscheduledOnly} />
            </Space>
          </Space>
          <TableColumnSettings
            columns={EARLY_WARNING_COLUMNS}
            value={columnPrefs}
            onChange={(prefs) => {
              saveViewColumnPreferences(EARLY_WARNING_STORAGE_KEY, prefs, EARLY_WARNING_COLUMNS);
              setColumnPrefs(loadViewColumnPreferences(EARLY_WARNING_STORAGE_KEY, EARLY_WARNING_COLUMNS));
            }}
          />
        </Space>
      </div>

      <div className="card-panel">
        <Table
          className="quotation-list-table"
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: estimateScrollX(columns as ColumnsType<unknown>) }}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
          rowClassName={(record) => (isUnscheduled(record) ? 'unscheduled-warning' : '')}
        />
      </div>

      <StyleHistoryDrawer
        open={!!historyStyle}
        styleId={historyStyle?.id ?? null}
        styleLabel={historyStyle?.style_number}
        onClose={() => setHistoryStyle(null)}
      />
    </div>
  );
}
