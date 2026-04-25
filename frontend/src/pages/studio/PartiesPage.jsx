import { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useToast } from '../../hooks/useToast';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import HistoryModal from '../../components/common/HistoryModal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import { HiOutlineUserAdd, HiOutlineAdjustments, HiOutlineTrash, HiOutlineCheckCircle, HiOutlineCurrencyRupee, HiOutlineViewList } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import './PartiesPage.css';

const PartiesPage = () => {
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();
    const [parties, setParties] = useState([]);
    const [allCustomers, setAllCustomers] = useState([]); // Keep track of all customers
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showPriceModal, setShowPriceModal] = useState(null);
    const [showHistoryModal, setShowHistoryModal] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '', email: '', phone: '', city: '', state: '', partyType: ''
    });
    const [priceFormData, setPriceFormData] = useState({}); // { categoryId: price }
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;
    
    // UI state for custom 'Other' inputs
    const [showOtherCity, setShowOtherCity] = useState(false);
    const [showOtherType, setShowOtherType] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [partyRes, catRes] = await Promise.all([
                API.get('/parties'),
                API.get('/categories')
            ]);
            setParties(partyRes.data.parties || []);
            setCategories(catRes.data.categories);
        } catch (err) {
            console.error(err);
            setError('Failed to fetch parties');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateParty = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        
        try {
            // Check if already a party
            const existingParty = parties.find(d => d.phone === formData.phone);
            if (existingParty) {
                setError('A party with this phone number already exists.');
                setSubmitting(false);
                return;
            }

            await API.post('/parties/create', formData);
            showSuccess('New Party added successfully!');
            setFormData({ name: '', email: '', phone: '', city: '', state: '', partyType: '' });
            setShowOtherCity(false);
            setShowOtherType(false);
            setShowModal(false);
            fetchData();
        } catch (err) {
            console.error(err);
            showError(err.message || err.response?.data?.message || 'Failed to add party');
        } finally {
            setSubmitting(false);
        }
    };

    const openPriceModal = (party) => {
        setShowPriceModal(party);
        const prices = {};
        party.partyPrices?.forEach(p => {
            const catId = p.category?._id || p.category;
            prices[catId] = p.price;
        });
        setPriceFormData(prices);
    };

    const handleSavePrices = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const pricesArray = Object.keys(priceFormData).map(catId => ({
                category: catId,
                price: parseFloat(priceFormData[catId])
            })).filter(p => p.price > 0);

            await API.put(`/parties/prices/${showPriceModal._id}`, { prices: pricesArray });
            showSuccess('Prices updated for ' + showPriceModal.name);
            setShowPriceModal(null);
            fetchData();
        } catch (err) {
            showError('Failed to save prices');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteParty = (party) => {
        setConfirmDialog({
            open: true,
            title: 'Delete Party?',
            message: `Are you sure you want to delete ${party.name}?`,
            variant: 'danger',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                try {
                    await API.delete(`/parties/${party._id}`);
                    showSuccess(`${party.name} has been deleted.`);
                    fetchData();
                } catch (err) {
                    showError(err.response?.data?.message || 'Failed to delete party');
                }
            }
        });
    };

    if (loading) return <LoadingSpinner text="Managing parties..." />;

    // Compute derived data for Search and Pagination
    const filteredParties = parties.filter(p => 
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.phone?.includes(searchQuery) ||
        p.city?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalPages = Math.ceil(filteredParties.length / itemsPerPage) || 1;
    const paginatedParties = filteredParties.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const cleanAndCapitalize = (str) => {
        if (!str) return null;
        str = str.trim();
        // Ignore if it's just numbers (like phone numbers imported in wrong fields)
        if (/^[0-9\s\-]+$/.test(str)) return null;
        // Convert to Title Case
        return str.replace(
            /\w\S*/g,
            function(txt) {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            }
        );
    };

    const uniqueCities = [...new Set(
        parties.map(p => cleanAndCapitalize(p.city)).filter(Boolean)
    )].sort((a,b) => a.localeCompare(b));

    const uniquePartyTypes = [...new Set(
        parties.map(p => cleanAndCapitalize(p.partyType)).filter(Boolean)
    )].sort((a,b) => a.localeCompare(b));

    return (
        <div className="parties-page fade-in">
            <div className="page-header">
                <div>
                    <h1>Parties Management</h1>
                    <p className="subtitle">Manage VIP parties and their custom pricing</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <HiOutlineUserAdd /> Add New Party
                </button>
            </div>

            <div className="table-controls">
                <div className="search-bar">
                    <input 
                        type="text" 
                        placeholder="Search by name, phone, or city..." 
                        className="form-control"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1); // Reset to page 1 on search
                        }}
                    />
                </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <ConfirmDialog
                isOpen={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                variant={confirmDialog.variant}
                confirmText={confirmDialog.variant === 'danger' ? 'Delete' : 'Confirm'}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
            />

            <div className="table-container glass-card">
                <table>
                    <thead>
                        <tr>
                            <th>Party Name</th>
                            <th>Contact Info</th>
                            <th>Location</th>
                            <th>Custom Rates</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedParties.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ padding: 0, background: 'transparent' }}>
                                    <EmptyState 
                                        heading="No parties found" 
                                        message="Adjust your search or add a new party." 
                                        actionText="Add New Party"
                                        onAction={() => setShowModal(true)}
                                    />
                                </td>
                            </tr>
                        ) : (
                            paginatedParties.map(party => (
                                <tr key={party._id}>
                                    <td>
                                        <div 
                                            onClick={() => setShowHistoryModal(party)}
                                            style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 'bold' }}
                                        >
                                            {party.name}
                                        </div>
                                    </td>
                                    <td>
                                        {party.phone} <br/>
                                        <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{party.email}</span>
                                    </td>
                                    <td>{party.city ? `${party.city}, ${party.state}` : '-'}</td>
                                    <td>{party.partyPrices?.length || 0} items</td>
                                    <td>{new Date(party.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <div className="action-buttons-row" style={{ display: 'flex', gap: '8px' }}>
                                            <button className="btn btn-sm btn-secondary" title="Set Prices" onClick={() => openPriceModal(party)}>
                                                <HiOutlineCurrencyRupee /> Prices
                                            </button>
                                            <button className="btn btn-sm btn-outline-secondary" title="History" onClick={() => setShowHistoryModal(party)}>
                                                <HiOutlineViewList />
                                            </button>
                                            <button className="btn btn-sm btn-outline-danger" title="Remove" onClick={() => handleDeleteParty(party)}>
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

            {totalPages > 1 && (
                <div className="pagination" style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', gap: '10px', alignItems: 'center' }}>
                    <button 
                        className="btn btn-outline-secondary" 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    >
                        Previous
                    </button>
                    <span>Page {currentPage} of {totalPages} (Total: {filteredParties.length})</span>
                    <button 
                        className="btn btn-outline-secondary" 
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Price Modal */}
            {showPriceModal && (
                <div className="modal-overlay" onClick={() => setShowPriceModal(null)}>
                    <div className="modal slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                        <div className="modal-header">
                            <div>
                                <h2>Custom Prices: {showPriceModal.name}</h2>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Overriding default party rates</p>
                            </div>
                            <button className="modal-close" onClick={() => setShowPriceModal(null)}>×</button>
                        </div>
                        <form onSubmit={handleSavePrices}>
                            <div className="modal-body custom-prices-list">
                                {categories.map(cat => (
                                    <div key={cat._id} className="price-row">
                                        <div className="cat-info">
                                            <strong>{cat.name}</strong>
                                            <div className="market-rates">
                                                Regular: ₹{cat.basePrice} | Std Party: ₹{cat.partyPrice}
                                            </div>
                                        </div>
                                        <div className="price-input-group">
                                            <span>₹</span>
                                            <input 
                                                type="number" 
                                                className="form-control"
                                                placeholder={cat.partyPrice}
                                                value={priceFormData[cat._id] || ''}
                                                onChange={e => setPriceFormData({...priceFormData, [cat._id]: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPriceModal(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Saving...' : 'Save Custom Prices'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Party Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Add New Party</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleCreateParty}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Party Shop/Name *</label>
                                    <input type="text" className="form-control" required
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label>Phone Number *</label>
                                    <input type="tel" className="form-control" required pattern="[0-9]{10}"
                                        value={formData.phone}
                                        onChange={e => setFormData({...formData, phone: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label>Email Address</label>
                                    <input type="email" className="form-control"
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label>City</label>
                                    <select 
                                        className="form-control"
                                        value={showOtherCity ? 'Other' : (uniqueCities.includes(formData.city) ? formData.city : (formData.city ? 'Other' : ''))}
                                        onChange={(e) => {
                                            if (e.target.value === 'Other') {
                                                setShowOtherCity(true);
                                                setFormData({ ...formData, city: '' });
                                            } else {
                                                setShowOtherCity(false);
                                                setFormData({ ...formData, city: e.target.value });
                                            }
                                        }}
                                    >
                                        <option value="">Select a city...</option>
                                        {uniqueCities.map((city, idx) => (
                                            <option key={idx} value={city}>{city}</option>
                                        ))}
                                        <option value="Other">Other (Type manually)</option>
                                    </select>
                                    {showOtherCity && (
                                        <input 
                                            type="text" 
                                            className="form-control" 
                                            style={{ marginTop: '10px' }} 
                                            placeholder="Enter custom city name"
                                            value={formData.city}
                                            onChange={e => setFormData({ ...formData, city: e.target.value })} 
                                            required
                                        />
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>State</label>
                                    <input type="text" className="form-control"
                                        value={formData.state}
                                        onChange={e => setFormData({...formData, state: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label>Party Type</label>
                                    <select 
                                        className="form-control"
                                        value={showOtherType ? 'Other' : (uniquePartyTypes.includes(formData.partyType) ? formData.partyType : (formData.partyType ? 'Other' : ''))}
                                        onChange={(e) => {
                                            if (e.target.value === 'Other') {
                                                setShowOtherType(true);
                                                setFormData({ ...formData, partyType: '' });
                                            } else {
                                                setShowOtherType(false);
                                                setFormData({ ...formData, partyType: e.target.value });
                                            }
                                        }}
                                    >
                                        <option value="">Select party type...</option>
                                        {uniquePartyTypes.map((type, idx) => (
                                            <option key={idx} value={type}>{type}</option>
                                        ))}
                                        <option value="Other">Other (Type manually)</option>
                                    </select>
                                    {showOtherType && (
                                        <input 
                                            type="text" 
                                            className="form-control" 
                                            style={{ marginTop: '10px' }} 
                                            placeholder="Enter custom party type"
                                            value={formData.partyType}
                                            onChange={e => setFormData({ ...formData, partyType: e.target.value })} 
                                            required
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Creating...' : 'Create Party Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* History Modal */}
            {showHistoryModal && (
                <HistoryModal 
                    key={showHistoryModal._id}
                    customer={showHistoryModal} 
                    onClose={() => setShowHistoryModal(null)} 
                />
            )}
        </div>
    );
};

export default PartiesPage;
