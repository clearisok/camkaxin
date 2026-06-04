import { Card, Row, Col, Statistic, Button } from 'antd';
import { FileTextOutlined, PlusOutlined, TagOutlined, SkinOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getQuotations, getBrands, getFabrics } from '@/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ quotations: 0, brands: 0, fabrics: 0, drafts: 0 });

  useEffect(() => {
    Promise.all([
      getQuotations({ pageSize: 1 }),
      getBrands(),
      getFabrics(),
      getQuotations({ status: 'draft', pageSize: 1 }),
    ]).then(([q, b, f, d]) => {
      setStats({
        quotations: q.total || 0,
        brands: b.data?.length || 0,
        fabrics: f.data?.length || 0,
        drafts: d.total || 0,
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="page-container">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">工作台</h1>
          <p className="text-gray-500 mt-1">欢迎使用柬凯报价管理系统</p>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate('/quotations/new')}>
          新建报价单
        </Button>
      </div>

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card className="card-panel border-l-4 border-l-brand-500">
            <Statistic title="报价单总数" value={stats.quotations} prefix={<FileTextOutlined className="text-brand-500" />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="card-panel border-l-4 border-l-orange-400">
            <Statistic title="草稿报价" value={stats.drafts} valueStyle={{ color: '#f97316' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="card-panel border-l-4 border-l-green-500">
            <Statistic title="品牌数量" value={stats.brands} prefix={<TagOutlined className="text-green-500" />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="card-panel border-l-4 border-l-purple-500">
            <Statistic title="面料库" value={stats.fabrics} prefix={<SkinOutlined className="text-purple-500" />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="快速操作" className="card-panel">
            <div className="grid grid-cols-2 gap-3">
              <Button block size="large" onClick={() => navigate('/quotations/new')}>新建报价单</Button>
              <Button block size="large" onClick={() => navigate('/quotations')}>查看报价列表</Button>
              <Button block size="large" onClick={() => navigate('/config/brands')}>品牌管理</Button>
              <Button block size="large" onClick={() => navigate('/config/settings')}>系统设置</Button>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="系统说明" className="card-panel">
            <ul className="text-gray-600 space-y-2 text-sm">
              <li>• 选择品牌后自动关联业务员，并加载品牌基础辅料</li>
              <li>• 工价以 USD 计价，其余费用以 RMB 计价</li>
              <li>• 工价换算公式：USD × 汇率 × 1.13</li>
              <li>• 面料/辅料使用后自动沉淀到库中</li>
              <li>• 支持 Excel 模板导出，占位符自动填充</li>
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
