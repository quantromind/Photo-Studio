import { useState, useEffect } from 'react';
import API from '../../api/axios';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Pagination from '../../components/common/Pagination';
import { HiOutlineUsers } from 'react-icons/hi';

const PAGE_SIZE = 10;

const CustomersPage = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
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
        fetchCustomers();
    }, []);

    if (loading) return <LoadingSpinner text="Loading customers..." />;

    const totalPages = Math.ceil(customers.length / PAGE_SIZE);
    const paginated = customers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1>Customers</h1>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{customers.length} total</span>
            </div>

            <div className="table-container glass-card">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginated.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    No customers yet
                                </td>
                            </tr>
                        ) : (
                            paginated.map((c, idx) => (
                                <tr key={c._id}>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        {(currentPage - 1) * PAGE_SIZE + idx + 1}
                                    </td>
                                    <td><strong>{c.name}</strong></td>
                                    <td>{c.email}</td>
                                    <td>{c.phone || '—'}</td>
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
                totalItems={customers.length}
                pageSize={PAGE_SIZE}
            />
        </div>
    );
};

export default CustomersPage;
