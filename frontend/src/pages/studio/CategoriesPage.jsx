import { useState, useEffect } from 'react';
import API from '../../api/axios';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineClock } from 'react-icons/hi';
import './CategoriesPage.css';

const CategoriesPage = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formData, setFormData] = useState({ name: '', slaHours: '', basePrice: '', description: '' });
    const [searchQuery, setSearchQuery] = useState('');

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
            setFormData({ name: '', slaHours: '', basePrice: '', description: '' });
            fetchCategories();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save category');
        }
    };

    const handleEdit = (cat) => {
        setEditing(cat._id);
        setFormData({ name: cat.name, slaHours: cat.slaHours, basePrice: cat.basePrice || '', description: cat.description || '' });
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
        setFormData({ name: '', slaHours: '', basePrice: '', description: '' });
        setShowModal(true);
    };

    const filteredCategories = searchQuery.trim() 
        ? categories.filter(cat => cat.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
        : categories;

    if (loading) return <LoadingSpinner text="Loading categories..." />;

    return (
        <div className="categories-page fade-in">
            <div className="page-header">
                <h1>Categories & SLA</h1>
                <button className="btn btn-primary" onClick={openCreate}>
                    <HiOutlinePlus /> Add Category
                </button>
            </div>

            {success && <div className="alert alert-success">{success}</div>}
            {error && <div className="alert alert-error">{error}</div>}

            {/* ===== SEARCH BAR ===== */}
            <div className="categories-search-bar">
                <span className="search-icon">🔍</span>
                <input
                    type="text"
                    placeholder="Search by category name..."
                    className="search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button className="search-clear" onClick={() => setSearchQuery('')} title="Clear search">✕</button>
                )}
                {searchQuery && (
                    <span className="search-count">
                        {filteredCategories.length} result{filteredCategories.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            <div className="categories-grid">
                {categories.length === 0 ? (
                    <div className="empty-state glass-card">
                        <p>No categories yet. Create your first category to set SLA timelines.</p>
                    </div>
                ) : filteredCategories.length === 0 ? (
                    <div className="empty-state glass-card" style={{ gridColumn: '1 / -1' }}>
                        <p>No categories match your search "{searchQuery}"</p>
                    </div>
                ) : (
                    filteredCategories.map((cat) => (
                        <div key={cat._id} className="category-card glass-card">
                            <div className="category-card__header">
                                <h3>{cat.name}</h3>
                                <div className="category-card__actions">
                                    <button className="icon-btn" onClick={() => handleEdit(cat)} title="Edit">
                                        <HiOutlinePencil />
                                    </button>
                                    <button className="icon-btn icon-btn--danger" onClick={() => handleDelete(cat._id)} title="Delete">
                                        <HiOutlineTrash />
                                    </button>
                                </div>
                            </div>
                            <div className="category-card__sla">
                                <HiOutlineClock />
                                <span>{cat.slaHours} hours SLA</span>
                            </div>
                             <div className="category-card__price" style={{ marginTop: '5px', fontWeight: 'bold', color: 'var(--primary)' }}>
                                Price: ₹{cat.basePrice || 0}
                            </div>
                            {cat.description && (
                                <p className="category-card__desc">{cat.description}</p>
                            )}
                        </div>
                    ))
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editing ? 'Edit Category' : 'Create Category'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label>Category Name *</label>
                                    <input type="text" className="form-control" required
                                        placeholder="e.g. Photo Prints, Album, Photo Frame"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>SLA Time (Hours) *</label>
                                    <input type="number" className="form-control" required min="1"
                                        placeholder="e.g. 9, 120, 14"
                                        value={formData.slaHours}
                                        onChange={(e) => setFormData({ ...formData, slaHours: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Base Price (₹) *</label>
                                    <input type="number" className="form-control" required min="0"
                                        placeholder="Regular customer price"
                                        value={formData.basePrice}
                                        onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })} />
                                </div>
                                {/* Party price field removed as per request */}
                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea className="form-control" rows="3"
                                        placeholder="Optional description"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}></textarea>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CategoriesPage;
