import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X } from 'lucide-react';

const IS_DESKTOP = !!(window.daanDesktop?.isDesktop);

/**
 * Shared public-facing navbar used by LandingPage and ProductsPage.
 * Accepts an optional `activePath` prop to highlight the active link.
 */
const LandingNavbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        setUserDropdownOpen(false);
        setMobileMenuOpen(false);
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="landing-navbar">
            <div className="navbar-logo">
                <img src="/logos/express-ai-logo.png" alt="Express AI" className="logo-img" />
                <span className="logo-text">Express AI</span>
            </div>

            <div className="mobile-toggle-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X size={28} color="#94a3b8" /> : <Menu size={28} color="#94a3b8" />}
            </div>

            <div className={`navbar-links ${mobileMenuOpen ? 'mobile-open' : ''}`}>
                <Link
                    to="/"
                    className={`nav-link${isActive('/') ? ' nav-link-active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                >
                    Overview
                </Link>
                <Link
                    to="/app/dashboard"
                    className={`nav-link${isActive('/app/dashboard') ? ' nav-link-active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                >
                    Dashboard
                </Link>
                {!IS_DESKTOP && (
                    <Link
                        to="/products"
                        className={`nav-link${isActive('/products') ? ' nav-link-active' : ''}`}
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        Products
                    </Link>
                )}
                <a
                    href="/#about"
                    className="nav-link"
                    onClick={() => setMobileMenuOpen(false)}
                >
                    About
                </a>

                {user ? (
                    <div className="nav-user-container">
                        <button
                            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                            className="nav-user-btn"
                        >
                            <span className="nav-user-avatar">
                                {user.email?.charAt(0).toUpperCase()}
                            </span>
                            <span className="nav-user-email">{user.email}</span>
                            <svg className="nav-user-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                        </button>

                        {userDropdownOpen && (
                            <div className="nav-user-dropdown">
                                {user.is_superuser && (
                                    <Link
                                        to="/app/admin"
                                        className="dropdown-item"
                                        onClick={() => { setUserDropdownOpen(false); setMobileMenuOpen(false); }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        </svg>
                                        Admin Dashboard
                                    </Link>
                                )}
                                <button onClick={handleLogout} className="dropdown-item dropdown-logout">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                        <polyline points="16,17 21,12 16,7" />
                                        <line x1="21" y1="12" x2="9" y2="12" />
                                    </svg>
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <Link to="/login" className="nav-link nav-login" onClick={() => setMobileMenuOpen(false)}>Login</Link>
                )}
            </div>
        </nav>
    );
};

export default LandingNavbar;
