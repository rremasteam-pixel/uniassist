import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './lib/auth';
import { I18nProvider, useI18n } from './lib/i18n';
import { Spinner, ToastProvider } from './lib/ui';
import type { Role } from './lib/types';
import Layout from './components/Layout';
import { Login, Register } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Documents from './pages/Documents';
import { Courses, Schedule, Exams, Directory } from './pages/Academics';
import { Announcements, Notifications, Questions } from './pages/Communication';
import { Profile, SearchPage, Users } from './pages/Account';

function Protected({ roles, children }: { roles?: Role[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner className="h-8 w-8" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

function NotFound() { const { t } = useI18n(); return <p className="text-ink-500">{t('notFoundPage')}</p>; }

function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="chat" element={<Chat />} />
        <Route path="chat/:id" element={<Chat />} />
        <Route path="documents" element={<Documents />} />
        <Route path="courses" element={<Protected roles={['student', 'teacher']}><Courses /></Protected>} />
        <Route path="schedule" element={<Protected roles={['student', 'teacher']}><Schedule /></Protected>} />
        <Route path="exams" element={<Exams />} />
        <Route path="directory" element={<Directory />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="questions" element={<Protected roles={['teacher', 'admin']}><Questions /></Protected>} />
        <Route path="users" element={<Protected roles={['admin']}><Users /></Protected>} />
        <Route path="profile" element={<Profile />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></I18nProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
