import { useEffect, useState } from 'react';
import { Modal, Form, InputNumber, Radio, Input, message } from 'antd';
import { cancelStyleOrder } from '@/api/styles';
import type { StyleRecord } from '@/types/style';

interface Props {
  open: boolean;
  record: StyleRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CancelOrderModal({ open, record, onClose, onSuccess }: Props) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const mode = Form.useWatch('mode', form);

  useEffect(() => {
    if (open && record) {
      form.setFieldsValue({
        mode: 'partial',
        cancel_qty: undefined,
        reason: '',
      });
    }
  }, [open, record, form]);

  const handleSubmit = async () => {
    if (!record) return;
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await cancelStyleOrder(record.id, {
        cancel_all: values.mode === 'all',
        cancel_qty: values.mode === 'partial' ? values.cancel_qty : undefined,
        reason: values.reason?.trim() || undefined,
      });
      message.success('取消成功');
      onSuccess();
      onClose();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const currentQty = record?.quantity ?? 0;
  const allocated = record?.allocated_quantity ?? 0;

  return (
    <Modal
      title={`取消订单 — ${record?.style_number ?? ''}`}
      open={open}
      onCancel={onClose}
      onOk={() => void handleSubmit()}
      confirmLoading={submitting}
      okText="确认取消"
      okButtonProps={{ danger: true }}
      destroyOnClose
    >
      <p className="text-gray-500 text-sm mb-4">
        当前数量 <strong>{currentQty}</strong>
        {allocated > 0 && <> · 已排 <strong>{allocated}</strong></>}
        {(record?.cancelled_quantity ?? 0) > 0 && (
          <> · 累计已取消 <strong>{record?.cancelled_quantity}</strong></>
        )}
      </p>
      <Form form={form} layout="vertical">
        <Form.Item name="mode" label="取消方式" rules={[{ required: true }]}>
          <Radio.Group>
            <Radio value="partial">部分取消</Radio>
            <Radio value="all">整单取消</Radio>
          </Radio.Group>
        </Form.Item>
        {mode === 'partial' && (
          <Form.Item
            name="cancel_qty"
            label="取消件数"
            rules={[
              { required: true, message: '请输入取消件数' },
              {
                validator: (_, v) => {
                  const n = Number(v);
                  if (!Number.isInteger(n) || n < 1) return Promise.reject(new Error('须为正整数'));
                  if (n > currentQty) return Promise.reject(new Error(`不能超过当前数量 ${currentQty}`));
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber className="w-full" min={1} max={currentQty} precision={0} />
          </Form.Item>
        )}
        <Form.Item name="reason" label="原因（可选）">
          <Input.TextArea rows={2} placeholder="取消原因" />
        </Form.Item>
      </Form>
      {allocated > currentQty - (mode === 'all' ? currentQty : 0) && (
        <p className="text-amber-600 text-sm mt-2">
          取消后排单已排量可能超出剩余数量，排单视图将标红提示，请更新排单。
        </p>
      )}
    </Modal>
  );
}
