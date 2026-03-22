import { useState, useEffect } from 'react';
import API from '../../api/axios';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Pagination from '../../components/common/Pagination';
import { HiOutlineUserGroup, HiOutlinePlus, HiOutlineTrash, HiOutlinePencil, HiOutlineShieldCheck, HiOutlineCog, HiOutlineUser } from 'react-icons/hi';
import './CategoriesPage.css';
import './StaffPage.css';

const VALID_STEPS = ['reception', 'designing', 'printing', 'binding', 'quality_check', 'delivered'];
const STEP_LABELS = {
    reception: 'Reception',
    designing: 'Designing',
    printing: 'Printing',
    binding: 'Binding',
    quality_check: 'Quality Check',
    delivered: 'Delivered'
};

const VALID_PERMISSIONS = ['dashboard', 'orders', 'revenue', 'categories', 'customers', 'settings'];
const PERMISSION_LABELS = {
    dashboard: 'Dashboard',
    orders: 'Orders',
    revenue: 'Revenue',
    categories: 'Categories',
    customers: 'Customers',
    settings: 'Settings'
};
const PERMISSION_DESCRIPTIONS = {
    dashboard: 'Access to analytics and overview stats',
    orders: 'Manage and view customer orders',
    revenue: 'View revenue reports and financial data',
    categories: 'View and manage service categories',
    customers: 'Access customer directory and details',
    settings: 'Modify studio configuration and preferences'
};

const PAGE_SIZE = 10;

const StaffPage = () => {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [activeTab, setActiveTab] = useState('details');
    const [formData, setFormData] = useState({
        _id: '', name: '', email: '', phone: '', password: '', assignedSteps: [], permissions: ['orders'], isActive: true
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchStaff();
    }, []);

    const fetchStaff = async () => {
        try {
            const res = await API.get('/staff');
            setStaff(res.data.staff);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (member = null) => {
        if (member) {
            setEditMode(true);
            setFormData({
                _id: member._id,
                name: member.name,
                email: member.email,
                phone: member.phone || '',
                password: '',
                assignedSteps: member.assignedSteps || [],
                permissions: member.permissions || ['orders'],
                isActive: member.isActive
            });
        } else {
            setEditMode(false);
            setFormData({
                _id: '', name: '', email: '', phone: '', password: '', assignedSteps: [], permissions: ['orders'], isActive: true
            });
        }
        setActiveTab('details');
        setShowModal(true);
        setError('');
        setSuccess('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        
        try {
            if (editMode) {
                const dataToSubmit = { ...formData };
                if (!dataToSubmit.password) delete dataToSubmit.password;
                
                await API.put(`/staff/${formData._id}`, dataToSubmit);
                setSuccess('Staff member updated successfully');
            } else {
                if (!formData.password) {
                    throw new Error('Password is required for new staff');
                }
                await API.post('/staff', formData);
                setSuccess('Staff member created successfully');
            }
            fetchStaff();
            setTimeout(() => { setShowModal(false); setSuccess(''); }, 1500);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to save staff member');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to remove this staff member?')) return;
        try {
            await API.delete(`/staff/${id}`);
            setSuccess('Staff member removed');
            fetchStaff();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to remove staff');
            setTimeout(() => setError(''), 3000);
        }
    };

    const togglePermission = (perm) => {
        setFormData(prev => ({
            ...prev,
            permissions: prev.permissions.includes(perm)
                ? prev.permissions.filter(p => p !== perm)
                : [...prev.permissions, perm]
        }));
    };

    const toggleStep = (step) => {
        setFormData(prev => ({
            ...prev,
            assignedSteps: prev.assignedSteps.includes(step)
                ? prev.assignedSteps.filter(s => s !== step)
                : [...prev.assignedSteps, step]
        }));
    };

    if (loading) return <LoadingSpinner text="Loading staff..." />;

    const totalPages = Math.ceil(staff.length / PAGE_SIZE);
    const paginated = staff.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1>Staff Management</h1>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{staff.length} member(s)</span>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                    <HiOutlinePlus /> Add Staff
                </button>
            </div>

            {success && <div className="alert alert-success slide-up">{success}</div>}
            {error && <div className="alert alert-error slide-up">{error}</div>}

            <div className="table-container glass-card mt-4">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Permissions</th>
                            <th>Steps</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginated.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    No staff members found.
                                </td>
                            </tr>
                        ) : (
                            paginated.map(member => (
                                <tr key={member._id}>
                                    <td><strong>{member.name}</strong></td>
                                    <td>{member.email}</td>
                                    <td>{member.phone || '—'}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                            {member.permissions?.map(perm => (
                                                <span key={perm} className="staff-badge staff-badge--permission">
                                                    {PERMISSION_LABELS[perm]}
                                                </span>
                                            ))}
                                            {(!member.permissions || member.permissions.length === 0) && (
                                                <span style={{ color: 'var(--text-muted)' }}>None</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                            {member.assignedSteps?.map(step => (
                                                <span key={step} className="staff-badge staff-badge--step">
                                                    {STEP_LABELS[step]}
                                                </span>
                                            ))}
                                            {(!member.assignedSteps || member.assignedSteps.length === 0) && (
                                                <span style={{ color: 'var(--text-muted)' }}>None</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{ color: member.isActive ? 'var(--status-completed)' : 'var(--status-critical)' }}>
                                            {member.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-btns">
                                            <button className="btn btn-sm btn-secondary" onClick={() => handleOpenModal(member)}>
                                                <HiOutlinePencil />
                                            </button>
                                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(member._id)}>
                                                <HiOutlineTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={staff.length}
                pageSize={PAGE_SIZE}
            />

            {showModal && (
                <div className="modal-overlay" onClick={() => !submitting && setShowModal(false)}>
                    <div className="modal slide-up staff-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editMode ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
                            <button className="modal-close" onClick={() => !submitting && setShowModal(false)}>×</button>
                        </div>

                        {/* Tab Navigation */}
                        <div className="staff-tabs">
                            <button 
                                className={`staff-tab ${activeTab === 'details' ? 'staff-tab--active' : ''}`}
                                onClick={() => setActiveTab('details')}
                                type="button"
                            >
                                <HiOutlineUser /> Details
                            </button>
                            <button 
                                className={`staff-tab ${activeTab === 'permissions' ? 'staff-tab--active' : ''}`}
                                onClick={() => setActiveTab('permissions')}
                                type="button"
                            >
                                <HiOutlineShieldCheck /> Permissions
                            </button>
                            <button 
                                className={`staff-tab ${activeTab === 'workflow' ? 'staff-tab--active' : ''}`}
                                onClick={() => setActiveTab('workflow')}
                                type="button"
                            >
                                <HiOutlineCog /> Workflow Steps
                            </button>
                        </div>

                        <div className="modal-body">
                            <form onSubmit={handleSubmit}>
                                {/* Tab 1: Details */}
                                {activeTab === 'details' && (
                                    <div className="staff-tab-panel fade-in">
                                        <div className="form-group">
                                            <label>Name *</label>
                                            <input type="text" className="form-control" required
                                                value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                        </div>
                                        <div className="form-group">
                                            <label>Email *</label>
                                            <input type="email" className="form-control" required disabled={editMode}
                                                value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                        </div>
                                        <div className="form-group">
                                            <label>Phone</label>
                                            <input type="text" className="form-control"
                                                value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                        </div>
                                        <div className="form-group">
                                            <label>Password {editMode ? '(Leave blank to keep unchanged)' : '*'}</label>
                                            <input type="password" className="form-control" required={!editMode}
                                                value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                        </div>
                                        {editMode && (
                                            <div className="form-group">
                                                <div className="toggle-row">
                                                    <div className="toggle-info">
                                                        <strong>Active Account</strong>
                                                        <span>Disable to block login access</span>
                                                    </div>
                                                    <label className="toggle-switch">
                                                        <input type="checkbox" checked={formData.isActive}
                                                            onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
                                                        <span className="toggle-slider"></span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Tab 2: Permissions */}
                                {activeTab === 'permissions' && (
                                    <div className="staff-tab-panel fade-in">
                                        <p className="tab-description">Control which pages and features this staff member can access.</p>
                                        <div className="toggle-list">
                                            {VALID_PERMISSIONS.map(perm => (
                                                <div className="toggle-row" key={perm}>
                                                    <div className="toggle-info">
                                                        <strong>{PERMISSION_LABELS[perm]}</strong>
                                                        <span>{PERMISSION_DESCRIPTIONS[perm]}</span>
                                                    </div>
                                                    <label className="toggle-switch">
                                                        <input type="checkbox"
                                                            checked={formData.permissions.includes(perm)}
                                                            onChange={() => togglePermission(perm)} />
                                                        <span className="toggle-slider"></span>
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Tab 3: Workflow Steps */}
                                {activeTab === 'workflow' && (
                                    <div className="staff-tab-panel fade-in">
                                        <p className="tab-description">Assign which order workflow steps this staff member can interact with.</p>
                                        <div className="toggle-list">
                                            {VALID_STEPS.map(step => (
                                                <div className="toggle-row" key={step}>
                                                    <div className="toggle-info">
                                                        <strong>{STEP_LABELS[step]}</strong>
                                                        <span>Can view & process orders at this stage</span>
                                                    </div>
                                                    <label className="toggle-switch">
                                                        <input type="checkbox"
                                                            checked={formData.assignedSteps.includes(step)}
                                                            onChange={() => toggleStep(step)} />
                                                        <span className="toggle-slider"></span>
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {error && <div className="alert alert-error slide-up" style={{marginTop:'12px'}}>{error}</div>}
                                {success && <div className="alert alert-success slide-up" style={{marginTop:'12px'}}>{success}</div>}

                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" disabled={submitting} onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? 'Saving...' : 'Save Staff'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffPage;
