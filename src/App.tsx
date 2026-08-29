import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout/Layout';
import { PrivateRoute } from './components/guards/PrivateRoute';

// Existing pages
import { LangGraphBuilder } from './components/LangGraph/LangGraphBuilder';
import { LangGraphDashboard } from './components/LangGraph/LangGraphDashboard';
import { MyNodesPage } from './TenantNodePlatform/MyNodesPage';
import { TenantLoginPage } from './TenantNodePlatform/TenantLoginPage';

// New framework (Super Admin) pages
import { FrameworkDashboard } from './framework/FrameworkDashboard';
import { FrameworkNodeLibrary } from './framework/FrameworkNodeLibrary';
import { TenantManagementPage } from './framework/TenantManagementPage';
import { AuditLogPage } from './framework/AuditLogPage';

// New tenant pages
import { TenantDashboard } from './tenant/TenantDashboard';
import { ExecutionHistoryPage } from './tenant/ExecutionHistoryPage';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Public: Login */}
          <Route path="/login" element={<TenantLoginPage />} />

          {/* Protected: All app routes under Layout */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            {/* Default redirect */}
            <Route index element={<Navigate to="/tenant/dashboard" replace />} />

            {/* ---------- Tenant Shell ---------- */}
            <Route path="/tenant/dashboard" element={<TenantDashboard />} />
            <Route path="/tenant/executions" element={<ExecutionHistoryPage />} />
            <Route path="/tenant/audit" element={<AuditLogPage platformWide={false} />} />

            {/* ---------- Workflow Studio (existing) ---------- */}
            <Route path="/langgraph" element={<LangGraphDashboard />} />
            <Route path="/langgraph/builder/:workflowId" element={<LangGraphBuilder />} />

            {/* ---------- Tenant Node Library (Tenant Admin & Super Admin only) ---------- */}
            <Route
              path="/my-nodes"
              element={
                <PrivateRoute requiredRole="TENANT_ADMIN">
                  <MyNodesPage />
                </PrivateRoute>
              }
            />

            {/* ---------- Framework Admin (Super Admin only) ---------- */}
            <Route
              path="/framework/dashboard"
              element={
                <PrivateRoute requiredRole="SUPER_ADMIN">
                  <FrameworkDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/framework/nodes"
              element={
                <PrivateRoute requiredRole="SUPER_ADMIN">
                  <FrameworkNodeLibrary />
                </PrivateRoute>
              }
            />
            <Route
              path="/framework/tenants"
              element={
                <PrivateRoute requiredRole="SUPER_ADMIN">
                  <TenantManagementPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/framework/audit"
              element={
                <PrivateRoute requiredRole="SUPER_ADMIN">
                  <AuditLogPage platformWide={true} />
                </PrivateRoute>
              }
            />

            {/* ---------- Legacy redirects ---------- */}
            <Route path="/metrics" element={<Navigate to="/tenant/dashboard" replace />} />
            <Route path="/champion-challenger" element={<Navigate to="/langgraph" replace />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/tenant/dashboard" replace />} />
        </Routes>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#FFFFFF',
              color: '#000000',
              border: '1px solid #D0D0D0',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            },
          }}
        />
      </Router>
    </ThemeProvider>
  );
}

export default App;