import React from 'react';
import { Home, Tv, User, Settings } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';

const Dashboard = () => {
  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 p-6 flex flex-col">
        <h1 className="text-2xl font-bold mb-8 text-blue-400">Cortex TV</h1>
        
        <nav className="flex-1">
          <ul className="space-y-4">
            <li>
              <Link to="/" className="flex items-center space-x-3 p-3 rounded hover:bg-gray-700 transition-colors focus:bg-gray-700 outline-none">
                <Home size={24} />
                <span className="text-lg">Home</span>
              </Link>
            </li>
            <li>
              <Link to="/shows" className="flex items-center space-x-3 p-3 rounded hover:bg-gray-700 transition-colors focus:bg-gray-700 outline-none">
                <Tv size={24} />
                <span className="text-lg">Shows</span>
              </Link>
            </li>
            <li>
              <Link to="/profile" className="flex items-center space-x-3 p-3 rounded hover:bg-gray-700 transition-colors focus:bg-gray-700 outline-none">
                <User size={24} />
                <span className="text-lg">Profile</span>
              </Link>
            </li>
            <li>
              <Link to="/settings" className="flex items-center space-x-3 p-3 rounded hover:bg-gray-700 transition-colors focus:bg-gray-700 outline-none">
                <Settings size={24} />
                <span className="text-lg">Settings</span>
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
};

export default Dashboard;
