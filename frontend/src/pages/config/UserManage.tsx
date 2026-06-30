import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Popconfirm,
  Tag,
  Space,
} from 'antd';
import { PlusOutlined, KeyOutlined } from '@ant-design/icons';
import PageHeader from '@/components/PageHeader';
import {
  createAdminUser,
  deleteAdminUser,
  getAdminRoles,
  getAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
  type AdminRole,
  type AdminUser,
} from '@/api/admin';

const STATUS_OPTIONS = [
  { value: 'active', label: '启用' },
  { value: 'disabled', label: '停用' },
];

export default function UserManage() {
  const [data, setData] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [pwdUserId, setPwdUserId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [pwdForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [users, roleList] = await Promise.all([getAdminUsers(), getAdminRoles()]);
      setData(users);
      setRoles(roleList);
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ status: 'active', isSuperAdmin: false, roleCodes: [] });
    setModalOpen(true);
  };

  const openEdit = (record: AdminUser) => {
    setEditing(record);
    form.setFieldsValue({
      username: record.username,
      displayName: record.display_name,
      email: record.email,
      status: record.status,
      isSuperAdmin: record.is_super_admin,
      roleCodes: record.roles,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await updateAdminUser(editing.id, {
          displayName: values.displayName,
          email: values.email,
          status: values.status,
          roleCodes: values.roleCodes,
          isSuperAdmin: values.isSuperAdmin,
        });
        message.success('更新成功');
      } else {
        await createAdminUser({
          username: values.username,
          password: values.password,
          displayName: values.displayName,
          email: values.email,
          roleCodes: values.roleCodes ?? [],
          isSuperAdmin: values.isSuperAdmin,
        });
        message.success('创建成功');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      message.error(String(err));
    }
  };

  const openResetPassword = (userId: number) => {
    setPwdUserId(userId);
    pwdForm.resetFields();
    setPwdModalOpen(true);
  };

  const handleResetPassword = async () => {
    const values = await pwdForm.validateFields();
    if (!pwdUserId) return;
    try {
      await resetAdminUserPassword(pwdUserId, values.password);
      message.success('密码已重置');
      setPwdModalOpen(false);
    } catch (err) {
      message.error(String(err));
    }
  };

  const roleNameMap = Object.fromEntries(roles.map((r) => [r.code, r.name]));

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '用户名', dataIndex: 'username', width: 120 },
    { title: '显示名', dataIndex: 'display_name', width: 120, render: (v: string | null) => v || '-' },
    { title: '邮箱', dataIndex: 'email', width: 160, render: (v: string | null) => v || '-' },
    {
      title: '角色',
      dataIndex: 'roles',
      render: (codes: string[]) =>
        codes?.length ? codes.map((c) => <Tag key={c}>{roleNameMap[c] || c}</Tag>) : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (s: string) => (s === 'active' ? '启用' : '停用'),
    },
    {
      title: '超管',
      dataIndex: 'is_super_admin',
      width: 80,
      render: (v: boolean) => (v ? '是' : '否'),
    },
    {
      title: '操作',
      width: 220,
      render: (_: unknown, record: AdminUser) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" icon={<KeyOutlined />} onClick={() => openResetPassword(record.id)}>
            重置密码
          </Button>
          <Popconfirm
            title="确定删除该用户？"
            onConfirm={async () => {
              try {
                await deleteAdminUser(record.id);
                message.success('已删除');
                load();
              } catch (err) {
                message.error(String(err));
              }
            }}
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="用户管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建用户
          </Button>
        }
      />
      <Table rowKey="id" loading={loading} dataSource={data} columns={columns} pagination={{ pageSize: 20 }} />

      <Modal
        title={editing ? '编辑用户' : '新建用户'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {!editing && (
            <>
              <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password />
              </Form.Item>
            </>
          )}
          <Form.Item name="displayName" label="显示名">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="roleCodes" label="角色">
            <Select mode="multiple" options={roles.map((r) => ({ value: r.code, label: r.name }))} />
          </Form.Item>
          <Form.Item name="isSuperAdmin" label="超级管理员" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="重置密码"
        open={pwdModalOpen}
        onOk={handleResetPassword}
        onCancel={() => setPwdModalOpen(false)}
        destroyOnClose
      >
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="password" label="新密码" rules={[{ required: true, message: '请输入新密码' }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
