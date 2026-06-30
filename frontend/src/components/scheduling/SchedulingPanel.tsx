import { useMemo, useState } from 'react';

import {

  Button, InputNumber, Select, Switch, Input, Space, message, Card, Empty, Spin, DatePicker,

} from 'antd';

import dayjs from 'dayjs';

import { scheduleStyle } from '@/api/styles';

import type { StyleRecord } from '@/types/style';

import StyleImageCell from '@/components/scheduling/StyleImageCell';

import { formatDate, isUnscheduled } from '@/utils/styleCalculations';

import { formatMaterialText, PRODUCTION_GROUP_IDS } from '@/utils/schedulingZone';



interface Draft {

  schedule_qty?: number;

  required_days?: number;

  is_outsourced: boolean;

  group_name?: string;

  outsourced_factory?: string;

  outsourced_price?: number;

  online_time?: string;

  scheduling_remarks?: string;

}



interface SchedulingPanelProps {

  data: StyleRecord[];

  loading?: boolean;

  onScheduled: () => void;

}



const GROUP_OPTIONS = PRODUCTION_GROUP_IDS.map((g) => ({ value: g, label: `第 ${g} 组` }));



function defaultDraft(record: StyleRecord): Draft {

  const unscheduled = record.unscheduled_quantity ?? record.quantity;

  return {

    is_outsourced: false,

    schedule_qty: unscheduled != null ? unscheduled : undefined,

  };

}



function textOrDash(v: unknown): string {

  if (v == null || v === '') return '—';

  return String(v);

}



function DetailCell({ label, value }: { label: string; value: string }) {

  return (

    <div className="scheduling-detail-cell">

      <span className="scheduling-detail-cell-label">{label}</span>

      <span className="scheduling-detail-cell-value">{value}</span>

    </div>

  );

}



function WaitOrderDetail({ record }: { record: StyleRecord }) {

  return (

    <div className="scheduling-panel-detail-compact">

      <div className="scheduling-panel-detail-thumb">

        <StyleImageCell src={record.style_image} maxSize={150} placeholder />

      </div>

      <div className="scheduling-panel-detail-body">

        <div className="scheduling-panel-detail-row triplet">

          <DetailCell label="订单数量" value={textOrDash(record.quantity)} />

          <DetailCell label="要求出货日" value={formatDate(record.required_shipping_date)} />

          <DetailCell label="PO号" value={textOrDash(record.po_number)} />

        </div>

        <div className="scheduling-panel-detail-row full">

          <DetailCell label="面料结构" value={textOrDash(record.fabric_structure)} />

        </div>

        <div className="scheduling-panel-detail-row full">

          <DetailCell

            label="面辅料进度"

            value={formatMaterialText(record.fabric_readiness, record.accessories_readiness) || '—'}

          />

        </div>

        <div className="scheduling-panel-detail-row full">

          <DetailCell label="备注" value={textOrDash(record.remarks)} />

        </div>

      </div>

    </div>

  );

}



export default function SchedulingPanel({ data, loading, onScheduled }: SchedulingPanelProps) {

  const [drafts, setDrafts] = useState<Record<number, Draft>>({});

  const [submittingId, setSubmittingId] = useState<number | null>(null);



  const waitStyles = useMemo(

    () => data.filter(isUnscheduled),

    [data],

  );



  const getDraft = (record: StyleRecord): Draft => drafts[record.id] ?? defaultDraft(record);



  const patchDraft = (id: number, record: StyleRecord, patch: Partial<Draft>) => {

    setDrafts((prev) => ({ ...prev, [id]: { ...getDraft(record), ...patch } }));

  };



  const handleConfirm = async (record: StyleRecord) => {

    const draft = getDraft(record);

    const orderQty = record.quantity;

    if (orderQty == null || orderQty < 1) {

      message.warning('订单数量未填写，请先完善订单数量');

      return;

    }



    const scheduleQty = draft.schedule_qty;

    if (scheduleQty == null || !Number.isInteger(scheduleQty) || scheduleQty < 1) {

      message.warning('排入数量须为正整数');

      return;

    }



    const remaining = record.unscheduled_quantity ?? orderQty;

    if (scheduleQty > remaining) {

      message.warning(`排入数量超出未排数量（当前未排 ${remaining}）`);

      return;

    }

    if (scheduleQty > orderQty) {

      message.warning(`排入数量超出订单数量（订单 ${orderQty}）`);

      return;

    }



    if (!draft.required_days || draft.required_days < 1) {

      message.warning('请填写所需天数');

      return;

    }

    if (draft.is_outsourced) {

      if (!draft.outsourced_factory?.trim()) {
        message.warning('请填写外发工厂');
        return;
      }
      if (!draft.online_time) {
        message.warning('请填写外发上线日期');
        return;
      }
    } else if (!draft.group_name) {

      message.warning('请选择排入组别');

      return;

    }



    setSubmittingId(record.id);

    try {

      await scheduleStyle(record.id, {

        schedule_qty: scheduleQty,

        required_days: draft.required_days,

        is_outsourced: draft.is_outsourced,

        group_name: draft.is_outsourced ? null : draft.group_name,

        outsourced_factory: draft.is_outsourced ? draft.outsourced_factory?.trim() : null,

        outsourced_price: draft.is_outsourced ? (draft.outsourced_price ?? null) : null,

        online_time: draft.is_outsourced ? draft.online_time ?? null : null,

        offline_time: null,

        scheduling_remarks: draft.scheduling_remarks?.trim() || null,

      });

      message.success(`${record.style_number} 已排入 ${scheduleQty} 件`);

      setDrafts((prev) => {

        const next = { ...prev };

        delete next[record.id];

        return next;

      });

      onScheduled();

    } catch (err) {

      message.error(String(err));

    } finally {

      setSubmittingId(null);

    }

  };



  return (

    <div className="scheduling-panel">

      <div className="scheduling-panel-head">

        <h4>待排单</h4>

        <span className="scheduling-panel-count">{waitStyles.length} 款</span>

      </div>

      <Spin spinning={loading}>

        {waitStyles.length === 0 ? (

          <Empty className="scheduling-panel-empty" description="暂无待排单款式" />

        ) : (

          <div className="scheduling-panel-list">

            {waitStyles.map((record) => {

              const draft = getDraft(record);

              const allocated = record.allocated_quantity ?? 0;

              const unscheduled = record.unscheduled_quantity ?? record.quantity;

              const showUnscheduled = allocated > 0 && (unscheduled ?? 0) > 0;

              return (

                <Card key={record.id} size="small" className="scheduling-panel-card">

                  <div className="scheduling-panel-card-head">

                    <strong className="scheduling-panel-style-no">{record.style_number || '—'}</strong>

                    <span>{record.brand || '—'}</span>

                    <span className="scheduling-panel-style-name">{record.style_name || '—'}</span>

                    {showUnscheduled && (

                      <span className="scheduling-panel-unscheduled-badge">

                        未排 {unscheduled}

                      </span>

                    )}

                  </div>



                  <WaitOrderDetail record={record} />



                  <div className="scheduling-panel-form">
                    <div className={`scheduling-panel-form-row scheduling-panel-form-row--primary${draft.is_outsourced ? ' is-outsource-primary' : ''}`}>
                      <label className="scheduling-panel-field scheduling-panel-field--qty">
                        <span className="required">排入数量</span>
                        <InputNumber
                          size="small"
                          className="scheduling-panel-input-qty"
                          min={1}
                          precision={0}
                          placeholder="必填"
                          value={draft.schedule_qty}
                          onChange={(v) => patchDraft(record.id, record, {
                            schedule_qty: v != null ? Math.round(v) : undefined,
                          })}
                        />
                      </label>
                      <label className="scheduling-panel-field scheduling-panel-field--days">
                        <span className="required">所需天数</span>
                        <InputNumber
                          size="small"
                          className="scheduling-panel-input-days"
                          min={1}
                          precision={0}
                          placeholder="必填"
                          value={draft.required_days}
                          onChange={(v) => patchDraft(record.id, record, { required_days: v ?? undefined })}
                        />
                      </label>
                      <label className="scheduling-panel-field scheduling-panel-field-switch">
                        <span>是否外发</span>
                        <Switch
                          checked={draft.is_outsourced}
                          checkedChildren="是"
                          unCheckedChildren="否"
                          onChange={(checked) => patchDraft(record.id, record, {
                            is_outsourced: checked,
                            group_name: checked ? undefined : draft.group_name,
                            outsourced_factory: checked ? draft.outsourced_factory : undefined,
                            outsourced_price: checked ? draft.outsourced_price : undefined,
                          })}
                        />
                      </label>
                      {!draft.is_outsourced && (
                        <label className="scheduling-panel-field scheduling-panel-field--group">
                          <span className="required">排入组别</span>
                          <Select
                            size="small"
                            className="scheduling-panel-select-group"
                            placeholder="组别"
                            options={GROUP_OPTIONS}
                            value={draft.group_name}
                            onChange={(v) => patchDraft(record.id, record, { group_name: v })}
                          />
                        </label>
                      )}
                    </div>
                    {draft.is_outsourced && (
                      <div className="scheduling-panel-form-row scheduling-panel-form-row--outsource">
                        <label className="scheduling-panel-field scheduling-panel-field--factory">
                          <span className="required">外发工厂</span>
                          <Input
                            size="small"
                            placeholder="外发工厂"
                            value={draft.outsourced_factory}
                            onChange={(e) => patchDraft(record.id, record, { outsourced_factory: e.target.value })}
                          />
                        </label>
                        <label className="scheduling-panel-field scheduling-panel-field--price">
                          <span>外发单价</span>
                          <InputNumber
                            size="small"
                            className="scheduling-panel-input-full"
                            min={0}
                            step={0.01}
                            precision={2}
                            placeholder="单价"
                            value={draft.outsourced_price}
                            onChange={(v) => patchDraft(record.id, record, { outsourced_price: v ?? undefined })}
                          />
                        </label>
                        <label className="scheduling-panel-field scheduling-panel-field--date">
                          <span className="required">外发上线</span>
                          <DatePicker
                            size="small"
                            className="scheduling-panel-input-full"
                            placeholder="选择日期"
                            value={draft.online_time ? dayjs(draft.online_time) : undefined}
                            onChange={(v) => patchDraft(record.id, record, { online_time: v?.format('YYYY-MM-DD') })}
                          />
                        </label>
                      </div>
                    )}
                  </div>



                  <label className="scheduling-panel-field scheduling-panel-field--remarks">

                    <span>排单备注</span>

                    <Input.TextArea

                      rows={2}

                      placeholder="仅本次排单备注，与预警备注区分"

                      value={draft.scheduling_remarks}

                      onChange={(e) => patchDraft(record.id, record, { scheduling_remarks: e.target.value })}

                    />

                  </label>



                  <Space className="scheduling-panel-actions">

                    <Button

                      type="primary"

                      loading={submittingId === record.id}

                      onClick={() => handleConfirm(record)}

                    >

                      确认排单

                    </Button>

                  </Space>

                </Card>

              );

            })}

          </div>

        )}

      </Spin>

    </div>

  );

}


