/**
 * Robust URL helper to handle static assets across local and production environments.
 * It detects the environment and returns the correct absolute URL for images.
 */

const getBaseUrl = () => {
    // 1. Check for the environment variable (VITE_API_URL)
    const envApiUrl = import.meta.env.VITE_API_URL;
    
    if (envApiUrl) {
        // Strip /api if it exists to get the server root (e.g., http://localhost:7000)
        return envApiUrl.replace(/\/api\/?$/, '');
    }

    // 2. If on the production server (photostudio.nakshatratechnologies.in)
    if (window.location.hostname.includes('nakshatratechnologies.in')) {
        return 'https://photostudio.nakshatratechnologies.in';
    }

    // 3. Fallback to current window origin (works if frontend/backend are on same domain)
    return window.location.origin;
};

const SERVER_ROOT = getBaseUrl();

/**
 * Returns a full, absolute URL for a given file path.
 * @param {string} path - Relative path (e.g., '/uploads/logo.png')
 * @returns {string} - Absolute URL
 */
export const getFileUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${SERVER_ROOT}${cleanPath}`;
};
