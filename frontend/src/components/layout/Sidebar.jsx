import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
    HiOutlineHome, HiOutlineClipboardList, HiOutlineTag,
    HiOutlineUsers, HiOutlineLogout, HiOutlineOfficeBuilding,
    HiOutlineSearch, HiOutlineCog, HiOutlineCash
} from 'react-icons/hi';
import './Sidebar.css';

const Sidebar = ({ isOpen, setIsOpen }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const adminLinks = [
        { to: '/dashboard', icon: <HiOutlineHome />, label: 'Dashboard' },
        { to: '/orders', icon: <HiOutlineClipboardList />, label: 'Orders' },
        { to: '/revenue', icon: <HiOutlineCash />, label: 'Revenue' },
        { to: '/categories', icon: <HiOutlineTag />, label: 'Categories' },
        { to: '/customers', icon: <HiOutlineUsers />, label: 'Customers' },
        { to: '/settings', icon: <HiOutlineCog />, label: 'Settings' }
    ];

    const superAdminLinks = [
        { to: '/admin/dashboard', icon: <HiOutlineHome />, label: 'Dashboard' },
        { to: '/admin/studios', icon: <HiOutlineOfficeBuilding />, label: 'Studios' },
    ];

    const links = user?.role === 'superadmin' ? superAdminLinks : adminLinks;

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            <div className="sidebar__brand">
                <div className="sidebar__logo">
                    <span>📸</span>
                </div>
                <div className="sidebar__brand-text">
                    <h2>PhotoStudio</h2>
                    <span className="sidebar__role">{user?.role === 'superadmin' ? 'Super Admin' : 'Studio Admin'}</span>
                </div>
            </div>

            <nav className="sidebar__nav">
                {links.map((link) => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
                        onClick={() => setIsOpen && setIsOpen(false)}
                    >
                        <span className="sidebar__link-icon">{link.icon}</span>
                        <span className="sidebar__link-label">{link.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar__footer">
                <div className="sidebar__user">
                    <div className="sidebar__avatar">
                        {user?.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="sidebar__user-info">
                        <span className="sidebar__user-name">{user?.name}</span>
                        <span className="sidebar__user-email">{user?.email}</span>
                    </div>
                </div>
                <button className="sidebar__logout" onClick={handleLogout}>
                    <HiOutlineLogout />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
