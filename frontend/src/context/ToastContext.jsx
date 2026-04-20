import { createContext, useState, useCallback, useRef } from 'react';

export const ToastContext = createContext();

let toastIdCounter = 0;

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const timersRef = useRef({});

    const removeToast = useCallback((id) => {
        if (timersRef.current[id]) {
            clearTimeout(timersRef.current[id]);
            delete timersRef.current[id];
        }
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((message, type = 'success', duration = 4000) => {
        const id = ++toastIdCounter;
        const toast = { id, message, type, createdAt: Date.now() };
        setToasts(prev => [...prev.slice(-4), toast]); // Keep max 5 toasts
        
        timersRef.current[id] = setTimeout(() => {
            removeToast(id);
        }, duration);
        
        return id;
    }, [removeToast]);

    const showSuccess = useCallback((msg, duration) => addToast(msg, 'success', duration), [addToast]);
    const showError = useCallback((msg, duration = 5000) => addToast(msg, 'error', duration), [addToast]);
    const showWarning = useCallback((msg, duration) => addToast(msg, 'warning', duration), [addToast]);
    const showInfo = useCallback((msg, duration) => addToast(msg, 'info', duration), [addToast]);

    return (
        <ToastContext.Provider value={{ toasts, showSuccess, showError, showWarning, showInfo, removeToast }}>
            {children}
        </ToastContext.Provider>
    );
};
