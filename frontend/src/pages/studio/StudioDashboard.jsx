import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import API from '../../api/axios';
import StatsCard from '../../components/common/StatsCard';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { HiOutlineClipboardList, HiOutlineInboxIn, HiOutlinePencilAlt, HiOutlinePrinter, HiOutlineBookOpen, HiOutlineShieldCheck, HiOutlineCheckCircle } from 'react-icons/hi';
import './StudioDashboard.css';

const StudioDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [recentOrders, setRecentOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [statsRes, ordersRes] = await Promise.all([
                API.get('/orders/stats'),
                API.get('/orders?limit=10')
            ]);
            setStats(statsRes.data);
            setRecentOrders(ordersRes.data.orders);
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <LoadingSpinner text="Loading dashboard..." />;

    const statCards = [
        { title: 'Total Orders', value: stats?.totalOrders || 0, icon: <HiOutlineClipboardList />, color: '#6C63FF' },
        { title: 'Reception', value: stats?.statusCounts?.reception || 0, icon: <HiOutlineInboxIn />, color: '#6C63FF' },
        { title: 'Designing', value: stats?.statusCounts?.designing || 0, icon: <HiOutlinePencilAlt />, color: '#FF6B9D' },
        { title: 'Printing', value: stats?.statusCounts?.printing || 0, icon: <HiOutlinePrinter />, color: '#FFA726' },
        { title: 'Binding', value: stats?.statusCounts?.binding || 0, icon: <HiOutlineBookOpen />, color: '#42A5F5' },
        { title: 'Quality Check', value: stats?.statusCounts?.quality_check || 0, icon: <HiOutlineShieldCheck />, color: '#AB47BC' },
        { title: 'Delivered', value: stats?.historyCount || 0, icon: <HiOutlineCheckCircle />, color: '#66BB6A' },
    ];

    return (
        <div className="studio-dashboard fade-in">
            <div className="page-header">
                <h1>Welcome, {user?.name} 👋</h1>
            </div>

            <div className="stats-grid">
                {statCards.map((card, i) => (
                    <StatsCard key={i} {...card} />
                ))}
            </div>

            <div className="dashboard-section">
                <div className="section-header">
                    <h2>Recent Orders</h2>
                </div>
                <div className="table-container glass-card">
                    <table>
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Customer</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                        No orders yet. Create your first order!
                                    </td>
                                </tr>
                            ) : (
                                recentOrders.map((order) => (
                                    <tr key={order._id}>
                                        <td><strong>{order.orderId}</strong></td>
                                        <td>{order.customer?.name}</td>
                                        <td>{order.categories?.map(c => c.name).join(', ')}</td>
                                        <td><StatusBadge status={order.status} /></td>
                                        <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StudioDashboard;
