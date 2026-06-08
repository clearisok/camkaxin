import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import Dashboard from './pages/Dashboard';
import QuotationList from './pages/quotations/QuotationList';
import QuotationForm from './pages/quotations/QuotationForm';
import AgentManage from './pages/config/AgentManage';
import BrandManage from './pages/config/BrandManage';
import FabricManage from './pages/config/FabricManage';
import AccessoryManage from './pages/config/AccessoryManage';
import SystemSettings from './pages/config/SystemSettings';
import SchedulingModule from './pages/scheduling/SchedulingModule';
import StyleForm from './pages/scheduling/StyleForm';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="quotations" element={<QuotationList />} />
          <Route path="quotations/new" element={<QuotationForm />} />
          <Route path="quotations/:id" element={<QuotationForm />} />
          <Route path="quotations/:id/edit" element={<QuotationForm />} />
          <Route path="scheduling" element={<SchedulingModule />} />
          <Route path="scheduling/styles/new" element={<StyleForm />} />
          <Route path="scheduling/styles/:id" element={<StyleForm />} />
          <Route path="config/agents" element={<AgentManage />} />
          <Route path="config/brands" element={<BrandManage />} />
          <Route path="config/fabrics" element={<FabricManage />} />
          <Route path="config/accessories" element={<AccessoryManage />} />
          <Route path="config/settings" element={<SystemSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
