import { useState, useEffect } from 'react';
import API from '../../api/axios';
import StatsCard from '../../components/common/StatsCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { HiOutlinePlus, HiOutlineOfficeBuilding, HiOutlineTrash } from 'react-icons/hi';
import './SuperAdminDashboard.css';

const SuperAdminDashboard = () => {
    const [studios, setStudios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formData, setFormData] = useState({
        name: '', address: '', phone: '', email: '',
        ownerName: '', ownerEmail: '', ownerPassword: '', ownerPhone: ''
    });

    useEffect(() => { fetchStudios(); }, []);

    const fetchStudios = async () => {
        try {
            const res = await API.get('/studios');
            setStudios(res.data.studios);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
        try {
            await API.post('/studios', formData);
            setSuccess('Studio created successfully!');
            setShowModal(false);
            setFormData({ name: '', address: '', phone: '', email: '', ownerName: '', ownerEmail: '', ownerPassword: '', ownerPhone: '' });
            fetchStudios();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create studio');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this studio? This action cannot be undone.')) return;
        try {
            await API.delete(`/studios/${id}`);
            setSuccess('Studio deleted');
            fetchStudios();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete');
            setTimeout(() => setError(''), 3000);
        }
    };

    const handleToggleStatus = async (id) => {
        try {
            const res = await API.patch(`/studios/${id}/toggle-status`);
            const updated = res.data.studio;
            setStudios((prev) =>
                prev.map((s) => (s._id === updated._id ? updated : s))
            );
            setSuccess(`Studio ${updated.isActive ? 'activated' : 'deactivated'} successfully`);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to toggle status');
            setTimeout(() => setError(''), 3000);
        }
    };

    if (loading) return <LoadingSpinner text="Loading..." />;

    return (
        <div className="superadmin-dashboard fade-in">
            <div className="page-header">
                <h1>Super Admin Dashboard</h1>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <HiOutlinePlus /> Add Studio
                </button>
            </div>

            {success && <div className="alert alert-success">{success}</div>}
            {error && <div className="alert alert-error">{error}</div>}

            <div className="stats-grid" style={{ marginBottom: '32px' }}>
                <StatsCard title="Total Studios" value={studios.length} icon={<HiOutlineOfficeBuilding />} color="#6C63FF" />
            </div>

            <div className="studios-grid">
                {studios.map((studio) => (
                    <div key={studio._id} className="studio-card glass-card">
                        <div className="studio-card__header">
                            <div className="studio-card__avatar">{studio.name?.charAt(0)}</div>
                            <div>
                                <h3>{studio.name}</h3>
                                <span className={`studio-card__status ${studio.isActive ? 'active' : 'inactive'}`}>
                                    {studio.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div className="studio-card__actions">
                                <label className="toggle-switch" title={studio.isActive ? 'Deactivate Studio' : 'Activate Studio'}>
                                    <input
                                        type="checkbox"
                                        checked={studio.isActive}
                                        onChange={() => handleToggleStatus(studio._id)}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                                <button className="icon-btn icon-btn--danger"
                                    onClick={() => handleDelete(studio._id)} title="Delete">
                                    <HiOutlineTrash />
                                </button>
                            </div>
                        </div>
                        <div className="studio-card__info">
                            <p><strong>Owner:</strong> {studio.owner?.name}</p>
                            <p><strong>Email:</strong> {studio.owner?.email}</p>
                            {studio.phone && <p><strong>Phone:</strong> {studio.phone}</p>}
                            {studio.address && <p><strong>Address:</strong> {studio.address}</p>}
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2>Create New Studio</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleCreate}>
                                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>Studio Details</h3>
                                <div className="form-group">
                                    <label>Studio Name *</label>
                                    <input type="text" className="form-control" required
                                        value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Phone</label>
                                        <input type="text" className="form-control"
                                            value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Email</label>
                                        <input type="email" className="form-control"
                                            value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Address</label>
                                    <input type="text" className="form-control"
                                        value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                                </div>

                                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '20px 0 12px' }}>Owner Account</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Owner Name *</label>
                                        <input type="text" className="form-control" required
                                            value={formData.ownerName} onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Owner Phone</label>
                                        <input type="text" className="form-control"
                                            value={formData.ownerPhone} onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Owner Email *</label>
                                    <input type="email" className="form-control" required
                                        value={formData.ownerEmail} onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Owner Password *</label>
                                    <input type="password" className="form-control" required minLength={6}
                                        value={formData.ownerPassword} onChange={(e) => setFormData({ ...formData, ownerPassword: e.target.value })} />
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">Create Studio</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperAdminDashboard;
