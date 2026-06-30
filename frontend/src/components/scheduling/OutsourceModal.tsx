import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { StyleRecord } from '@/types/style';
import { outsourceStyle, previewOutsourceDates, type OutsourceStylePayload } from '@/api/styles';

interface OutsourceModalProps {
  open: boolean;
  record: StyleRecord | null;
  onClose: () => void;
  onSuccess: () => void;
  /** 沙箱等场景：自定义提交，不直接写库 */
  onSubmit?: (payload: OutsourceStylePayload) => Promise<void>;
}

type FormValues = {
  outsourced_factory: string;
  outsourced_price?: number;
  online_time?: Dayjs;
  required_days?: number;
};

export default function OutsourceModal({ open, record, onClose, onSuccess, onSubmit }: OutsourceModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [computedOffline, setComputedOffline] = useState<string | null>(null);

  useEffect(() => {
    if (open && record) {
      form.setFieldsValue({
        outsourced_factory: record.outsourced_factory ?? undefined,
        outsourced_price: record.outsourced_price ?? undefined,
        online_time: record.online_time ? dayjs(String(record.online_time).slice(0, 10)) : undefined,
        required_days: record.required_days ?? undefined,
      });
      setComputedOffline(record.offline_time ? String(record.offline_time).slice(0, 10) : null);
    } else {
      form.resetFields();
      setComputedOffline(null);
    }
  }, [open, record, form]);

  const runPreview = async (patch: Partial<FormValues>) => {
    const merged = { ...form.getFieldsValue(), ...patch };
    if (!merged.online_time || merged.required_days == null || merged.required_days < 1) {
      setComputedOffline(null);
      return;
    }
    setPreviewing(true);
    try {
      const res = await previewOutsourceDates({
        online_time: merged.online_time.format('YYYY-MM-DD'),
        offline_time: null,
        required_days: merged.required_days,
      });
      form.setFieldsValue({
        online_time: dayjs(res.data.online_time),
        required_days: res.data.required_days,
      });
      setComputedOffline(res.data.offline_time);
    } catch (err) {
      message.error(String(err));
    } finally {
      setPreviewing(false);
    }
  };

  const handleOk = async () => {
    if (!record) return;
    try {
      const values = await form.validateFields();
      if (!values.online_time) {
        message.warning('请填写外发上线日期');
        return;
      }
      if (values.required_days == null || values.required_days < 1) {
        message.warning('请填写所需天数');
        return;
      }
      setSubmitting(true);
      const payload: OutsourceStylePayload = {
        outsourced_factory: values.outsourced_factory.trim(),
        outsourced_price: values.outsourced_price,
        online_time: values.online_time.format('YYYY-MM-DD'),
        offline_time: null,
        required_days: values.required_days,
      };
      if (onSubmit) {
        await onSubmit(payload);
      } else {
        await outsourceStyle(record.id, payload);
        message.success('外发成功');
        onSuccess();
      }
      onClose();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`外发 — ${record?.style_number ?? ''}`}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={submitting}
      destroyOnClose
      width={480}
    >
      <Form form={form} layout="vertical" className="mt-2">
        <Form.Item
          name="outsourced_factory"
          label="外发工厂"
          rules={[{ required: true, message: '请填写外发工厂' }]}
        >
          <Input placeholder="外发工厂" />
        </Form.Item>
        <Form.Item name="outsourced_price" label="外发单价">
          <InputNumber className="w-full" min={0} step={0.01} precision={2} placeholder="可选" />
        </Form.Item>
        <Form.Item
          name="online_time"
          label="外发上线时间"
          rules={[{ required: true, message: '请填写外发上线日期' }]}
        >
          <DatePicker
            className="w-full"
            disabled={previewing}
            onChange={(v) => { void runPreview({ online_time: v ?? undefined }); }}
          />
        </Form.Item>
        <Form.Item
          name="required_days"
          label="所需天数（工作日）"
          rules={[{ required: true, message: '请填写所需天数' }]}
        >
          <InputNumber
            className="w-full"
            min={1}
            precision={0}
            disabled={previewing}
            onChange={(v) => { void runPreview({ required_days: v ?? undefined }); }}
          />
        </Form.Item>
        <Form.Item label="外发下线时间">
          <Input value={computedOffline ?? '填写上线与天数后自动计算'} readOnly />
        </Form.Item>
        <p className="text-xs text-gray-500 mb-0">下线日期由上线日期、所需天数及节假日自动计算，无需手动填写。</p>
      </Form>
    </Modal>
  );
}
