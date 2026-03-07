import './StatsCard.css';

const StatsCard = ({ title, value, icon, color, subtitle }) => {
    return (
        <div className="stats-card" style={{ '--card-accent': color || 'var(--primary)' }}>
            <div className="stats-card__icon">
                {icon}
            </div>
            <div className="stats-card__content">
                <span className="stats-card__value">{value}</span>
                <span className="stats-card__title">{title}</span>
                {subtitle && <span className="stats-card__subtitle">{subtitle}</span>}
            </div>
            <div className="stats-card__glow"></div>
        </div>
    );
};

export default StatsCard;
