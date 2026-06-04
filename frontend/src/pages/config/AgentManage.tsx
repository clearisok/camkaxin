import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getAgents, createAgent, updateAgent, deleteAgent } from '@/api';
import type { Agent } from '@/types';

export default function AgentManage() {
  const [data, setData] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAgents();
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
    { title: '姓名', dataIndex: 'name' },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (s: string) => s === 'active' ? '启用' : '停用',
    },
    {
      title: '操作', width: 160,
      render: (_: unknown, record: Agent) => (
        <>
          <Button type="link" size="small" onClick={() => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={async () => { await deleteAgent(record.id); message.success('已删除'); load(); }}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">业务员管理</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新增业务员</Button>
      </div>
      <div className="card-panel">
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={false} />
      </div>
      <Modal title={editing ? '编辑业务员' : '新增业务员'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical" initialValues={{ status: 'active' }}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[{ value: 'active', label: '启用' }, { value: 'inactive', label: '停用' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
