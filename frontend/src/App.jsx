import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DailyFocus from './pages/DailyFocus';
import Inbox from './pages/Inbox';
import Board from './pages/Board';
import WeeklyPlanner from './pages/WeeklyPlanner';
import ContextSnapshots from './pages/ContextSnapshots';
import Settings from './pages/Settings';
import Login from './pages/Login';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/" element={<DailyFocus />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/board" element={<Board />} />
          <Route path="/week" element={<WeeklyPlanner />} />
          <Route path="/snapshots" element={<ContextSnapshots />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
