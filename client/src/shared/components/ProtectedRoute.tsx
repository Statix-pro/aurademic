import React, { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import {
  canAccessAdminArea,
  canAccessBudgetApproval,
  canAccessFinanceWorkflow,
  canAccessModuleWorkflow,
  canManageAccessControl,
  canAccessExpenditureWorkflow,
} from '../utils/permissionUtils';

interface RouteProps {
  children: ReactNode;
}

export const ProtectedRoute: React.FC<RouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

/*
 * A denied route sends the person to `/dashboard`, not `/home`. There has never
 * been a `/home` route, so every one of these redirects landed on an unmatched
 * path — which, before the catch-all in App.tsx, was a blank document. The
 * dashboard is the one page everyone who is signed in can open.
 */

export const AdminRoute: React.FC<RouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !canAccessAdminArea(user)) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

export const SuperAdminRoute: React.FC<RouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !canManageAccessControl(user)) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

export const BudgetApprovalRoute: React.FC<RouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !canAccessBudgetApproval(user)) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

export const FinanceWorkflowRoute: React.FC<RouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !canAccessFinanceWorkflow(user)) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

export const ModuleWorkflowRoute: React.FC<RouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const params = useParams<{ moduleKey?: string }>();
  const moduleKey = String(params.moduleKey || '')
    .trim()
    .toLowerCase();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !moduleKey || !canAccessModuleWorkflow(user, moduleKey)) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

export const ExpenditureApprovalRoute: React.FC<RouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !canAccessExpenditureWorkflow(user)) {
    return <Navigate to="/workflow/expenditure" />;
  }

  return <>{children}</>;
};
