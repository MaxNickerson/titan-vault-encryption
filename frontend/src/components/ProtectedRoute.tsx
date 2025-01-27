import React, { JSX, useEffect, useState } from 'react';
import {Navigate} from 'react-router-dom';

interface ProtectedRouteProps {
    children: JSX.Element;
  }
  
  const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const [isValid, setIsValid] = useState<boolean | null>(null);
    const accessToken = localStorage.getItem('accessToken');
    const idToken = localStorage.getItem('idToken');
    const refreshToken = localStorage.getItem('refreshToken');
    
    useEffect(() => {
      // if no token found, redirect to login page
      if (!accessToken) {
        setIsValid(false);
        return;
      }

      // veify token with backend 
      fetch('http://localhost:8080/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      })
        .then((response) => {
          if (response.ok) {
            // if server returns 200/OK consider it valid
            setIsValid(true);
          } else {
            setIsValid(false);
          }
        })
        .catch(() => {
          // if there is any error
          setIsValid(false);
        });
      }, [accessToken]);

    // 3. Based on isValid, show some loading state, or redirect, or render children
    if (isValid === null) {
      // Still verifying token...
      return <div>Loading...</div>;
    }

    // 4. If invalid, redirect to login
    if (isValid === false) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("idToken");
      localStorage.removeItem("refreshToken");
      return <Navigate to="/login" replace />;
    }


  
    // If token is present, render the protected component
    return children;
  };
  
  export default ProtectedRoute;