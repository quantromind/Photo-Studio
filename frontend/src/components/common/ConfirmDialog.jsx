import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineExclamationCircle, HiOutlineTrash, HiOutlineExclamation } from 'react-icons/hi';
import './ConfirmDialog.css';

/**
 * ConfirmDialog — a beautiful themed replacement for window.confirm()
 * 
 * Props:
 *   isOpen       : boolean
 *   title        : string (e.g. "Delete Order?")
 *   message      : string or JSX (e.g. "This action cannot be undone.")
 *   confirmText  : string (e.g. "Delete", default: "Confirm")
 *   cancelText   : string (default: "Cancel")
 *   variant      : 'danger' | 'warning' | 'default'
 *   onConfirm    : () => void
 *   onCancel     : () => void
 *   loading      : boolean (disables confirm button)
 */
const ConfirmDialog = ({ 
    isOpen, 
    title = 'Are you sure?', 
    message = '', 
    confirmText = 'Confirm', 
    cancelText = 'Cancel', 
    variant = 'danger',
    onConfirm, 
    onCancel, 
    loading = false 
}) => {
    const confirmRef = useRef(null);

    // Focus confirm button when dialog opens
    useEffect(() => {
        if (isOpen && confirmRef.current) {
            setTimeout(() => confirmRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Keyboard: Enter to confirm, Escape to cancel
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Enter' && !loading) {
                e.preventDefault();
                onConfirm?.();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel?.();
            }
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, loading, onConfirm, onCancel]);

    const icons = {
        danger: <HiOutlineTrash />,
        warning: <HiOutlineExclamation />,
        default: <HiOutlineExclamationCircle />,
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="confirm-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={onCancel}
                >
                    <motion.div
                        className={`confirm-dialog confirm-dialog--${variant}`}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={`confirm-dialog__icon confirm-dialog__icon--${variant}`}>
                            {icons[variant]}
                        </div>
                        <h3 className="confirm-dialog__title">{title}</h3>
                        {message && <p className="confirm-dialog__message">{message}</p>}
                        <div className="confirm-dialog__actions">
                            <button 
                                className="confirm-dialog__btn confirm-dialog__btn--cancel" 
                                onClick={onCancel}
                                disabled={loading}
                            >
                                {cancelText}
                            </button>
                            <button 
                                ref={confirmRef}
                                className={`confirm-dialog__btn confirm-dialog__btn--${variant}`}
                                onClick={onConfirm}
                                disabled={loading}
                            >
                                {loading ? 'Processing...' : confirmText}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ConfirmDialog;
