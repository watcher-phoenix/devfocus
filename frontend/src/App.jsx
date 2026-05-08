import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Layout from './components/Layout';

const DailyFocus = lazy(() => import('./pages/DailyFocus'));
const Board = lazy(() => import('./pages/Board'));
const WeeklyPlanner = lazy(() => import('./pages/WeeklyPlanner'));
const Settings = lazy(() => import('./pages/Settings'));
const Trends = lazy(() => import('./pages/Trends'));
const Notes = lazy(() => import('./pages/Notes'));
const Guide = lazy(() => import('./pages/Guide'));
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
            <Route path="/work" element={<Board />} />
            <Route path="/plan" element={<WeeklyPlanner />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/guide" element={<Guide />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
