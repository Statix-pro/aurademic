import React, { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  canAccessAdminArea,
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
