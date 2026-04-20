import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Global keyboard shortcuts for power-user navigation.
 * Ctrl+N → New Order
 * Ctrl+K → Focus search (on Orders page)
 * Escape → Close modals (handled locally in components)
 */
const useKeyboardShortcuts = () => {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Don't fire shortcuts when typing in inputs/textareas
            const tag = document.activeElement?.tagName;
            const isInputFocused = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

            // Ctrl+N → New Order (always)
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                navigate('/orders/new');
                return;
            }

            // Ctrl+K → Focus search on Orders page
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchInput = document.querySelector('.orders-search-input');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                } else {
                    // If not on orders page, navigate there first
                    navigate('/orders');
                }
                return;
            }

            // Ctrl+S → Submit the closest form (when in a form context)
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                const activeForm = document.activeElement?.closest('form');
                if (activeForm) {
                    const submitBtn = activeForm.querySelector('button[type="submit"]');
                    if (submitBtn && !submitBtn.disabled) {
                        submitBtn.click();
                    }
                }
                return;
            }

            // Escape → Close any open modal
            if (e.key === 'Escape' && !isInputFocused) {
                const modalOverlay = document.querySelector('.modal-overlay');
                if (modalOverlay) {
                    modalOverlay.click();
                }
                return;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [navigate, location]);
};

export default useKeyboardShortcuts;
