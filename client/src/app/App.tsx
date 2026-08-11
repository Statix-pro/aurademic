import 'bootstrap/dist/css/bootstrap.min.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from '../contexts/AuthContext';
import AccessControlPage from '../features/admin/accessControl/AccessControlPage';
import Dashboard from '../features/admin/admindashboard';
import AdminBudget from '../features/admin/budget/budget-approval/adminbudget';
import AdminBudgetDashboard from '../features/admin/budget/budget-dashboard/adminbudgetdashboard';
import BudgetCatalogPage from '../features/admin/budgetCatalog/BudgetCatalogPage';
import JournalManagement from '../features/admin/formManagement/JournalFormOptions';
import ProjectFormOptions from '../features/admin/formManagement/ProjectFormOptions';
import MasterDataPage from '../features/admin/masterData/MasterDataPage';
import Login from '../features/auth/login/login';
import Budget from '../features/budget/budget';
import EventDashboard from '../features/events/components/EventDashboard';
import EventEntry from '../features/events/components/EventEntry';
import EventPage from '../features/events/components/EventPage';
import ExpenditureReport from '../features/expenditure/expenditure-report/expenditurereport';
import ExpenditureApproval from '../features/expenditure/expenditureapproval';
import FinanceApproval from '../features/finance/financeapproval';
import GuestHouseBooking from '../features/guesthouse/GuestHouseBooking';
import Journalform from '../features/journals/journalform';
import ProfilePage from '../features/profile/ProfilePage';
import Projectform from '../features/projects/projectform';
import Storybook from '../features/storybook/Storybook';
import BudgetDashboard from '../features/user-dashboard/budgetdashboard/budgetdashboard';
import ExpenditureDashboard from '../features/user-dashboard/expendituredashboard/expendituredashboard';
import FinanceCard from '../features/user-dashboard/financecard/financecard';
import GuestHouseDashboard from '../features/user-dashboard/guesthousedashboard/guesthousedashboard';
import ProjectsPage from '../features/user-dashboard/projectpage/ProjectsPage';
import PublicationsPage from '../features/user-dashboard/publicationspage/PublicationsPage';
import UserDashboard from '../features/user-dashboard/userdashboard';
import { AbilityProvider } from '../shared/casl/AbilityContext';
import MainLayout from '../shared/components/layout/MainLayout';
import { MsalProvider } from '../shared/components/MsalProvider';
import {
  ProtectedRoute,
  AdminRoute,
  BudgetApprovalRoute,
  FinanceWorkflowRoute,
  ModuleWorkflowRoute,
  SuperAdminRoute,
  ExpenditureApprovalRoute,
} from '../shared/components/ProtectedRoute';
import UnderConstruction from '../shared/components/ui/UnderConstruction';
import WorkflowModulePage from '../shared/pages/workflow/WorkflowModulePage';

function App() {
  return (
    <MsalProvider>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
        <BrowserRouter>
          <AuthProvider>
            <AbilityProvider>
              <Routes>
                {/* Login */}
                <Route path="/login" element={<Login />} />

                {/* Main Layout */}
                <Route element={<MainLayout />}>
                  {/* USER ROUTES */}
                  <Route
                    path="/events"
                    element={
                      <ProtectedRoute>
                        <EventDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/event/:eventId"
                    element={
                      <ProtectedRoute>
                        <EventPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/project"
                    element={
                      <ProtectedRoute>
                        <Projectform />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/project/:id"
                    element={
                      <ProtectedRoute>
                        <Projectform />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <UserDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/journal"
                    element={
                      <ProtectedRoute>
                        <Journalform />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/journal/conference"
                    element={
                      <ProtectedRoute>
                        <Journalform />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/journal/book"
                    element={
                      <ProtectedRoute>
                        <Journalform />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/journal/book-chapter"
                    element={
                      <ProtectedRoute>
                        <Journalform />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/journal/:journalId"
                    element={
                      <ProtectedRoute>
                        <Journalform />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/publications"
                    element={
                      <ProtectedRoute>
                        <PublicationsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/projects"
                    element={
                      <ProtectedRoute>
                        <ProjectsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* FINANCE */}
                  <Route
                    path="/finance/new"
                    element={
                      <ProtectedRoute>
                        <FinanceApproval />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/finance/:id"
                    element={
                      <ProtectedRoute>
                        <FinanceApproval />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/finance/:id/edit"
                    element={
                      <ProtectedRoute>
                        <FinanceApproval />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/workflow/:moduleKey"
                    element={
                      <ModuleWorkflowRoute>
                        <WorkflowModulePage />
                      </ModuleWorkflowRoute>
                    }
                  />
                  <Route
                    path="/financecard"
                    element={
                      <ProtectedRoute>
                        <FinanceCard />
                      </ProtectedRoute>
                    }
                  />

                  {/* GUEST HOUSE */}
                  <Route
                    path="/guesthouse-booking"
                    element={
                      <ProtectedRoute>
                        <GuestHouseBooking />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/guestHouse-dashboard"
                    element={
                      <ProtectedRoute>
                        <GuestHouseDashboard />
                      </ProtectedRoute>
                    }
                  />

                  {/* BUDGET */}
                  <Route
                    path="/budgetcard"
                    element={
                      <ProtectedRoute>
                        <BudgetDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/budget/new"
                    element={
                      <ProtectedRoute>
                        <Budget />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/budget/:id"
                    element={
                      <ProtectedRoute>
                        <Budget />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/budget/:id/edit"
                    element={
                      <ProtectedRoute>
                        <Budget />
                      </ProtectedRoute>
                    }
                  />

                  {/* EXPENDITURE */}
                  {/* <Route path="/expenditure" element={<ProtectedRoute><UnderConstruction pageName="Expenditure" /></ProtectedRoute>} /> */}
                  <Route
                    path="/expenditurecard"
                    element={
                      <ProtectedRoute>
                        <ExpenditureDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/expenditure/new"
                    element={
                      <ProtectedRoute>
                        <ExpenditureApproval />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/expenditure/:id"
                    element={
                      <ProtectedRoute>
                        <ExpenditureApproval />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/expenditure/:id/edit"
                    element={
                      <ProtectedRoute>
                        <ExpenditureApproval />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/expenditure/approval"
                    element={
                      <ExpenditureApprovalRoute>
                        <ExpenditureApproval />
                      </ExpenditureApprovalRoute>
                    }
                  />

                  {/* ADMIN */}
                  <Route
                    path="/admin-dashboard"
                    element={
                      <AdminRoute>
                        <Dashboard />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/publication-dashboard"
                    element={
                      <AdminRoute>
                        <Dashboard />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/project-dashboard"
                    element={
                      <AdminRoute>
                        <Dashboard />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/journals"
                    element={
                      <AdminRoute>
                        <JournalManagement />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/form-management/project-options"
                    element={
                      <AdminRoute>
                        <ProjectFormOptions />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/access-control"
                    element={
                      <SuperAdminRoute>
                        <AccessControlPage />
                      </SuperAdminRoute>
                    }
                  />
                  <Route
                    path="/admin/master-data"
                    element={
                      <SuperAdminRoute>
                        <MasterDataPage />
                      </SuperAdminRoute>
                    }
                  />
                  <Route
                    path="/admin/budget-catalog"
                    element={
                      <SuperAdminRoute>
                        <BudgetCatalogPage />
                      </SuperAdminRoute>
                    }
                  />

                  {/* ADMIN BUDGET */}
                  <Route
                    path="/admin/budgetdashboard"
                    element={
                      <BudgetApprovalRoute>
                        <AdminBudgetDashboard />
                      </BudgetApprovalRoute>
                    }
                  />
                  <Route
                    path="/admin/budget"
                    element={
                      <BudgetApprovalRoute>
                        <AdminBudget />
                      </BudgetApprovalRoute>
                    }
                  />
                  <Route
                    path="/admin/budget/:tab"
                    element={
                      <BudgetApprovalRoute>
                        <AdminBudget />
                      </BudgetApprovalRoute>
                    }
                  />
                  <Route path="/adminbudget" element={<Navigate to="/admin/budget" replace />} />
                  <Route
                    path="/adminbudget/*"
                    element={<Navigate to="/admin/budget/approval" replace />}
                  />

                  {/* UTILITY */}
                  <Route
                    path="/eventdashboard"
                    element={
                      <ProtectedRoute>
                        <EventDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/event-entry"
                    element={
                      <ProtectedRoute>
                        <EventEntry />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/storybook" element={<Storybook />} />
                  <Route path="/" element={<Navigate to="/dashboard" />} />

                  {/* UNDER CONSTRUCTION */}
                  <Route
                    path="/vehicle-booking"
                    element={
                      <ProtectedRoute>
                        <UnderConstruction pageName="Vehicle Booking" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/hall-booking"
                    element={
                      <ProtectedRoute>
                        <UnderConstruction pageName="Hall Booking" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/kpi"
                    element={
                      <ProtectedRoute>
                        <UnderConstruction pageName="KPI Dashboard" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/task"
                    element={
                      <ProtectedRoute>
                        <UnderConstruction pageName="Task Management" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports"
                    element={
                      <ProtectedRoute>
                        <UnderConstruction pageName="Reports" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports/finance"
                    element={
                      <ProtectedRoute>
                        <UnderConstruction pageName="Finance Reports" />
                      </ProtectedRoute>
                    }
                  />
                  {/* Any authenticated user may open the report: the API scopes what it
                      returns by role, down to "your own requests" for a plain user, so a
                      route-level approver check would only bounce them to /home. */}
                  <Route
                    path="/reports/expenditure"
                    element={
                      <ProtectedRoute>
                        <ExpenditureReport />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/fellowship"
                    element={
                      <ProtectedRoute>
                        <UnderConstruction pageName="Fellowship" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/patent"
                    element={
                      <ProtectedRoute>
                        <UnderConstruction pageName="Patent" />
                      </ProtectedRoute>
                    }
                  />
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
