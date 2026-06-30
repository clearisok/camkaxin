import { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Button, Card, Form, Input, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import BrandLogo from '@/components/BrandLogo';
import { useAuth } from '@/contexts/AuthContext';

type LoginFormValues = {
  username: string;
  password: string;
};

export default function LoginPage() {
  const [submitting, setSubmitting] = useState(false);
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (!loading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleFinish = async (values: LoginFormValues) => {
    setSubmitting(true);
    try {
      await login(values.username.trim(), values.password);
      message.success('登录成功');
      navigate(from, { replace: true });
    } catch (err) {
      message.error(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card" bordered={false}>
        <div className="login-brand">
          <BrandLogo variant="page" showName />
        </div>
        <h1 className="login-title">登录柬凯内部系统</h1>
        <p className="login-subtitle">请输入账号密码继续</p>
        <Form<LoginFormValues> layout="vertical" onFinish={handleFinish} requiredMark={false}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" size="large" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
              size="large"
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
