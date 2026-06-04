import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, InputNumber } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getBrands, getAgents, createBrand, updateBrand, deleteBrand, getBrandDefaultAccessories, updateBrandDefaultAccessories } from '@/api';
import type { Brand, Agent, Accessory } from '@/types';

export default function BrandManage() {
  const [data, setData] = useState<Brand[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [accModalOpen, setAccModalOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [defaultAccs, setDefaultAccs] = useState<Accessory[]>([]);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [b, a] = await Promise.all([getBrands(), getAgents()]);
      setData(b.data || []);
      setAgents(a.data || []);
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
      if (editing) {
        await updateBrand(editing.id, values);
        message.success('更新成功');
      } else {
        await createBrand(values);
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

  const openAccModal = async (brand: Brand) => {
    setEditing(brand);
    try {
      const res = await getBrandDefaultAccessories(brand.id);
      setDefaultAccs(res.data || []);
    } catch {
      setDefaultAccs([]);
    }
    setAccModalOpen(true);
  };

  const saveDefaultAccs = async () => {
    if (!editing) return;
    try {
      await updateBrandDefaultAccessories(editing.id, defaultAccs);
      message.success('基础辅料已保存');
      setAccModalOpen(false);
    } catch (err) {
      message.error(String(err));
    }
  };

  const columns = [
    { title: '品牌名称', dataIndex: 'name' },
    { title: '业务员', dataIndex: 'agent_name_ref', width: 120 },
    { title: '使用次数', dataIndex: 'use_count', width: 100 },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (s: string) => s === 'active' ? '启用' : '停用',
    },
    {
      title: '操作', width: 240,
      render: (_: unknown, record: Brand) => (
        <>
          <Button type="link" size="small" onClick={() => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); }}>编辑</Button>
          <Button type="link" size="small" onClick={() => openAccModal(record)}>基础辅料</Button>
          <Popconfirm title="确定删除？" onConfirm={async () => { await deleteBrand(record.id); message.success('已删除'); load(); }}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">品牌管理</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新增品牌</Button>
      </div>
      <div className="card-panel">
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={false} />
      </div>

      <Modal title={editing ? '编辑品牌' : '新增品牌'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical" initialValues={{ status: 'active' }}>
          <Form.Item name="name" label="品牌名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="agent_id" label="关联业务员">
            <Select allowClear options={agents.map((a) => ({ value: a.id, label: a.name }))} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[{ value: 'active', label: '启用' }, { value: 'inactive', label: '停用' }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`${editing?.name} - 基础辅料`} open={accModalOpen} onOk={saveDefaultAccs} onCancel={() => setAccModalOpen(false)} width={700}>
        {defaultAccs.map((acc, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <Input placeholder="名称" value={acc.name} onChange={(e) => { const a = [...defaultAccs]; a[i] = { ...a[i], name: e.target.value }; setDefaultAccs(a); }} />
            <InputNumber placeholder="单耗" value={acc.consumption} onChange={(v) => { const a = [...defaultAccs]; a[i] = { ...a[i], consumption: v ?? 1 }; setDefaultAccs(a); }} />
            <InputNumber placeholder="损耗%" value={acc.wastage} onChange={(v) => { const a = [...defaultAccs]; a[i] = { ...a[i], wastage: v ?? 5 }; setDefaultAccs(a); }} />
            <InputNumber placeholder="单价" value={acc.unit_price} onChange={(v) => { const a = [...defaultAccs]; a[i] = { ...a[i], unit_price: v ?? 0 }; setDefaultAccs(a); }} />
            <Button danger type="text" onClick={() => setDefaultAccs(defaultAccs.filter((_, j) => j !== i))}>删</Button>
          </div>
        ))}
        <Button type="dashed" block onClick={() => setDefaultAccs([...defaultAccs, { name: '', consumption: 1, wastage: 5, unit_price: 0 }])}>添加辅料</Button>
      </Modal>
    </div>
  );
}
