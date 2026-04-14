import { useState, useEffect } from 'react';
import API from '../../api/axios';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi';
import { motion, AnimatePresence } from 'framer-motion';
import './CategoriesPage.css';

const CategoriesPage = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formData, setFormData] = useState({ name: '', slaHours: '', basePrice: '', Description: '' });

    useEffect(() => { fetchCategories(); }, []);

    const fetchCategories = async () => {
        try {
            const res = await API.get('/categories');
            setCategories(res.data.categories);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
        try {
            if (editing) {
                await API.put(`/categories/${editing}`, formData);
                setSuccess('Category updated!');
            } else {
                await API.post('/categories', formData);
                setSuccess('Category created!');
            }
            setShowModal(false);
            setEditing(null);
            setFormData({ name: '', slaHours: '', basePrice: '', Description: '' });
            fetchCategories();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save category');
        }
    };

    const handleEdit = (cat) => {
        setEditing(cat._id);
        setFormData({ name: cat.name, slaHours: cat.slaHours, basePrice: cat.basePrice || '', Description: cat.Description || cat.description || '' });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this category?')) return;
        try {
            await API.delete(`/categories/${id}`);
            setSuccess('Category deleted');
            fetchCategories();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete');
            setTimeout(() => setError(''), 3000);
        }
    };

    const openCreate = () => {
        setEditing(null);
        setFormData({ name: '', slaHours: '', basePrice: '', Description: '' });
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

            {success && <div className="alert alert-success">{success}</div>}
            {error && <div className="alert alert-error">{error}</div>}

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
                            categories.map((cat) => (
                                <tr key={cat._id}>
                                    <td className="col-type">{cat.Description || 'General'}</td>
                                    <td className="col-item">{cat.name}</td>
                                    <td className="col-code">{cat.name}</td>
                                    <td className="col-price">₹{cat.basePrice || 0}</td>
                                    <td className="col-actions">
                                        <div className="action-btns">
                                            <button className="icon-btn" onClick={() => handleEdit(cat)}>
                                                <HiOutlinePencil />
                                            </button>
                                            <button className="icon-btn icon-btn--danger" onClick={() => handleDelete(cat._id)}>
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
                                            value={formData.Description}
                                            onChange={(e) => setFormData({ ...formData, Description: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Item Name *</label>
                                        <input type="text" className="form-control" required
                                            placeholder="e.g. 12X36 Photobook"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>SLA Time (Hours) *</label>
                                        <input type="number" className="form-control" required min="1"
                                            placeholder="e.g. 120"
                                            value={formData.slaHours}
                                            onChange={(e) => setFormData({ ...formData, slaHours: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Base Price (₹) *</label>
                                        <input type="number" className="form-control" required min="0"
                                            placeholder="Standard price"
                                            value={formData.basePrice}
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
