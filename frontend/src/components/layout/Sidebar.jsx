import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { HiOutlineHome, HiOutlineClipboardList, HiOutlineTag, HiOutlineUsers, HiOutlineLogout, HiOutlineOfficeBuilding, HiOutlineSearch, HiOutlineCog, HiOutlineCash, HiOutlineUserGroup, HiOutlineChatAlt2 } from 'react-icons/hi';
import { getFileUrl } from '../../utils/urlHelper';
import './Sidebar.css';

const Sidebar = ({ isOpen, setIsOpen }) => {
    const { user } = useAuth();

    const adminLinks = [
        { to: '/dashboard', icon: <HiOutlineHome />, label: 'Dashboard' },
        { to: '/orders', icon: <HiOutlineClipboardList />, label: 'Orders' },
        { to: '/revenue', icon: <HiOutlineCash />, label: 'Revenue' },
        { to: '/categories', icon: <HiOutlineTag />, label: 'Categories' },
        { to: '/parties', icon: <HiOutlineUserGroup />, label: 'Parties' },
        { to: '/customers', icon: <HiOutlineUsers />, label: 'Customers' },
        { to: '/staff', icon: <HiOutlineUserGroup />, label: 'Staff' },
        { to: '/community', icon: <HiOutlineChatAlt2 />, label: 'Community' },
        { to: '/settings', icon: <HiOutlineCog />, label: 'Settings' }
    ];

    // All possible staff pages mapped to their permission key
    // Added community implicitly so staff can always see it if they have app access
    const allStaffLinks = [
        { to: '/dashboard', icon: <HiOutlineHome />, label: 'Dashboard', permission: 'dashboard' },
        { to: '/orders', icon: <HiOutlineClipboardList />, label: 'Orders', permission: 'orders' },
        { to: '/revenue', icon: <HiOutlineCash />, label: 'Revenue', permission: 'revenue' },
        { to: '/categories', icon: <HiOutlineTag />, label: 'Categories', permission: 'categories' },
        { to: '/customers', icon: <HiOutlineUsers />, label: 'Customers', permission: 'customers' },
        { to: '/settings', icon: <HiOutlineCog />, label: 'Settings', permission: 'settings' },
    ];

    const userPermissions = user?.permissions || ['orders'];
    const staffLinks = [
        ...allStaffLinks.filter(link => userPermissions.includes(link.permission)),
        { to: '/community', icon: <HiOutlineChatAlt2 />, label: 'Community' } // Always visible to staff
    ];

    const superAdminLinks = [
        { to: '/admin/dashboard', icon: <HiOutlineHome />, label: 'Dashboard' },
        { to: '/admin/studios', icon: <HiOutlineOfficeBuilding />, label: 'Studios' },
    ];

    const links = user?.role === 'superadmin' ? superAdminLinks : user?.role === 'staff' ? staffLinks : adminLinks;

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            <div className="sidebar__brand">
                <div className="sidebar__logo">
                    {user?.studio?.logo ? (
                        <img src={getFileUrl(user.studio.logo)} alt="Logo" className="sidebar__logo-img" />
                    ) : (
                        <span>📸</span>
                    )}
                </div>
                <div className="sidebar__brand-text">
                    <h2>{user?.studio?.name || 'PhotoStudio'}</h2>
                    <span className="sidebar__role">{
                        user?.role === 'superadmin' ? 'Super Admin' 
                        : user?.role === 'staff' 
                            ? (user?.assignedSteps?.length > 0 
                                ? user.assignedSteps.map(s => s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')).join(' · ') 
                                : 'Staff')
                            : 'Studio Admin'
                    }</span>
                </div>
            </div>

            <nav className="sidebar__nav" style={{ paddingBottom: '24px' }}>
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
        </aside>
    );
};

export default Sidebar;
