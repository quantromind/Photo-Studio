import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { motion } from 'framer-motion';
import './LandingPage.css';

const LandingPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const handleCTA = () => {
        if (user) {
            if (user.role === 'superadmin') navigate('/admin/dashboard');
            else if (user.role === 'studioadmin') navigate('/dashboard');
            else navigate('/customer/orders');
        } else {
            navigate('/login');
        }
    };

    const fadeUpVariant = {
        hidden: { opacity: 0, y: 40 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
    };

    const staggerContainer = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
    };

    return (
        <div className="landing-container">
            <header className="landing-header">
                <Link to="/" className="landing-logo">Studio.</Link>
                <nav className="landing-nav-links">
                    <a href="#portfolio" className="landing-nav-link">Portfolio</a>
                    <a href="#services" className="landing-nav-link">Services</a>
                    <a href="#contact" className="landing-nav-link">Contact</a>
                </nav>
                <button onClick={handleCTA} className="landing-btn">
                    {user ? 'Dashboard' : 'Login / Portal'}
                </button>
            </header>

            <section className="landing-hero">
                {/* Replacing static image with a dynamic video background for 'playback' feel */}
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="hero-bg-video"
                    poster="https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=2670&auto=format&fit=crop"
                >
                    <source src="https://assets.mixkit.co/videos/preview/mixkit-photographer-taking-pictures-in-the-forest-34909-large.mp4" type="video/mp4" />
                </video>
                <div className="hero-overlay"></div>
                <div className="hero-content">
                    <motion.h1
                        className="hero-title"
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                    >
                        Capture.
                    </motion.h1>
                    <motion.p
                        className="hero-subtitle"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
                    >
                        Exploring the beauty of light, shaping memories that last a lifetime.
                    </motion.p>
                </div>
            </section>

            <section id="portfolio" className="landing-section">
                <motion.h2
                    className="section-title"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    variants={fadeUpVariant}
                >
                    Moments.
                </motion.h2>

                <motion.div
                    className="grid-layout"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    variants={staggerContainer}
                >
                    <motion.div className="card" variants={fadeUpVariant}>
                        <img src="https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=2000&auto=format&fit=crop" alt="Wedding" className="card-img" />
                        <div className="card-content">
                            <h3 className="card-title">Weddings</h3>
                            <p className="card-desc">Timeless celebrations.</p>
                        </div>
                    </motion.div>
                    <motion.div className="card" variants={fadeUpVariant}>
                        <img src="https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=2000&auto=format&fit=crop" alt="Portrait" className="card-img" />
                        <div className="card-content">
                            <h3 className="card-title">Portraits</h3>
                            <p className="card-desc">Authentic connections.</p>
                        </div>
                    </motion.div>
                    <motion.div className="card" variants={fadeUpVariant}>
                        <img src="https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=2000&auto=format&fit=crop" alt="Nature" className="card-img" />
                        <div className="card-content">
                            <h3 className="card-title">Editorial</h3>
                            <p className="card-desc">Artistic vision.</p>
                        </div>
                    </motion.div>
                </motion.div>
            </section>

            {/* New section to add more scroll depth */}
            <section className="landing-section dark-section">
                <motion.div
                    className="text-center-block"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    variants={fadeUpVariant}
                >
                    <h2 className="section-title light-text">Perspective.</h2>
                    <p className="section-body">We believe every frame tells a story. Our approach combines cinematic techniques with genuine emotion, ensuring every shot feels alive.</p>
                </motion.div>
            </section>

            <footer className="landing-footer">
                <div className="landing-logo">Studio.</div>
                <div className="footer-copyright">© 2024 NakshatraTechnologies. All rights reserved.</div>
            </footer>
        </div>
    );
};

export default LandingPage;
