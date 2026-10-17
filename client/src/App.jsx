import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Leads from './pages/Leads.jsx';
import LeadDetail from './pages/LeadDetail.jsx';
import Properties from './pages/Properties.jsx';
import Bookings from './pages/Bookings.jsx';
import Team from './pages/Team.jsx';
import { Skeleton } from './ui.jsx';

function Guard({ admin, children }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div style={{ padding: 40 }}><Skeleton /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="properties" element={<Properties />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="team" element={<Guard admin><Team /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
