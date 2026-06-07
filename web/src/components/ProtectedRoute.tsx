import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && !requiredRoles.includes(user.role)) {
    return <Navigate to="/jobs" replace />;
  }

  return <>{children}</>;
}
