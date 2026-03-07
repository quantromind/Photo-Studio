import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import API from '../../api/axios';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { HiOutlineDownload } from 'react-icons/hi';
import './AlbumPage.css';

const AlbumPage = () => {
    const { orderId } = useParams();
    const [album, setAlbum] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);

    useEffect(() => {
        const fetchAlbum = async () => {
            try {
                const res = await API.get(`/customer/album/${orderId}`);
                setAlbum(res.data.album);
            } catch (err) {
                setError(err.response?.data?.message || 'Album not found');
            } finally {
                setLoading(false);
            }
        };
        fetchAlbum();
    }, [orderId]);

    if (loading) return <LoadingSpinner text="Loading album..." />;

    if (error) {
        return (
            <div className="album-page">
                <div className="album-error glass-card">
                    <h2>😔 Album Not Found</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="album-page">
            <div className="album-header">
                <div className="album-logo">📸</div>
                <h1>{album.studioName}</h1>
                <p className="album-meta">
                    Order <strong>{album.orderId}</strong> • {album.customerName} • {album.categoryNames}
                </p>
                <StatusBadge status={album.status} />
            </div>

            {album.images?.length === 0 ? (
                <div className="album-empty glass-card">
                    <p>📷 No photos uploaded yet. Please check back later.</p>
                </div>
            ) : (
                <div className="album-grid">
                    {album.images.map((img, idx) => (
                        <div key={img._id || idx} className="album-item"
                            onClick={() => setSelectedImage(img)}>
                            <img src={`https://photostudio.nakshatratechnologies.in${img.url}`} alt={img.originalName || `Photo ${idx + 1}`} />
                            <div className="album-item__overlay">
                                <span>View</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Lightbox */}
            {selectedImage && (
                <div className="lightbox" onClick={() => setSelectedImage(null)}>
                    <div className="lightbox__content" onClick={(e) => e.stopPropagation()}>
                        <button className="lightbox__close" onClick={() => setSelectedImage(null)}>×</button>
                        <img src={`https://photostudio.nakshatratechnologies.in${selectedImage.url}`} alt={selectedImage.originalName} />
                        <div className="lightbox__actions">
                            <a href={`https://photostudio.nakshatratechnologies.in${selectedImage.url}`} download
                                className="btn btn-primary btn-sm" target="_blank" rel="noopener noreferrer">
                                <HiOutlineDownload /> Download
                            </a>
                        </div>
                    </div>
                </div>
            )}

            <footer className="album-footer">
                <p>Powered by <strong>PhotoStudio</strong></p>
            </footer>
        </div>
    );
};

export default AlbumPage;
