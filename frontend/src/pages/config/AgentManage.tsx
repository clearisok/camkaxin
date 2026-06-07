import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, message, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getAgents, getBrands, createAgent, updateAgent, deleteAgent } from '@/api';
import PageHeader from '@/components/PageHeader';
import type { Agent, Brand } from '@/types';

export default function AgentManage() {
  const [data, setData] = useState<Agent[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [agentsRes, brandsRes] = await Promise.all([getAgents(), getBrands()]);
      setData(agentsRes.data || []);
      setBrands(brandsRes.data || []);
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openEdit = (record: Agent) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      status: record.status,
      default_wastage: record.default_wastage ?? 5,
      brand_id: record.brand_id,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await updateAgent(editing.id, values);
        message.success('更新成功');
      } else {
        await createAgent(values);
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
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '姓名', dataIndex: 'name', width: 120 },
    { title: '所属品牌', dataIndex: 'brand_name_ref', width: 160, render: (v: string) => v || '-' },
    { title: '默认损耗%', dataIndex: 'default_wastage', width: 110, render: (v: number) => v ?? 5 },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (s: string) => s === 'active' ? '启用' : '停用',
    },
    {
      title: '操作', width: 160,
      render: (_: unknown, record: Agent) => (
        <>
          <Button type="link" size="small" onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={async () => { await deleteAgent(record.id); message.success('已删除'); load(); }}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <div className="page-container">
      <PageHeader
        title="业务员管理"
        description="每个业务员仅归属一个品牌，同一品牌可有多个业务员"
        extra={(
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
            新增业务员
          </Button>
        )}
      />
      <div className="card-panel">
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={false} scroll={{ x: 800 }} />
      </div>
      <Modal title={editing ? '编辑业务员' : '新增业务员'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={520}>
        <Form form={form} layout="vertical" initialValues={{ status: 'active', default_wastage: 5 }}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="brand_id" label="所属品牌" rules={[{ required: true, message: '请选择所属品牌' }]}>
            <Select
              allowClear
              placeholder="选择品牌"
              options={brands.map((b) => ({ value: b.id, label: b.name }))}
            />
          </Form.Item>
          <Form.Item name="default_wastage" label="默认损耗 (%)" rules={[{ required: true }]}>
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
