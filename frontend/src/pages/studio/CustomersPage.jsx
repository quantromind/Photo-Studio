import { useState, useEffect } from 'react';
import API from '../../api/axios';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import HistoryModal from '../../components/common/HistoryModal';
import Pagination from '../../components/common/Pagination';
import { HiOutlineViewList } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import './CustomersPage.css';

const PAGE_SIZE = 10;

const CustomersPage = () => {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [showHistoryModal, setShowHistoryModal] = useState(null);

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            const res = await API.get('/customer/list');
            setCustomers(res.data.customers);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Reset pagination when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    if (loading) return <LoadingSpinner text="Loading customers..." />;

    const filteredCustomers = customers.filter(c => {
        const q = searchQuery.toLowerCase().trim();
        return !q || 
            c.name?.toLowerCase().includes(q) || 
            c.email?.toLowerCase().includes(q) || 
            c.phone?.includes(q);
    });

    const totalPages = Math.ceil(filteredCustomers.length / PAGE_SIZE);
    const paginated = filteredCustomers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1>Customers</h1>
                <span className="search-count" style={{ fontSize: '0.85rem' }}>
                    {searchQuery ? `${filteredCustomers.length} found` : `${customers.length} total`}
                </span>
            </div>

            {/* ===== SEARCH BAR ===== */}
            <div className="customers-search-bar">
                <span className="search-icon">🔍</span>
                <input
                    type="text"
                    placeholder="Search by name, phone or email..."
                    className="search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button className="search-clear" onClick={() => setSearchQuery('')} title="Clear search">✕</button>
                )}
            </div>

            <div className="table-container glass-card">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Status</th>
                            <th>Actions</th>
                            <th>Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginated.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    {searchQuery ? `No customers match "${searchQuery}"` : 'No customers yet'}
                                </td>
                            </tr>
                        ) : (
                            paginated.map((c, idx) => (
                                <tr key={c._id}>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        {(currentPage - 1) * PAGE_SIZE + idx + 1}
                                    </td>
                                    <td 
                                        onClick={() => setShowHistoryModal(c)}
                                        style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 'bold' }}
                                        title="View order history"
                                    >
                                        {c.name}
                                    </td>
                                    <td>{c.email}</td>
                                    <td>{c.phone || '—'}</td>
                                    <td>
                                        {c.isParty ? (
                                            <span className="badge badge-success">Party</span>
                                        ) : (
                                            <span className="badge badge-secondary">Regular</span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button 
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => setShowHistoryModal(c)}
                                                title="View all orders for this customer"
                                            >
                                                <HiOutlineViewList /> Orders
                                            </button>
                                        </div>
                                    </td>
                                    <td>{new Date(c.createdAt).toLocaleDateString()}</td>
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
                totalItems={filteredCustomers.length}
                pageSize={PAGE_SIZE}
            />

            {/* History Modal */}
            {showHistoryModal && (
                <HistoryModal 
                    customer={showHistoryModal} 
                    onClose={() => setShowHistoryModal(null)} 
                />
            )}
        </div>
    );
};

export default CustomersPage;
