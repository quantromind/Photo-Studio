import { useState, useEffect } from 'react';
import API from '../../api/axios';
import LoadingSpinner from './LoadingSpinner';
import StatusBadge from './StatusBadge';
import { HiOutlineX, HiOutlineDownload } from 'react-icons/hi';
import './HistoryModal.css';

const HistoryModal = ({ customer, onClose }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, pending: 0, paid: 0 });

    useEffect(() => {
        if (customer) {
            fetchHistory();
        }
    }, [customer]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            // Use phone number for a unified history lookup (covers both customer and party links)
            const endpoint = `/orders?phone=${customer.phone}&limit=100`;
            
            const res = await API.get(endpoint);
            const fetchedOrders = res.data.orders || [];
            setOrders(fetchedOrders);

            // Calculate simple stats
            let total = 0;
            let pending = 0;
            fetchedOrders.forEach(o => {
                const amount = o.totalAmount || 0;
                const advance = o.advancePayment || 0;
                const discount = o.discount || 0;
                const taxPct = o.tax || 0;
                const taxable = Math.max(0, amount - discount);
                
                let finalTotal = taxable;
                if (o.taxType === 'inclusive') {
                    finalTotal = taxable;
                } else {
                    finalTotal = taxable * (1 + taxPct / 100);
                }
                
                total += finalTotal;
                pending += Math.max(0, finalTotal - advance);
            });
            setStats({ 
                total: Math.round(total), 
                pending: Math.round(pending),
                paid: Math.round(total - pending)
            });
        } catch (err) {
            console.error('Failed to fetch history:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!customer) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal history-modal slide-up" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="customer-meta">
                        <h2>Order History: {customer.name}</h2>
                        <span className="customer-phone">{customer.phone}</span>
                    </div>
                    <button className="modal-close" onClick={onClose}><HiOutlineX /></button>
                </div>

                <div className="modal-body">
                    <div className="history-stats card-row">
                        <div className="hist-stat-card glass-card">
                            <label>Total Billing</label>
                            <span className="value">₹{stats.total}</span>
                        </div>
                        <div className="hist-stat-card glass-card">
                            <label>Amount Paid</label>
                            <span className="value text-success">₹{stats.paid}</span>
                        </div>
                        <div className="hist-stat-card glass-card">
                            <label>Balance Due</label>
                            <span className="value text-warning">₹{stats.pending}</span>
                        </div>
                    </div>

                    {loading ? (
                        <LoadingSpinner text="Fetching history..." />
                    ) : orders.length === 0 ? (
                        <div className="empty-history">
                            <p>No orders found for this customer.</p>
                        </div>
                    ) : (
                        <div className="history-table-container">
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Order ID</th>
                                        <th>Categories</th>
                                        <th>Status</th>
                                        <th>Amount</th>
                                        <th>Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map(order => {
                                        const amount = order.totalAmount || 0;
                                        const advance = order.advancePayment || 0;
                                        const discount = order.discount || 0;
                                        const taxPct = order.tax || 0;
                                        const taxable = Math.max(0, amount - discount);
                                        const finalTotal = order.taxType === 'inclusive' ? taxable : taxable * (1 + taxPct / 100);
                                        const balance = Math.max(0, finalTotal - advance);

                                        return (
                                            <tr key={order._id}>
                                                <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                                                <td><span className="order-id-tag">{order.orderId}</span></td>
                                                <td>
                                                    <div className="cat-tags">
                                                        {order.categories?.map(cat => (
                                                            <span key={cat._id || cat} className="cat-mini-tag">{cat.name || '...'}</span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td><StatusBadge status={order.status} /></td>
                                                <td>₹{Math.round(finalTotal)}</td>
                                                <td className={balance > 0 ? 'text-warning' : 'text-success'}>
                                                    {balance > 0 ? `₹${Math.round(balance)}` : 'Paid'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default HistoryModal;
