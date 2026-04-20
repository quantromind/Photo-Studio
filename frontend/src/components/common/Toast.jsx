import { useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToastContext } from '../../context/ToastContext';
import { HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineExclamation, HiOutlineInformationCircle } from 'react-icons/hi';
import './Toast.css';

const ICONS = {
    success: <HiOutlineCheckCircle />,
    error: <HiOutlineExclamationCircle />,
    warning: <HiOutlineExclamation />,
    info: <HiOutlineInformationCircle />,
};

const DEFAULT_DURATIONS = {
    success: 4000,
    error: 5000,
    warning: 4000,
    info: 4000,
};

const ToastContainer = () => {
    const { toasts, removeToast } = useContext(ToastContext);

    return (
        <div className="toast-container">
            <AnimatePresence mode="popLayout">
                {toasts.map(toast => (
                    <motion.div
                        key={toast.id}
                        className={`toast toast--${toast.type}`}
                        initial={{ opacity: 0, x: 80, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 80, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        onClick={() => removeToast(toast.id)}
                        layout
                    >
                        <span className="toast__icon">{ICONS[toast.type]}</span>
                        <span className="toast__content">{toast.message}</span>
                        <button className="toast__close" onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}>×</button>
                        <div
                            className="toast__progress"
                            style={{ animationDuration: `${DEFAULT_DURATIONS[toast.type] || 4000}ms` }}
                        />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default ToastContainer;
