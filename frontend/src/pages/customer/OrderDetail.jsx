import { useState, useEffect } from 'react';
import API from '../../api/axios';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { HiOutlineEye } from 'react-icons/hi';
import { Link } from 'react-router-dom';

const OrderDetail = () => {
    const { user } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const res = await API.get('/customer/orders');
                setOrders(res.data.orders);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, []);

    if (loading) return <LoadingSpinner text="Loading your orders..." />;

    return (
        <div className="fade-in" style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
            <div className="page-header">
                <h1>My Orders</h1>
                <Link to="/track" className="btn btn-secondary">Track Another Order</Link>
            </div>

            <div className="table-container glass-card">
                <table>
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Category</th>
                            <th>Studio</th>
                            <th>Status</th>
                            <th>Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    No orders found
                                </td>
                            </tr>
                        ) : (
                            orders.map((order) => (
                                <tr key={order._id}>
                                    <td><strong>{order.orderId}</strong></td>
                                    <td>{order.categories?.map(c => c.name).join(', ')}</td>
                                    <td>{order.studio?.name}</td>
                                    <td><StatusBadge status={order.status} /></td>
                                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default OrderDetail;
