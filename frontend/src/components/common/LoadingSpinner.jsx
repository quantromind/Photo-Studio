import './LoadingSpinner.css';

const LoadingSpinner = ({ size = 'md', text = 'Loading...' }) => {
    return (
        <div className={`spinner-container spinner-${size}`}>
            <div className="spinner">
                <div className="spinner__ring"></div>
                <div className="spinner__ring"></div>
                <div className="spinner__ring"></div>
            </div>
            {text && <p className="spinner__text">{text}</p>}
        </div>
    );
};

export default LoadingSpinner;
