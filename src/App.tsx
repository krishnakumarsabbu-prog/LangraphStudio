import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout/Layout';
import { LangGraphBuilder } from './components/LangGraph/LangGraphBuilder';
import { LangGraphDashboard } from './components/LangGraph/LangGraphDashboard';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/langgraph" replace />} />
            <Route path="/langgraph" element={<LangGraphDashboard />} />
            <Route path="/langgraph/builder/:workflowId" element={<LangGraphBuilder />} />
          </Route>
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