import React, { JSX } from 'react';
import {Navigate} from 'react-router-dom';

interface ProtectedRouteProps {
    children: JSX.Element;
  }
  
  const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const accessToken = localStorage.getItem('accessToken');
    
    // If no token, redirect to login
    if (!accessToken) {
      return <Navigate to="/login" replace />;
    }
  
    // If token is present, render the protected component
    return children;
  };
  
  export default ProtectedRoute;