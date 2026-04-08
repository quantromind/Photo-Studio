import { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useAuth } from '../../hooks/useAuth';
import './StudioSettings.css';
import { getFileUrl } from '../../utils/urlHelper';

const StudioSettings = () => {
    const { user } = useAuth();
    const [studio, setStudio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        pan: '',
        bankDetails: ''
    });
    const [logoFile, setLogoFile] = useState(null);
    const [qrFile, setQrFile] = useState(null);

    useEffect(() => {
        const fetchStudio = async () => {
            try {
                if (user?.studio) {
                    const studioId = typeof user.studio === 'object' ? user.studio._id : user.studio;
                    const res = await API.get(`/studios/${studioId}`);
                    const s = res.data.studio;
                    setStudio(s);
                    setFormData({
                        name: s.name || '',
                        email: s.email || '',
                        phone: s.phone || '',
                        address: s.address || '',
                        gstin: s.gstin || '',
                        pan: s.pan || '',
                        bankDetails: s.bankDetails || ''
                    });
                }
            } catch (err) {
                setError('Failed to load studio details.');
            } finally {
                setLoading(false);
            }
        };
        fetchStudio();
    }, [user]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(''); setSuccess('');
        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                data.append(key, formData[key]);
            });
            if (logoFile) {
                data.append('logo', logoFile);
            }
            if (qrFile) {
                data.append('paymentQR', qrFile);
            }

            const res = await API.put(`/studios/${studio._id}`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setStudio(res.data.studio); // Refresh studio state to update previews
            setSuccess('✅ Studio settings updated automatically! This information will appear on your invoices.');
            setLogoFile(null);
            setQrFile(null);
            setTimeout(() => setSuccess(''), 5000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Loading settings...</div>;

    return (
        <div className="studio-settings fade-in">
            <div className="page-header">
                <h1>Studio Settings</h1>
            </div>

            {success && <div className="alert alert-success slide-up">{success}</div>}
            {error && <div className="alert alert-error slide-up">{error}</div>}

            <div className="settings-container glass-card">
                <h3>Invoice Details</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                    This information will be printed on all order invoices to your customers.
                </p>

                <form onSubmit={handleSave} className="settings-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label>Business Name</label>
                            <input type="text" className="form-control" name="name" required
                                value={formData.name} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label>Studio Logo (For Invoices)</label>
                            <input type="file" className="form-control" accept="image/*"
                                onChange={(e) => setLogoFile(e.target.files[0])} style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }} />
                            {studio?.logo && !logoFile && (
                                <div style={{ marginTop: '10px' }}>
                                    <img src={getFileUrl(studio.logo)} alt="Logo Preview" style={{ maxHeight: '60px', borderRadius: '4px', border: '1px solid var(--border)' }} />
                                    <div style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>Current Logo Active</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Payment QR Code (For Invoices)</label>
                            <input type="file" className="form-control" accept="image/*"
                                onChange={(e) => setQrFile(e.target.files[0])} style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }} />
                            {studio?.paymentQR && !qrFile && (
                                <div style={{ marginTop: '10px' }}>
                                    <img src={getFileUrl(studio.paymentQR)} alt="QR Preview" style={{ maxHeight: '100px', borderRadius: '4px', border: '1px solid var(--border)' }} />
                                    <div style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>Current QR Active</div>
                                </div>
                            )}
                        </div>
                        <div className="form-group">
                            {/* Placeholder for alignment if needed */}
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Business Email</label>
                            <input type="email" className="form-control" name="email"
                                value={formData.email} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label>Business Phone</label>
                            <input type="text" className="form-control" name="phone"
                                value={formData.phone} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Full Address</label>
                        <textarea className="form-control" name="address" rows="3"
                            value={formData.address} onChange={handleChange} placeholder="Line 1, City, State, ZIP"></textarea>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>GSTIN Number</label>
                            <input type="text" className="form-control" name="gstin"
                                value={formData.gstin} onChange={handleChange} placeholder="e.g. 27AAAAA0000A1Z5" />
                        </div>
                        <div className="form-group">
                            <label>PAN Number</label>
                            <input type="text" className="form-control" name="pan"
                                value={formData.pan} onChange={handleChange} placeholder="e.g. ABCDE1234F" />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Bank Details (For Payments)</label>
                        <textarea className="form-control" name="bankDetails" rows="2"
                            value={formData.bankDetails} onChange={handleChange} placeholder="Bank Name, A/C No, IFSC Code..."></textarea>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default StudioSettings;
