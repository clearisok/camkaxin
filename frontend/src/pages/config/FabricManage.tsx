import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getAllFabrics, createFabric, updateFabric, deleteFabric } from '@/api';
import { calcGrossWidth } from '@/utils/calculation';
import type { Fabric } from '@/types';
import PageHeader from '@/components/PageHeader';

export default function FabricManage() {
  const [data, setData] = useState<Fabric[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Fabric | null>(null);
  const [form] = Form.useForm();
  const netWidth = Form.useWatch('net_width', form);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAllFabrics();
      setData(res.data || []);
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing?.id) {
        await updateFabric(editing.id, values);
        message.success('更新成功');
      } else {
        await createFabric(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      load();
    } catch (err) {
      message.error(String(err));
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '成分', dataIndex: 'composition', ellipsis: true },
    { title: '克重', dataIndex: 'weight', width: 80 },
    { title: '净门幅', dataIndex: 'net_width', width: 80 },
    {
      title: '毛门幅', width: 80,
      render: (_: unknown, r: Fabric) => calcGrossWidth(r.net_width || 0),
    },
    {
      title: '单位', dataIndex: 'unit', width: 70,
      render: (u: string) => u === 'kg' ? '千克' : '米',
    },
    { title: '参考单价', dataIndex: 'reference_price', width: 100 },
    { title: '默认损耗%', dataIndex: 'default_wastage', width: 100, render: (v: number) => v ?? 5 },
    { title: '使用次数', dataIndex: 'use_count', width: 90 },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s === 'active' ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作', width: 140,
      render: (_: unknown, record: Fabric) => (
        <>
          <Button type="link" size="small" onClick={() => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={async () => { await deleteFabric(record.id!); message.success('已删除'); load(); }}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <div className="page-container">
      <PageHeader
        title="面料库"
        description="报价时使用的面料自动沉淀到此库"
        extra={(
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
            新增面料
          </Button>
        )}
      />
      <div className="card-panel">
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} scroll={{ x: 1000 }} />
      </div>

      <Modal title={editing ? '编辑面料' : '新增面料'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={560}>
        <Form form={form} layout="vertical" initialValues={{ unit: 'meter', status: 'active', default_wastage: 5 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="composition" label="成分"><Input /></Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="weight" label="克重 (g/m²)"><InputNumber className="w-full" min={0} /></Form.Item>
            <Form.Item name="net_width" label="净门幅 (厘米)"><InputNumber className="w-full" min={0} /></Form.Item>
          </div>
          {netWidth != null && (
            <p className="text-sm text-gray-500 -mt-2 mb-4">毛门幅（自动计算）: {calcGrossWidth(netWidth)} 厘米</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="unit" label="单位">
              <Select options={[{ value: 'meter', label: '米' }, { value: 'kg', label: '千克' }]} />
            </Form.Item>
            <Form.Item name="reference_price" label="参考单价"><InputNumber className="w-full" min={0} step={0.01} /></Form.Item>
          </div>
          <Form.Item name="default_wastage" label="默认损耗 (%)">
            <InputNumber className="w-full" min={0} max={100} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[{ value: 'active', label: '启用' }, { value: 'inactive', label: '停用' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
