import React, { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  canAccessAdminArea,
  canAccessBudgetApproval,
  canAccessFinanceWorkflow,
  canAccessModuleWorkflow,
  canManageAccessControl,
} from "../utils/permissionUtils";

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

export const AdminRoute: React.FC<RouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !canAccessAdminArea(user)) {
    return <Navigate to="/home" />;
  }

  return <>{children}</>;
};

export const SuperAdminRoute: React.FC<RouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !canManageAccessControl(user)) {
    return <Navigate to="/home" />;
  }

  return <>{children}</>;
};

export const BudgetApprovalRoute: React.FC<RouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !canAccessBudgetApproval(user)) {
    return <Navigate to="/home" />;
  }

  return <>{children}</>;
};

export const FinanceWorkflowRoute: React.FC<RouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !canAccessFinanceWorkflow(user)) {
    return <Navigate to="/home" />;
  }

  return <>{children}</>;
};

export const ModuleWorkflowRoute: React.FC<RouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const params = useParams<{ moduleKey?: string }>();
  const moduleKey = String(params.moduleKey || "").trim().toLowerCase();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !moduleKey || !canAccessModuleWorkflow(user, moduleKey)) {
    return <Navigate to="/home" />;
  }

  return <>{children}</>;
};
