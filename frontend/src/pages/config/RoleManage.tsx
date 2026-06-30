import { useEffect, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Checkbox,
  message,
  Tag,
  Typography,
  Tabs,
  Select,
  Space,
} from 'antd';
import PageHeader from '@/components/PageHeader';
import {
  getAdminPermissions,
  getAdminRoles,
  getRoleFieldPermissions,
  updateRoleFieldPermissions,
  updateRolePermissions,
  type AdminRole,
  type PermissionItem,
  type RoleFieldPermissionItem,
} from '@/api/admin';
import { MODULE_LABELS } from '@/constants/permissions';
import { FIELD_MODULE_LABELS } from '@/constants/fieldPermissions';

function FunctionalPermissionPanel({
  roles,
  permissions,
  loading,
  onRoleUpdated,
}: {
  roles: AdminRole[];
  permissions: PermissionItem[];
  loading: boolean;
  onRoleUpdated: (role: AdminRole) => void;
}) {
  const [savingId, setSavingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, string[]>>({});

  useEffect(() => {
    const initial: Record<number, string[]> = {};
    for (const role of roles) {
      initial[role.id] = [...role.permissions];
    }
    setDraft(initial);
  }, [roles]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionItem[]>();
    for (const p of permissions) {
      const list = groups.get(p.module) ?? [];
      list.push(p);
      groups.set(p.module, list);
    }
    return groups;
  }, [permissions]);

  const togglePermission = (roleId: number, code: string, checked: boolean) => {
    setDraft((prev) => {
      const current = new Set(prev[roleId] ?? []);
      if (checked) current.add(code);
      else current.delete(code);
      return { ...prev, [roleId]: Array.from(current).sort() };
    });
  };

  const handleSave = async (role: AdminRole) => {
    setSavingId(role.id);
    try {
      const updated = await updateRolePermissions(role.id, draft[role.id] ?? []);
      if (updated) onRoleUpdated(updated);
      message.success(`${role.name} 功能权限已保存`);
    } catch (err) {
      message.error(String(err));
    } finally {
      setSavingId(null);
    }
  };

  const columns = [
    {
      title: '角色',
      dataIndex: 'name',
      width: 160,
      render: (name: string, record: AdminRole) => (
        <div>
          <div>{name}</div>
          <Typography.Text type="secondary" className="text-xs">
            {record.code}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      width: 200,
      render: (v: string | null) => v || '-',
    },
    {
      title: '权限配置',
      render: (_: unknown, record: AdminRole) => {
        if (record.code === 'admin') {
          return <Tag color="gold">拥有全部权限（不可编辑）</Tag>;
        }
        const selected = new Set(draft[record.id] ?? []);
        return (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {[...groupedPermissions.entries()].map(([module, perms]) => (
              <div key={module}>
                <div className="font-medium text-sm mb-1">{MODULE_LABELS[module] || module}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {perms.map((p) => (
                    <Checkbox
                      key={p.code}
                      checked={selected.has(p.code)}
                      onChange={(e) => togglePermission(record.id, p.code, e.target.checked)}
                    >
                      {p.name}
                    </Checkbox>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, record: AdminRole) =>
        record.code === 'admin' ? null : (
          <Button
            type="primary"
            size="small"
            loading={savingId === record.id}
            onClick={() => handleSave(record)}
          >
            保存
          </Button>
        ),
    },
  ];

  return (
    <Table
      rowKey="id"
      loading={loading}
      dataSource={roles}
      columns={columns}
      pagination={false}
      scroll={{ x: 900 }}
    />
  );
}

function FieldPermissionPanel({
  roles,
  loading: rolesLoading,
}: {
  roles: AdminRole[];
  loading: boolean;
}) {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [items, setItems] = useState<RoleFieldPermissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moduleFilter, setModuleFilter] = useState<string>('all');

  const selectableRoles = roles.filter((r) => r.code !== 'admin');

  useEffect(() => {
    if (!selectedRoleId && selectableRoles.length > 0) {
      setSelectedRoleId(selectableRoles[0].id);
    }
  }, [selectableRoles, selectedRoleId]);

  useEffect(() => {
    if (!selectedRoleId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getRoleFieldPermissions(selectedRoleId);
        if (!cancelled) setItems(data);
      } catch (err) {
        message.error(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedRoleId]);

  const modules = useMemo(() => {
    const set = new Set(items.map((i) => i.module));
    return ['all', ...Array.from(set).sort()];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (moduleFilter === 'all') return items;
    return items.filter((i) => i.module === moduleFilter);
  }, [items, moduleFilter]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  const updateItem = (fieldCode: string, patch: Partial<Pick<RoleFieldPermissionItem, 'visible' | 'editable'>>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.field_code !== fieldCode) return item;
        const visible = patch.visible ?? item.visible;
        const editable = patch.editable ?? item.editable;
        return {
          ...item,
          visible,
          editable: visible ? editable : false,
          configured: true,
        };
      }),
    );
  };

  const handleSave = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    try {
      const payload = items.map((item) => ({
        fieldCode: item.field_code,
        visible: item.visible,
        editable: item.editable,
      }));
      const updated = await updateRoleFieldPermissions(selectedRoleId, payload);
      setItems(updated);
      message.success(`${selectedRole?.name ?? '角色'} 字段权限已保存`);
    } catch (err) {
      message.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (selectableRoles.length === 0) {
    return <Typography.Text type="secondary">暂无可用角色</Typography.Text>;
  }

  const columns = [
    { title: '字段', dataIndex: 'label', width: 180 },
    {
      title: '模块',
      dataIndex: 'module',
      width: 100,
      render: (m: string) => FIELD_MODULE_LABELS[m] || m,
    },
    { title: '编码', dataIndex: 'field_code', width: 220, render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
    {
      title: '可见',
      width: 80,
      render: (_: unknown, record: RoleFieldPermissionItem) => (
        <Checkbox
          checked={record.visible}
          onChange={(e) => updateItem(record.field_code, { visible: e.target.checked })}
        />
      ),
    },
    {
      title: '可编辑',
      width: 90,
      render: (_: unknown, record: RoleFieldPermissionItem) => (
        <Checkbox
          checked={record.editable}
          disabled={!record.visible}
          onChange={(e) => updateItem(record.field_code, { editable: e.target.checked })}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Space wrap>
        <span>选择角色</span>
        <Select
          style={{ minWidth: 200 }}
          value={selectedRoleId ?? undefined}
          onChange={setSelectedRoleId}
          options={selectableRoles.map((r) => ({ value: r.id, label: `${r.name} (${r.code})` }))}
        />
        <Select
          style={{ minWidth: 160 }}
          value={moduleFilter}
          onChange={setModuleFilter}
          options={modules.map((m) => ({
            value: m,
            label: m === 'all' ? '全部模块' : (FIELD_MODULE_LABELS[m] || m),
          }))}
        />
        <Button type="primary" loading={saving} onClick={handleSave} disabled={!selectedRoleId}>
          保存字段权限
        </Button>
      </Space>
      {selectedRole?.code === 'admin' ? (
        <Tag color="gold">系统管理员拥有全部字段权限（不可编辑）</Tag>
      ) : (
        <Table
          rowKey="field_code"
          size="small"
          loading={loading || rolesLoading}
          dataSource={filteredItems}
          columns={columns}
          pagination={{ pageSize: 30 }}
          scroll={{ x: 700 }}
        />
      )}
    </div>
  );
}

export default function RoleManage() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [roleList, permList] = await Promise.all([getAdminRoles(), getAdminPermissions()]);
      setRoles(roleList);
      setPermissions(permList);
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6">
      <PageHeader title="角色权限" />
      <Tabs
        items={[
          {
            key: 'functional',
            label: '功能权限',
            children: (
              <FunctionalPermissionPanel
                roles={roles}
                permissions={permissions}
                loading={loading}
                onRoleUpdated={(updated) =>
                  setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
                }
              />
            ),
          },
          {
            key: 'field',
            label: '字段权限',
            children: <FieldPermissionPanel roles={roles} loading={loading} />,
          },
        ]}
      />
    </div>
  );
}
