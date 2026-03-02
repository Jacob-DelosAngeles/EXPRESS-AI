import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';

import { SignIn, SignUp, SignedIn, SignedOut } from '@clerk/clerk-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import ProductsPage from './pages/ProductsPage';
import Dashboard from './pages/Dashboard';
import IRICalculator from './pages/IRICalculator';
import Mapping from './pages/Mapping';
import AdminDashboard from './pages/AdminDashboard';
import Analytics from './pages/Analytics';
import Layout from './components/Layout';
import AuthLayout from './components/Auth/AuthLayout';
import { clerkAppearance } from './utils/clerkTheme';

// True when running inside the Electron desktop shell
const IS_DESKTOP = !!(window.expressAI?.isDesktop);

// Use HashRouter for desktop (file:// protocol) and BrowserRouter for web.
// BrowserRouter uses /app/dashboard paths which fail on file:// (no server).
// HashRouter uses #/app/dashboard which always resolves to index.html.
const Router = IS_DESKTOP ? HashRouter : BrowserRouter;


// Protected Route Component - uses our AuthContext which wraps Clerk
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return children;
};

// Clerk Sign In Page wrapper with custom styling
const LoginPage = () => (
  <AuthLayout>
    <SignIn
      routing="path"
      path="/login"
      signUpUrl="/register"
      afterSignInUrl="/app/dashboard"
      appearance={clerkAppearance}
    />
  </AuthLayout>
);

// Clerk Sign Up Page wrapper with custom styling
const RegisterPage = () => (
  <AuthLayout>
    <SignUp
      routing="path"
      path="/register"
      signInUrl="/login"
      afterSignUpUrl="/app/dashboard"
      appearance={clerkAppearance}
    />
  </AuthLayout>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/products" element={
            IS_DESKTOP ? <Navigate to="/app/dashboard" replace /> : <ProductsPage />
          } />
          <Route path="/login/*" element={<LoginPage />} />
          <Route path="/register/*" element={<RegisterPage />} />

          {/* Protected routes - under /app */}
          <Route path="/app" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="iri" element={<Navigate to="/app/analytics" />} />
            <Route path="mapping" element={<Navigate to="/app/dashboard" />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="reports" element={<div>Reports Component (Coming Soon)</div>} />
            <Route path="settings" element={<div>Settings Component (Coming Soon)</div>} />
          </Route>

          {/* Legacy routes - redirect to new paths */}
          <Route path="/dashboard" element={<Navigate to="/app/dashboard" />} />
          <Route path="/iri" element={<Navigate to="/app/iri" />} />
          <Route path="/mapping" element={<Navigate to="/app/mapping" />} />
          <Route path="/admin" element={<Navigate to="/app/admin" />} />

          {/* Catch all - redirect to landing */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
