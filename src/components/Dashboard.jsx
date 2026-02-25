import React from 'react';
import { Home, Tv, User, Settings, Sun, Moon } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const Dashboard = () => {
  return (
    <div className="w-full h-full">
      <Outlet />
    </div>
  );
};

export default Dashboard;
