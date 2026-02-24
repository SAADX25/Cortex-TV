import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Home from './components/Home';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />}>
          <Route index element={<Home />} />
          <Route path="shows" element={<div className="text-2xl">TV Shows (Coming Soon)</div>} />
          <Route path="profile" element={<div className="text-2xl">Profile (Coming Soon)</div>} />
          <Route path="settings" element={<div className="text-2xl">Settings (Coming Soon)</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
