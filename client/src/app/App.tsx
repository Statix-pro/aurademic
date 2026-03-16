import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';

import Home from '../features/home/home';
import Login from '../features/auth/login/login';
import EventPage from '../features/events/components/EventPage';
import Journalform from '../features/journals/journalform';
import Projectform from '../features/projects/projectform';
import Dashboard from '../features/admin/admindashboard';
import JournalManagement from '../features/admin/formManagement/JournalFormOptions';
import UserDashboard from '../features/user-dashboard/userdashboard';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '../contexts/AuthContext';

import {
  ProtectedRoute,
  AdminRoute,
  BudgetApprovalRoute,
  SuperAdminRoute,
} from '../shared/components/ProtectedRoute';

import { MsalProvider } from '../shared/components/MsalProvider';

import ProjectFormOptions from '../features/admin/formManagement/ProjectFormOptions';
import EventDashboard from '../features/events/components/EventDashboard';
import EventEntry from '../features/events/components/EventEntry';
import PublicationsPage from '../features/user-dashboard/publicationspage/PublicationsPage';
import ProjectsPage from '../features/user-dashboard/projectpage/ProjectsPage';
import Storybook from '../features/storybook/Storybook';

import FinanceApproval from '../features/finance/financeapproval';
import FinanceCard from '../features/user-dashboard/financecard/financecard';

import GuestHouseBooking from '../features/guesthouse/GuestHouseBooking';
import GuestHouseDashboard from '../features/user-dashboard/guesthousedashboard/guesthousedashboard';

import Budget from '../features/budget/budget';
import BudgetDashboard from '../features/user-dashboard/budgetdashboard/budgetdashboard';

import AdminBudget from '../features/admin/budget/budget-approval/adminbudget';
import AdminBudgetDashboard from '../features/admin/budget/budget-dashboard/adminbudgetdashboard';

import UnderConstruction from '../shared/components/ui/UnderConstruction';
import ProfilePage from '../features/profile/ProfilePage';

import AccessControlPage from '../features/admin/accessControl/AccessControlPage';
import MasterDataPage from '../features/admin/masterData/MasterDataPage';

import { AbilityProvider } from '../shared/casl/AbilityContext';
import MainLayout from '../shared/components/layout/MainLayout';

function App() {
  return (
    <MsalProvider>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
        <BrowserRouter>
          <AuthProvider>
            <AbilityProvider>

              <SpeedInsights />

              <Routes>

                {/* Login without navbar */}
                <Route path="/login" element={<Login />} />

                {/* All main routes use layout */}
                <Route element={<MainLayout />}>

                  <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />

                  {/* EVENTS */}
                  <Route path="/events" element={<ProtectedRoute><EventDashboard /></ProtectedRoute>} />
                  <Route path="/event/:eventId" element={<ProtectedRoute><EventPage /></ProtectedRoute>} />
                  <Route path="/event-entry" element={<ProtectedRoute><EventEntry /></ProtectedRoute>} />

                  {/* PROJECTS */}
                  <Route path="/project" element={<ProtectedRoute><Projectform /></ProtectedRoute>} />
                  <Route path="/project/:id" element={<ProtectedRoute><Projectform /></ProtectedRoute>} />
                  <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />

                  {/* JOURNALS */}
                  <Route path="/journal" element={<ProtectedRoute><Journalform /></ProtectedRoute>} />
                  <Route path="/journal/conference" element={<ProtectedRoute><Journalform /></ProtectedRoute>} />
                  <Route path="/journal/book" element={<ProtectedRoute><Journalform /></ProtectedRoute>} />
                  <Route path="/journal/book-chapter" element={<ProtectedRoute><Journalform /></ProtectedRoute>} />
                  <Route path="/journal/:journalId" element={<ProtectedRoute><Journalform /></ProtectedRoute>} />

                  {/* DASHBOARD */}
                  <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
                  <Route path="/publications" element={<ProtectedRoute><PublicationsPage /></ProtectedRoute>} />

                  {/* FINANCE */}
                  <Route path="/finance/new" element={<ProtectedRoute><FinanceApproval /></ProtectedRoute>} />
                  <Route path="/financecard" element={<ProtectedRoute><FinanceCard /></ProtectedRoute>} />

                  {/* GUEST HOUSE */}
                  <Route path="/guesthouse-booking" element={<ProtectedRoute><GuestHouseBooking /></ProtectedRoute>} />
                  <Route path="/guestHouse-dashboard" element={<ProtectedRoute><GuestHouseDashboard /></ProtectedRoute>} />

                  {/* BUDGET */}
                  <Route path="/budgetcard" element={<ProtectedRoute><BudgetDashboard /></ProtectedRoute>} />
                  <Route path="/budget/new" element={<ProtectedRoute><Budget /></ProtectedRoute>} />
                  <Route path="/budget/:id" element={<ProtectedRoute><Budget /></ProtectedRoute>} />
                  <Route path="/budget/:id/edit" element={<ProtectedRoute><Budget /></ProtectedRoute>} />

                  {/* ADMIN */}
                  <Route path="/admin-dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
                  <Route path="/admin/journals" element={<AdminRoute><JournalManagement /></AdminRoute>} />
                  <Route path="/admin/form-management/project-options" element={<AdminRoute><ProjectFormOptions /></AdminRoute>} />

                  <Route path="/access-control" element={<SuperAdminRoute><AccessControlPage /></SuperAdminRoute>} />
                  <Route path="/admin/master-data" element={<SuperAdminRoute><MasterDataPage /></SuperAdminRoute>} />

                  {/* ADMIN BUDGET */}
                  <Route path="/admin/budgetdashboard" element={<BudgetApprovalRoute><AdminBudgetDashboard /></BudgetApprovalRoute>} />
                  <Route path="/admin/budget" element={<BudgetApprovalRoute><AdminBudget /></BudgetApprovalRoute>} />
                  <Route path="/admin/budget/:tab" element={<BudgetApprovalRoute><AdminBudget /></BudgetApprovalRoute>} />

                  <Route path="/adminbudget" element={<Navigate to="/admin/budget" replace />} />
                  <Route path="/adminbudget/*" element={<Navigate to="/admin/budget/approval" replace />} />

                  {/* UTILITY */}
                  <Route path="/storybook" element={<Storybook />} />
                  <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

                  <Route path="/" element={<Navigate to="/home" />} />

                  {/* UNDER CONSTRUCTION */}
                  <Route path="/vehicle-booking" element={<ProtectedRoute><UnderConstruction pageName="Vehicle Booking" /></ProtectedRoute>} />
                  <Route path="/hall-booking" element={<ProtectedRoute><UnderConstruction pageName="Hall Booking" /></ProtectedRoute>} />
                  <Route path="/kpi" element={<ProtectedRoute><UnderConstruction pageName="KPI Dashboard" /></ProtectedRoute>} />
                  <Route path="/task" element={<ProtectedRoute><UnderConstruction pageName="Task Management" /></ProtectedRoute>} />
                  <Route path="/reports" element={<ProtectedRoute><UnderConstruction pageName="Reports" /></ProtectedRoute>} />
                  <Route path="/fellowship" element={<ProtectedRoute><UnderConstruction pageName="Fellowship" /></ProtectedRoute>} />
                  <Route path="/patent" element={<ProtectedRoute><UnderConstruction pageName="Patent" /></ProtectedRoute>} />

                </Route>

              </Routes>

            </AbilityProvider>
          </AuthProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </MsalProvider>
  );
}

export default App;