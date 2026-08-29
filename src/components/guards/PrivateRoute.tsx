import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../TenantNodePlatform/authStore';

interface PrivateRouteProps {
  children: React.ReactNode;
  requiredRole?: 'SUPER_ADMIN' | 'TENANT_ADMIN';
}

/**
 * Route guard — redirects to /login if not authenticated.
 * Optionally requires a specific role (e.g., SUPER_ADMIN for framework routes).
 */
export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, currentUser } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
    return <Navigate to="/tenant/dashboard" replace />;
  }

  if (requiredRole === 'TENANT_ADMIN' &&
      currentUser.role !== 'SUPER_ADMIN' &&
      currentUser.role !== 'TENANT_ADMIN') {
    return <Navigate to="/tenant/dashboard" replace />;
  }

  return <>{children}</>;
};
