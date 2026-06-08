import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, InputNumber } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getBrands, createBrand, updateBrand, deleteBrand, getBrandDefaultAccessories, updateBrandDefaultAccessories } from '@/api';
import type { Brand, Accessory } from '@/types';
import PageHeader from '@/components/PageHeader';

export default function BrandManage() {
  const [data, setData] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [accModalOpen, setAccModalOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [defaultAccs, setDefaultAccs] = useState<Accessory[]>([]);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const b = await getBrands();
      setData(b.data || []);
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

  const openEdit = (record: Brand) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      status: record.status,
    });
    setModalOpen(true);
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
    {
      title: '业务员', width: 200,
      render: (_: unknown, record: Brand) =>
        (record.agents || []).map((a) => a.name).join('、') || '-',
    },
    { title: '使用次数', dataIndex: 'use_count', width: 100 },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (s: string) => s === 'active' ? '启用' : '停用',
    },
    {
      title: '操作', width: 240,
      render: (_: unknown, record: Brand) => (
        <>
          <Button type="link" size="small" onClick={() => openEdit(record)}>编辑</Button>
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
      <PageHeader
        title="品牌管理"
        description="业务员归属请在「业务员管理」中配置，同一品牌可有多个业务员"
        extra={(
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
            新增品牌
          </Button>
        )}
      />
      <div className="card-panel">
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={false} />
      </div>

      <Modal title={editing ? '编辑品牌' : '新增品牌'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical" initialValues={{ status: 'active' }}>
          <Form.Item name="name" label="品牌名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[{ value: 'active', label: '启用' }, { value: 'inactive', label: '停用' }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`${editing?.name} - 基础辅料`} open={accModalOpen} onOk={saveDefaultAccs} onCancel={() => setAccModalOpen(false)} width={700}>
        <div className="grid grid-cols-[1fr_88px_88px_96px_48px] gap-2 items-center mb-2 pb-2 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-600">名称</span>
          <span className="text-sm font-medium text-gray-600">单耗</span>
          <span className="text-sm font-medium text-gray-600">损耗%</span>
          <span className="text-sm font-medium text-gray-600">单价</span>
          <span className="text-sm font-medium text-gray-600 text-center">操作</span>
        </div>
        {defaultAccs.map((acc, i) => (
          <div key={i} className="grid grid-cols-[1fr_88px_88px_96px_48px] gap-2 items-center mb-2">
            <Input placeholder="名称" value={acc.name} onChange={(e) => { const a = [...defaultAccs]; a[i] = { ...a[i], name: e.target.value }; setDefaultAccs(a); }} />
            <InputNumber className="w-full" placeholder="单耗" value={acc.consumption} onChange={(v) => { const a = [...defaultAccs]; a[i] = { ...a[i], consumption: v ?? 1 }; setDefaultAccs(a); }} />
            <InputNumber className="w-full" placeholder="损耗%" value={acc.wastage} onChange={(v) => { const a = [...defaultAccs]; a[i] = { ...a[i], wastage: v ?? 5 }; setDefaultAccs(a); }} />
            <InputNumber className="w-full" placeholder="单价" value={acc.unit_price} onChange={(v) => { const a = [...defaultAccs]; a[i] = { ...a[i], unit_price: v ?? 0 }; setDefaultAccs(a); }} />
            <Button danger type="text" className="!px-0" onClick={() => setDefaultAccs(defaultAccs.filter((_, j) => j !== i))}>删</Button>
          </div>
        ))}
        <Button type="dashed" block onClick={() => setDefaultAccs([...defaultAccs, { name: '', consumption: 1, wastage: 5, unit_price: 0 }])}>添加辅料</Button>
      </Modal>
    </div>
  );
}
