import { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useToast } from '../../hooks/useToast';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineSearch, HiOutlineX } from 'react-icons/hi';
import { motion, AnimatePresence } from 'framer-motion';
import './CategoriesPage.css';

const CategoriesPage = () => {
    const { showSuccess, showError } = useToast();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [error, setError] = useState('');
    const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });
    const [formData, setFormData] = useState({ name: '', slaHours: '', basePrice: '', description: '' });
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => { fetchCategories(); }, []);

    const fetchCategories = async () => {
        try {
            const res = await API.get(`/categories?t=${Date.now()}`);
            setCategories(res.data.categories);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (editing) {
                await API.put(`/categories/${editing}`, formData);
                showSuccess('Category updated!');
            } else {
                await API.post('/categories', formData);
                showSuccess('Category created!');
            }
            setShowModal(false);
            setEditing(null);
            setFormData({ name: '', slaHours: '', basePrice: '', description: '' });
            fetchCategories();
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to save category';
            setError(msg);
            showError(msg);
        }
    };

    const handleEdit = (cat) => {
        setEditing(cat._id);
        setFormData({ name: cat.name, slaHours: cat.slaHours, basePrice: cat.basePrice || '', description: cat.description || cat.Description || '' });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        setConfirmDialog({
            open: true, title: 'Delete Category?', message: 'Are you sure you want to delete this category? This cannot be undone.', variant: 'danger',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                try {
                    await API.delete(`/categories/${id}`);
                    showSuccess('Category deleted');
                    fetchCategories();
                } catch (err) {
                    showError(err.response?.data?.message || 'Failed to delete');
                }
            }
        });
    };

    const openCreate = () => {
        setEditing(null);
        setFormData({ name: '', slaHours: '', basePrice: '', description: '' });
        setShowModal(true);
    };



    if (loading) return <LoadingSpinner text="Loading categories..." />;

    return (
        <motion.div
            className="categories-page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            <div className="page-header">
                <h1>Categories & Services</h1>
                <button className="btn btn-primary" onClick={openCreate}>
                    <HiOutlinePlus /> Add Category
                </button>
            </div>

            <div className="category-search-bar">
                <div className="search-input-wrapper">
                    <HiOutlineSearch className="search-icon" />
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search by name, category, or price..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button className="search-clear-btn" onClick={() => setSearchTerm('')}>
                            <HiOutlineX />
                        </button>
                    )}
                </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <ConfirmDialog
                isOpen={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                variant="danger"
                confirmText="Delete"
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
            />

            <div className="table-container fade-in">
                <table className="category-table">
                    <thead>
                        <tr>
                            <th className="col-type">Main Category</th>
                            <th className="col-item">Item Name</th>
                            <th className="col-code">Item Code</th>
                            <th className="col-price">Base Price</th>
                            <th className="col-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    No categories found. Start by adding one or importing data.
                                </td>
                            </tr>
                        ) : (
                            categories
                            .filter((cat) => {
                                if (!searchTerm.trim()) return true;
                                const term = searchTerm.toLowerCase();
                                return (
                                    String(cat.name || '').toLowerCase().includes(term) ||
                                    String(cat.description || cat.Description || '').toLowerCase().includes(term) ||
                                    String(cat.basePrice || '').toLowerCase().includes(term)
                                );
                            })
                            .map((cat) => (
                                <tr key={cat._id}>
                                    <td className="col-type">{cat.description || cat.Description || 'General'}</td>
                                    <td className="col-item">
                                        <div style={{ color: 'var(--text-primary)' }}>{cat.name}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>SLA: {cat.slaHours}h</div>
                                    </td>
                                    <td className="col-code">
                                        <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                                            {cat.name.split(' ')[0].toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="col-price">₹{cat.basePrice || 0}</td>
                                    <td className="col-actions">
                                        <div className="action-btns">
                                            <button className="icon-btn" onClick={() => handleEdit(cat)} title="Edit Category">
                                                <HiOutlinePencil />
                                            </button>
                                            <button className="icon-btn icon-btn--danger" onClick={() => handleDelete(cat._id)} title="Delete Category">
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

            <AnimatePresence>
                {showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <motion.div
                            className="modal slide-up"
                            onClick={(e) => e.stopPropagation()}
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 50, opacity: 0 }}
                        >
                            <div className="modal-header">
                                <h2>{editing ? 'Edit Category' : 'Create Category'}</h2>
                                <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                            </div>
                            <div className="modal-body">
                                <form onSubmit={handleSubmit}>
                                    <div className="form-group">
                                        <label>Main Category (e.g. Photobook) *</label>
                                        <input type="text" className="form-control" required
                                            placeholder="e.g. Photobook, Minibook"
                                            value={formData.description || ''}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Item Name *</label>
                                        <input type="text" className="form-control" required
                                            placeholder="e.g. 12X36 Photobook"
                                            value={formData.name || ''}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>SLA Time (Hours) *</label>
                                        <input type="number" className="form-control" required min="1"
                                            placeholder="e.g. 120"
                                            value={formData.slaHours || ''}
                                            onChange={(e) => setFormData({ ...formData, slaHours: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Base Price (₹) *</label>
                                        <input type="number" className="form-control" required min="0"
                                            placeholder="Standard price"
                                            value={formData.basePrice || ''}
                                            onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })} />
                                    </div>
                                    <div className="modal-footer">
                                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                        <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'}</button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default CategoriesPage;