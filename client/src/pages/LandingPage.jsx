import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X } from 'lucide-react';
import './LandingPage.css';

const LandingPage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        setUserDropdownOpen(false);
        setMobileMenuOpen(false);
        navigate('/login');
    };

    return (
        <div className="landing-page">
            {/* Top Navigation Bar */}
            {/* Top Navigation Bar */}
            <nav className="landing-navbar">
                <div className="navbar-logo">
                    <img src="/logos/express-ai-logo.png" alt="Express AI" className="logo-img" />
                    <span className="logo-text">Express AI</span>
                </div>

                <div className="mobile-toggle-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                    {mobileMenuOpen ? <X size={28} color="#94a3b8" /> : <Menu size={28} color="#94a3b8" />}
                </div>

                <div className={`navbar-links ${mobileMenuOpen ? 'mobile-open' : ''}`}>
                    <Link to="/app/dashboard" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
                    <Link to="/app/analytics" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Analytics</Link>
                    <a href="#about" className="nav-link" onClick={() => setMobileMenuOpen(false)}>About</a>
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

            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-content">
                    <h1 className="hero-title">
                        Digital Analytics for<br />
                        <span className="gradient-text">Road Infrastructure</span>
                    </h1>
                    <p className="hero-subtitle">
                        Empowering LGUs with AI-powered road assessment,
                        pothole detection, and traffic analysis tools.
                    </p>
                    <div className="hero-buttons">
                        <Link to="/app/dashboard" className="btn-primary">
                            Get Started →
                        </Link>
                        <a href="#demo" className="btn-secondary">
                            Watch Demo
                        </a>
                    </div>
                </div>
                <div className="hero-video" id="demo">
                    <div className="video-wrapper">
                        <iframe
                            src="https://www.youtube.com/embed/jEHBOK0Ck08?autoplay=1&mute=1&loop=1&playlist=jEHBOK0Ck08&controls=0&modestbranding=1&rel=0&showinfo=0"
                            title="Express AI Demo"
                            frameBorder="0"
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                            className="video-iframe"
                        ></iframe>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section">
                <h2 className="section-title">What You Can Do</h2>
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">🚧</div>
                        <h3>Pothole Detection</h3>
                        <p>AI-powered identification and GPS mapping of road damage for efficient maintenance planning.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">📏</div>
                        <h3>IRI Analysis</h3>
                        <p>International Roughness Index computation to assess and visualize road quality conditions.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🚗</div>
                        <h3>Vehicle Counting</h3>
                        <p>Real-time traffic flow analysis using YOLOv8 computer vision technology.</p>
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="benefits-section">
                <div className="benefits-content">
                    <h2 className="section-title">Why Choose Express AI?</h2>
                    <div className="benefits-grid">
                        <div className="benefit-item">
                            <span className="benefit-icon">📊</span>
                            <div>
                                <h4>Data-Driven Decisions</h4>
                                <p>Make informed infrastructure investments based on real data</p>
                            </div>
                        </div>
                        <div className="benefit-item">
                            <span className="benefit-icon">🗺️</span>
                            <div>
                                <h4>GIS Integration</h4>
                                <p>Visualize road conditions on interactive maps</p>
                            </div>
                        </div>
                        <div className="benefit-item">
                            <span className="benefit-icon">📱</span>
                            <div>
                                <h4>Field Ready</h4>
                                <p>Upload and process data directly from the field</p>
                            </div>
                        </div>
                        <div className="benefit-item">
                            <span className="benefit-icon">⚡</span>
                            <div>
                                <h4>Fast Processing</h4>
                                <p>Get results in minutes, not days</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* About Section */}
            <section id="about" className="about-section">
                <div className="about-content">
                    <h2 className="section-title">About Express AI</h2>
                    <p className="about-text">
                        <strong>Express AI</strong> (Expert Platform for Road Evaluation and Smart Surveillance) is a research initiative
                        by the University of the Philippines Los Baños (UPLB) in partnership with DOST-NRCP
                        and PAVEx Development Inc. to modernize road infrastructure assessment in the Philippines.
                    </p>
                    <p className="about-text">
                        Our mission is to provide local government units with accessible,
                        data-driven tools for better road maintenance decisions.
                    </p>
                </div>
            </section>

            {/* Partners Section */}
            <section className="partners-section">
                <h3 className="partners-title">In Partnership With</h3>
                <div className="partners-logos">
                    <div className="partner-item">
                        <div className="logo-wrapper">
                            <img src="/logos/uplb.png" alt="UPLB Logo" className="partner-logo-img uplb-logo" />
                        </div>
                        <span className="partner-name">University of the Philippines Los Baños</span>
                    </div>
                    <div className="partner-item">
                        <div className="logo-wrapper">
                            <img src="/logos/dost-nrcp.png" alt="DOST-NRCP Logo" className="partner-logo-img" />
                        </div>
                        <span className="partner-name">DOST - National Research Council of the Philippines</span>
                    </div>
                    <div className="partner-item">
                        <div className="logo-wrapper">
                            <img src="/logos/pavex.jpg" alt="PAVEx Logo" className="partner-logo-img pavex-logo" />
                        </div>
                        <span className="partner-name">PAVEx Development Inc.</span>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <h2>Ready to Transform Your Road Assessment?</h2>
                <p>Join local government units already using Express AI</p>
                <Link to="/register" className="btn-primary btn-large">
                    Create Free Account
                </Link>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="footer-content">
                    <div className="footer-brand">
                        <img src="/logos/express-ai-logo.png" alt="Express AI" className="footer-logo-img" />
                        <span>Express AI</span>
                    </div>
                    <p className="footer-copyright">
                        © 2026 Express AI | UPLB x PAVEx
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
