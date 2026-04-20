import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import './DashboardLayout.css';

const DashboardLayout = ({ title }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    useKeyboardShortcuts();

    return (
        <div className="dashboard-layout">
            {isSidebarOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
            <div className="dashboard-layout__main">
                <Navbar title={title} onMenuClick={() => setIsSidebarOpen(true)} />
                <main className="dashboard-layout__content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
