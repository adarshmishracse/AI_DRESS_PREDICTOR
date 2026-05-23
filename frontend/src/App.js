import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';

// Import Pages
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';
import SelectionPage from './SelectionPage';
import ResultPage from './ResultPage';
import InventoryPage from './InventoryPage';


// This checks if a user is allowed to enter int the software
const ProtectedRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
   
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    // Show a spinner while checking permission
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;
  }

  if (!user) {
    // If not logged in, kick them back to Login Page
    return <Navigate to="/login" replace />;
  }

  // If logged in, let them pass
  return children;
};



function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Public Route */}
        <Route path="/login" element={<LoginPage />} />

        {/* --- PROTECTED ROUTES (Only for Logged In Users) --- */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/selection" element={
          <ProtectedRoute>
            <SelectionPage />
          </ProtectedRoute>
        } />
        
        <Route path="/result" element={
          <ProtectedRoute>
            <ResultPage />
          </ProtectedRoute>
        } />

        <Route path="/inventory" element={
          <ProtectedRoute>
            <InventoryPage />
          </ProtectedRoute>
        } />

      </Routes>
    </Router>
  );
}

export default App;
