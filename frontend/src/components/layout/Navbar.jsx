import { useAuth } from '../../hooks/useAuth';
import { HiOutlineBell, HiOutlineSun, HiOutlineMoon, HiOutlineMenu, HiOutlineCheck, HiOutlineLogout } from 'react-icons/hi';
import { useContext, useState, useEffect, useRef } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import './Navbar.css';

const Navbar = ({ title, onMenuClick }) => {
    const { user, logout } = useAuth();
    const { isDarkMode, toggleTheme } = useContext(ThemeContext);
    const navigate = useNavigate();
    
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const profileRef = useRef(null);

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            const res = await API.get('/notifications');
            if (res.data.success) {
                setNotifications(res.data.notifications);
                setUnreadCount(res.data.unreadCount);
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Poll every 15 seconds
        const interval = setInterval(fetchNotifications, 15000);
        return () => clearInterval(interval);
    }, [user]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setShowProfileMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNotificationClick = async (notif) => {
        if (!notif.isRead) {
            try {
                await API.put(`/notifications/${notif._id}/read`);
                setUnreadCount(prev => Math.max(0, prev - 1));
                setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n));
            } catch (err) {
                console.error(err);
            }
        }
        setShowDropdown(false);
        if (notif.orderId) {
            navigate('/orders');
        }
    };

    const handleMarkAllRead = async (e) => {
        e.stopPropagation();
        try {
            await API.put('/notifications/read-all');
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (err) {
            console.error(err);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

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
                
                <div className="navbar__notification-wrapper" ref={dropdownRef} style={{ position: 'relative' }}>
                    <button className="navbar__notification" onClick={() => setShowDropdown(!showDropdown)}>
                        <HiOutlineBell />
                        {unreadCount > 0 && (
                            <span className="navbar__notification-dot">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>
                    
                    {showDropdown && (
                        <div className="navbar__notification-dropdown slide-up">
                            <div className="notification-header">
                                <span>Notifications</span>
                                {unreadCount > 0 && (
                                    <button onClick={handleMarkAllRead} title="Mark all as read">
                                        <HiOutlineCheck /> Mark all read
                                    </button>
                                )}
                            </div>
                            <div className="notification-list">
                                {notifications.length === 0 ? (
                                    <div className="notification-empty">No new notifications</div>
                                ) : (
                                    notifications.map(notif => (
                                        <div 
                                            key={notif._id} 
                                            className={`notification-item ${!notif.isRead ? 'unread' : ''}`}
                                            onClick={() => handleNotificationClick(notif)}
                                        >
                                            <div className="notification-title">{notif.title}</div>
                                            <div className="notification-message">{notif.message}</div>
                                            <span className="notification-time">
                                                {new Date(notif.createdAt).toLocaleString('en-IN', {
                                                    hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short'
                                                })}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="navbar__user-profile" 
                     onClick={() => setShowProfileMenu(!showProfileMenu)}
                     ref={profileRef}
                     style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '16px', paddingLeft: '16px', borderLeft: '1px solid var(--border)' }}>
                     
                    <div className="navbar__user-avatar" title={user?.name}>
                        {user?.name?.charAt(0)?.toUpperCase()}
                    </div>

                    {showProfileMenu && (
                        <div className="navbar__profile-dropdown slide-up">
                            <div className="profile-dropdown-header">
                                <div className="profile-dropdown-avatar">
                                    {user?.name?.charAt(0)?.toUpperCase()}
                                </div>
                                <div className="profile-dropdown-info">
                                    <strong>{user?.name}</strong>
                                    <span>{user?.email}</span>
                                </div>
                            </div>
                            <div className="profile-dropdown-body">
                                <button className="profile-dropdown-item" onClick={handleLogout}>
                                    <HiOutlineLogout size={18} /> Logout
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Navbar;
