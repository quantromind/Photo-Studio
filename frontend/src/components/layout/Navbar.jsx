import { useAuth } from '../../hooks/useAuth';
import { HiOutlineBell, HiOutlineSun, HiOutlineMoon, HiOutlineMenu } from 'react-icons/hi';
import { useContext } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import './Navbar.css';

const Navbar = ({ title, onMenuClick }) => {
    const { user } = useAuth();
    const { isDarkMode, toggleTheme } = useContext(ThemeContext);

    return (
        <header className="navbar">
            <div className="navbar__left">
                <button className="navbar__mobile-btn" onClick={onMenuClick}>
                    <HiOutlineMenu size={24} />
                </button>
                <h1 className="navbar__title">{title || 'Dashboard'}</h1>
            </div>
            <div className="navbar__right">
                <button className="navbar__theme-toggle" onClick={toggleTheme} title="Toggle Theme">
                    {isDarkMode ? <HiOutlineSun size={20} /> : <HiOutlineMoon size={20} />}
                </button>
                <button className="navbar__notification">
                    <HiOutlineBell />
                    <span className="navbar__notification-dot"></span>
                </button>
                <div className="navbar__user">
                    <div className="navbar__user-avatar">
                        {user?.name?.charAt(0)?.toUpperCase()}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Navbar;
