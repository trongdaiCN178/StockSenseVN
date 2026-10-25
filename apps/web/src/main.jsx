import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import './styles/prototype.css';
import './styles/app.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
