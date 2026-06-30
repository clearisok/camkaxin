import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import RequireAuth from './components/RequireAuth';
import RequirePermission from './components/RequirePermission';
import LoginPage from './pages/auth/LoginPage';
import Dashboard from './pages/Dashboard';
import QuotationList from './pages/quotations/QuotationList';
import QuotationForm from './pages/quotations/QuotationForm';
import AgentManage from './pages/config/AgentManage';
import BrandManage from './pages/config/BrandManage';
import FabricManage from './pages/config/FabricManage';
import AccessoryManage from './pages/config/AccessoryManage';
import HolidayManage from './pages/config/HolidayManage';
import SystemSettings from './pages/config/SystemSettings';
import UserManage from './pages/config/UserManage';
import RoleManage from './pages/config/RoleManage';
import SchedulingModule from './pages/scheduling/SchedulingModule';
import StyleForm from './pages/scheduling/StyleForm';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<RequirePermission permission="menu.dashboard.view"><Dashboard /></RequirePermission>} />
            <Route path="quotations" element={<RequirePermission permission="menu.quotations.view"><QuotationList /></RequirePermission>} />
            <Route path="quotations/new" element={<RequirePermission permission="quotations.create"><QuotationForm /></RequirePermission>} />
            <Route path="quotations/:id" element={<RequirePermission permission="menu.quotations.view"><QuotationForm /></RequirePermission>} />
            <Route path="quotations/:id/edit" element={<RequirePermission permission="quotations.update"><QuotationForm /></RequirePermission>} />
            <Route path="scheduling" element={<RequirePermission permission="menu.scheduling.view"><SchedulingModule /></RequirePermission>} />
            <Route path="scheduling/styles/new" element={<RequirePermission permission="scheduling.style_edit"><StyleForm /></RequirePermission>} />
            <Route path="scheduling/styles/:id" element={<RequirePermission permission="scheduling.view"><StyleForm /></RequirePermission>} />
            <Route path="config/agents" element={<RequirePermission permission="config.agents.manage"><AgentManage /></RequirePermission>} />
            <Route path="config/brands" element={<RequirePermission permission="config.brands.manage"><BrandManage /></RequirePermission>} />
            <Route path="config/fabrics" element={<RequirePermission permission="config.fabrics.manage"><FabricManage /></RequirePermission>} />
            <Route path="config/accessories" element={<RequirePermission permission="config.accessories.manage"><AccessoryManage /></RequirePermission>} />
            <Route path="config/holidays" element={<RequirePermission permission="config.holidays.manage"><HolidayManage /></RequirePermission>} />
            <Route path="config/settings" element={<RequirePermission permission="config.settings.manage"><SystemSettings /></RequirePermission>} />
            <Route path="config/users" element={<RequirePermission permission="admin.users.manage"><UserManage /></RequirePermission>} />
            <Route path="config/roles" element={<RequirePermission permission="admin.roles.manage"><RoleManage /></RequirePermission>} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
