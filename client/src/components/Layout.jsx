import React, { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Settings,
    LogOut,
    Shield,
    User,
    ChevronDown,
    Activity,
    LayoutDashboard,
    Home
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

const NavLink = ({ to, label }) => {
    const location = useLocation();
    const isActive = location.pathname.startsWith(to);

    return (
        <Link
            to={to}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
        >
            {label}
        </Link>
    );
};

const Layout = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Add app-page class to body for overflow handling
    useEffect(() => {
        document.body.classList.add('app-page');
        return () => {
            document.body.classList.remove('app-page');
        };
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Top Header */}
            <header className="bg-white shadow-sm z-[2000] h-16 flex items-center justify-between px-6 border-b border-gray-200 relative">
                <div className="flex items-center space-x-8">
                    <h1 className="text-xl font-bold text-gray-800 tracking-tight">
                        <Link to="/app/dashboard">
                            <span className="text-blue-600">Express</span> AI
                        </Link>
                    </h1>

                    <nav className="hidden md:flex space-x-1">
                        <NavLink to="/app/dashboard" label="Dashboard" />
                        <NavLink to="/app/analytics" label="Analytics" />
                        <Link
                            to="/"
                            className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                        >
                            Overview
                        </Link>
                    </nav>
                </div>

                <div className="relative">
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 focus:outline-none transition-colors"
                    >
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                            {user?.email?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium hidden md:block">{user?.email}</span>
                        <ChevronDown size={16} />
                    </button>

                    {/* Dropdown Menu */}
                    {dropdownOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 border border-gray-100 z-[2000]">
                            <div className="md:hidden">
                                <Link
                                    to="/"
                                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                    onClick={() => setDropdownOpen(false)}
                                >
                                    <Home size={16} className="mr-2" />
                                    Overview
                                </Link>
                                <Link
                                    to="/app/dashboard"
                                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                    onClick={() => setDropdownOpen(false)}
                                >
                                    <LayoutDashboard size={16} className="mr-2" />
                                    Dashboard
                                </Link>
                                <Link
                                    to="/app/analytics"
                                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                    onClick={() => setDropdownOpen(false)}
                                >
                                    <Activity size={16} className="mr-2" />
                                    Analytics
                                </Link>
                                <div className="border-t border-gray-100 my-1"></div>
                            </div>
                            {user?.is_superuser && (
                                <Link
                                    to="/admin"
                                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                    onClick={() => setDropdownOpen(false)}
                                >
                                    <Shield size={16} className="mr-2" />
                                    Admin Dashboard
                                </Link>
                            )}
                            <div className="border-t border-gray-100 my-1"></div>
                            <button
                                onClick={handleLogout}
                                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                            >
                                <LogOut size={16} className="mr-2" />
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden relative">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
