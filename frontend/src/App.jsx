import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Layout from './components/Layout';

const DailyFocus = lazy(() => import('./pages/DailyFocus'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Board = lazy(() => import('./pages/Board'));
const WeeklyPlanner = lazy(() => import('./pages/WeeklyPlanner'));
const ContextSnapshots = lazy(() => import('./pages/ContextSnapshots'));
const Activity = lazy(() => import('./pages/Activity'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));

function PageLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
      <CircularProgress />
    </Box>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/" element={<DailyFocus />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/board" element={<Board />} />
            <Route path="/week" element={<WeeklyPlanner />} />
            <Route path="/snapshots" element={<ContextSnapshots />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
