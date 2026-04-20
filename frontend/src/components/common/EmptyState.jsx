import './EmptyState.css';
import { HiOutlineClipboardList, HiOutlineTag, HiOutlineUsers, HiOutlineUserGroup, HiOutlineSearch, HiOutlinePhotograph } from 'react-icons/hi';

const PRESETS = {
    orders: {
        icon: <HiOutlineClipboardList />,
        title: 'No orders found',
        subtitle: 'Create your first order to get started.',
    },
    search: {
        icon: <HiOutlineSearch />,
        title: 'No results found',
        subtitle: 'Try adjusting your search or filter criteria.',
    },
    categories: {
        icon: <HiOutlineTag />,
        title: 'No categories yet',
        subtitle: 'Add your first service category to begin.',
    },
    customers: {
        icon: <HiOutlineUsers />,
        title: 'No customers found',
        subtitle: 'Customers will appear here once they place orders.',
    },
    parties: {
        icon: <HiOutlineUserGroup />,
        title: 'No parties found',
        subtitle: 'Add a VIP party to manage custom pricing.',
    },
    images: {
        icon: <HiOutlinePhotograph />,
        title: 'No images uploaded',
        subtitle: 'Upload photos for this order.',
    },
};

/**
 * EmptyState — beautiful empty state with icon, title, subtitle, and optional CTA.
 *
 * Props:
 *   preset     : string — one of 'orders', 'search', 'categories', 'customers', 'parties', 'images'
 *   icon       : JSX — custom icon (overrides preset)
 *   title      : string — custom title (overrides preset)
 *   subtitle   : string — custom subtitle (overrides preset)
 *   actionText : string — CTA button text
 *   onAction   : () => void — CTA click handler
 *   compact    : boolean — if true, uses less padding (for tables)
 */
const EmptyState = ({ preset, icon, title, subtitle, actionText, onAction, compact = false }) => {
    const p = PRESETS[preset] || {};
    const displayIcon = icon || p.icon || <HiOutlineClipboardList />;
    const displayTitle = title || p.title || 'Nothing here yet';
    const displaySubtitle = subtitle || p.subtitle || '';

    return (
        <div className={`empty-state ${compact ? 'empty-state--compact' : ''}`}>
            <div className="empty-state__icon-ring">
                <div className="empty-state__icon">{displayIcon}</div>
            </div>
            <h3 className="empty-state__title">{displayTitle}</h3>
            {displaySubtitle && <p className="empty-state__subtitle">{displaySubtitle}</p>}
            {actionText && onAction && (
                <button className="empty-state__cta" onClick={onAction}>
                    {actionText}
                </button>
            )}
        </div>
    );
};

export default EmptyState;
