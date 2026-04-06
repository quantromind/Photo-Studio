import './StatusBadge.css';

const statusConfig = {
    reception: { label: 'Reception', color: 'var(--status-reception)' },
    designing: { label: 'Designing', color: 'var(--status-designing)' },
    printing: { label: 'Printing', color: 'var(--status-printing)' },
    binding: { label: 'Binding', color: 'var(--status-binding)' },
    quality_check: { label: 'Quality Check', color: 'var(--status-quality)' },
    delivered: { label: 'Delivered', color: 'var(--status-delivered)' },
    cancelled: { label: 'Cancelled', color: '#ef4444' }
};

const StatusBadge = ({ status }) => {
    const config = statusConfig[status] || { label: status, color: '#888' };

    return (
        <span
            className="status-badge"
            style={{
                '--badge-color': config.color
            }}
        >
            <span className="status-badge__dot"></span>
            {config.label}
        </span>
    );
};

export default StatusBadge;
