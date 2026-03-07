import { useState } from 'react';
import API from '../../api/axios';
import StatusBadge from '../../components/common/StatusBadge';
import { HiOutlineSearch, HiOutlineClock, HiOutlineCheckCircle } from 'react-icons/hi';
import './TrackOrder.css';

const ALL_STATUSES = ['reception', 'designing', 'printing', 'binding', 'quality_check', 'delivered', 'completed'];
const STATUS_LABELS = {
    reception: 'Reception',
    designing: 'Designing',
    printing: 'Printing',
    binding: 'Binding',
    quality_check: 'Quality Check',
    delivered: 'Delivered',
    completed: 'Completed'
};

const TrackOrder = () => {
    const [orderId, setOrderId] = useState('');
    const [order, setOrder] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleTrack = async (e) => {
        e.preventDefault();
        if (!orderId.trim()) return;
        setError(''); setOrder(null); setLoading(true);
        try {
            const res = await API.get(`/customer/track/${orderId.trim()}`);
            setOrder(res.data.order);
        } catch (err) {
            setError(err.response?.data?.message || 'Order not found');
        } finally {
            setLoading(false);
        }
    };

    const getStageIndex = (status) => ALL_STATUSES.indexOf(status);

    return (
        <div className="track-page">
            <div className="auth-bg">
                <div className="auth-bg__circle auth-bg__circle--1"></div>
                <div className="auth-bg__circle auth-bg__circle--2"></div>
            </div>

            <div className="track-container">
                <div className="track-header">
                    <div className="track-logo">📸</div>
                    <h1>Track Your Order</h1>
                    <p>Enter your Order ID to see the current status</p>
                </div>

                <form onSubmit={handleTrack} className="track-form glass-card">
                    <div className="track-input-group">
                        <HiOutlineSearch className="track-input-icon" />
                        <input
                            type="text"
                            className="track-input"
                            placeholder="Enter Order ID (e.g. ORD-0001)"
                            value={orderId}
                            onChange={(e) => setOrderId(e.target.value)}
                        />
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Searching...' : 'Track'}
                        </button>
                    </div>
                </form>

                {error && <div className="alert alert-error" style={{ maxWidth: '600px', margin: '20px auto' }}>{error}</div>}

                {order && (
                    <div className="track-result glass-card slide-up">
                        <div className="track-result__header">
                            <div>
                                <h2>Order {order.orderId}</h2>
                                <p>{order.categories?.map(c => c.name).join(', ')} • {order.studio?.name}</p>
                            </div>
                            <StatusBadge status={order.status} />
                        </div>

                        {/* Visual Workflow Timeline */}
                        <div className="workflow-timeline">
                            {ALL_STATUSES.map((status, index) => {
                                const currentIndex = getStageIndex(order.status);
                                const isCompleted = index <= currentIndex;
                                const isCurrent = index === currentIndex;
                                return (
                                    <div key={status} className={`workflow-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
                                        <div className="workflow-step__dot">
                                            {isCompleted ? <HiOutlineCheckCircle /> : <span>{index + 1}</span>}
                                        </div>
                                        <span className="workflow-step__label">{STATUS_LABELS[status]}</span>
                                        {index < ALL_STATUSES.length - 1 && <div className="workflow-step__line"></div>}
                                    </div>
                                );
                            })}
                        </div>

                        {order.estimatedCompletion && (
                            <div className="track-result__eta">
                                <HiOutlineClock />
                                <span>Estimated Completion: {new Date(order.estimatedCompletion).toLocaleString()}</span>
                            </div>
                        )}

                        {/* Status History */}
                        {order.statusHistory && order.statusHistory.length > 0 && (
                            <div className="track-history">
                                <h3>Status History</h3>
                                {order.statusHistory.map((entry, i) => (
                                    <div key={i} className="track-history__item">
                                        <div className="track-history__dot"></div>
                                        <div>
                                            <strong>{STATUS_LABELS[entry.status]}</strong>
                                            <span>{new Date(entry.changedAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrackOrder;
