import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getAllAccessories, createAccessory, updateAccessory, deleteAccessory } from '@/api';
import type { Accessory } from '@/types';

export default function AccessoryManage() {
  const [data, setData] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Accessory | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAllAccessories();
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
        await updateAccessory(editing.id, values);
        message.success('更新成功');
      } else {
        await createAccessory(values);
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
    { title: '名称', dataIndex: 'name' },
    { title: '参考单价', dataIndex: 'reference_price', width: 120 },
    { title: '使用次数', dataIndex: 'use_count', width: 100 },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s === 'active' ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作', width: 140,
      render: (_: unknown, record: Accessory) => (
        <>
          <Button type="link" size="small" onClick={() => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={async () => { await deleteAccessory(record.id!); message.success('已删除'); load(); }}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">辅料库</h1>
          <p className="text-gray-500 text-sm mt-1">报价时使用的辅料自动沉淀到此库</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新增辅料</Button>
      </div>
      <div className="card-panel">
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={false} />
      </div>

      <Modal title={editing ? '编辑辅料' : '新增辅料'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical" initialValues={{ status: 'active' }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="reference_price" label="参考单价"><InputNumber className="w-full" min={0} step={0.01} /></Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[{ value: 'active', label: '启用' }, { value: 'inactive', label: '停用' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
