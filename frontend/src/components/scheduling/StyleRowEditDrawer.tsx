import { useEffect, useState } from 'react';
import { Drawer, Form, Input, InputNumber, Button, message, Space } from 'antd';
import dayjs from 'dayjs';
import { DatePicker } from 'antd';
import { updateStyle } from '@/api/styles';
import type { StyleRecord } from '@/types/style';
import ClosingMonthSelect from '@/components/scheduling/ClosingMonthSelect';

interface StyleRowEditDrawerProps {
  record: StyleRecord | null;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: StyleRecord) => void;
}

export default function StyleRowEditDrawer({ record, open, onClose, onSaved }: StyleRowEditDrawerProps) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!record || !open) return;
    form.setFieldsValue({
      style_number: record.style_number,
      brand: record.brand,
      style_name: record.style_name,
      salesperson: record.salesperson,
      po_number: record.po_number,
      quantity: record.quantity,
      required_shipping_date: record.required_shipping_date ? dayjs(record.required_shipping_date) : undefined,
      closing_month: record.closing_month,
      fabric_readiness: record.fabric_readiness,
      accessories_readiness: record.accessories_readiness,
      fabric_structure: record.fabric_structure,
      sample_progress: record.sample_progress,
      printing_embroidery: record.printing_embroidery,
      order_follower: record.order_follower,
      remarks: record.remarks,
      processing_unit_price: record.processing_unit_price,
      sales_price: record.sales_price,
    });
  }, [record, open, form]);

  const handleSave = async () => {
    if (!record) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      const patch: Record<string, unknown> = {
        ...values,
        required_shipping_date: values.required_shipping_date
          ? values.required_shipping_date.format('YYYY-MM-DD')
          : null,
      };
      const res = await updateStyle(record.id, patch);
      message.success('已保存');
      onSaved(res.data);
      onClose();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={record ? `编辑 · ${record.style_number}` : '编辑款式'}
      open={open}
      onClose={onClose}
      width={520}
      destroyOnClose
      footer={(
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>保存</Button>
        </Space>
      )}
    >
      <Form form={form} layout="vertical" className="style-row-edit-form">
        <Form.Item name="style_number" label="款号" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="brand" label="品牌"><Input /></Form.Item>
        <Form.Item name="style_name" label="款式名称"><Input /></Form.Item>
        <Form.Item name="salesperson" label="业务员"><Input /></Form.Item>
        <Form.Item name="po_number" label="PO号"><Input /></Form.Item>
        <Form.Item name="quantity" label="数量"><InputNumber className="w-full" min={0} /></Form.Item>
        <Form.Item name="required_shipping_date" label="要求出货日">
          <DatePicker className="w-full" />
        </Form.Item>
        <Form.Item name="closing_month" label="关账月份">
          <ClosingMonthSelect />
        </Form.Item>
        <Form.Item name="fabric_readiness" label="面料进度"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="accessories_readiness" label="辅料进度"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="fabric_structure" label="面料结构"><Input /></Form.Item>
        <Form.Item name="sample_progress" label="样衣进度"><Input /></Form.Item>
        <Form.Item name="printing_embroidery" label="印绣花"><Input /></Form.Item>
        <Form.Item name="order_follower" label="跟单员"><Input /></Form.Item>
        <Form.Item name="processing_unit_price" label="加工单价"><InputNumber className="w-full" min={0} step={0.01} /></Form.Item>
        <Form.Item name="sales_price" label="销售单价"><InputNumber className="w-full" min={0} step={0.01} /></Form.Item>
        <Form.Item name="remarks" label="备注"><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Drawer>
  );
}
