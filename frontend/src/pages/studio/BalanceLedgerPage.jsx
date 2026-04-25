import { useState, useEffect, useRef } from 'react';
import API from '../../api/axios';
import { useToast } from '../../hooks/useToast';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import {
    HiOutlineSearch, HiOutlineX, HiOutlinePlus,
    HiOutlineTrash, HiOutlineCurrencyRupee, HiOutlineClipboardList,
    HiOutlinePhone, HiOutlineMail, HiOutlineClock,
    HiOutlineCheckCircle, HiOutlineBookOpen
} from 'react-icons/hi';
import './BalanceLedgerPage.css';

const METHODS = [
    { value: 'cash', label: 'Cash', emoji: '💵' },
    { value: 'upi', label: 'UPI', emoji: '📱' },
    { value: 'bank_transfer', label: 'Bank Transfer', emoji: '🏦' },
    { value: 'cheque', label: 'Cheque', emoji: '📝' },
    { value: 'other', label: 'Other', emoji: '📋' }
];

const BalanceLedgerPage = () => {
    const { showSuccess, showError } = useToast();
    const searchRef = useRef(null);

    // Global data
    const [ledger, setLedger] = useState([]);
    const [summary, setSummary] = useState({ totalDue: 0, totalBilled: 0, totalPaid: 0 });
    const [loading, setLoading] = useState(true);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    // Selected party
    const [selectedParty, setSelectedParty] = useState(null);
    const [partyPayments, setPartyPayments] = useState([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);

    // Payment form
    const [paymentForm, setPaymentForm] = useState({
        amount: '', paymentMethod: 'cash', reference: '', notes: ''
    });
    const [submitting, setSubmitting] = useState(false);

    // Confirm dialog
    const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });

    useEffect(() => {
        fetchLedger();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchLedger = async () => {
        try {
            setLoading(true);
            const res = await API.get(`/payments/ledger?_t=${Date.now()}`);
            setLedger(res.data.ledger || []);
            setSummary(res.data.summary || { totalDue: 0, totalBilled: 0, totalPaid: 0 });
        } catch (err) {
            console.error('Failed to fetch ledger:', err);
            showError('Failed to load balance ledger');
        } finally {
            setLoading(false);
        }
    };

    const fetchPartyPayments = async (partyId) => {
        try {
            setPaymentsLoading(true);
            const res = await API.get(`/payments/party/${partyId}?_t=${Date.now()}`);
            setPartyPayments(res.data.payments || []);
        } catch (err) {
            console.error('Failed to fetch party payments:', err);
        } finally {
            setPaymentsLoading(false);
        }
    };

    const selectParty = (party) => {
        setSelectedParty(party);
        setSearchQuery('');
        setShowDropdown(false);
        setPaymentForm({ amount: '', paymentMethod: 'cash', reference: '', notes: '' });
        fetchPartyPayments(party._id);
    };

    const closePartyProfile = () => {
        setSelectedParty(null);
        setPartyPayments([]);
        setPaymentForm({ amount: '', paymentMethod: 'cash', reference: '', notes: '' });
    };

    const handleRecordPayment = async (e) => {
        e.preventDefault();
        const amount = parseFloat(paymentForm.amount);
        if (!amount || amount <= 0) {
            showError('Enter a valid amount');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Optimistic UI Update for instant feedback
            const newTotalPaid = selectedParty.totalPaid + amount;
            const newDue = Math.max(0, selectedParty.due - amount);
            
            setSelectedParty(prev => ({
                ...prev,
                totalPaid: newTotalPaid,
                due: newDue,
                totalManualPayments: prev.totalManualPayments + amount
            }));

            setSummary(prev => ({
                ...prev,
                totalPaid: prev.totalPaid + amount,
                totalDue: Math.max(0, prev.totalDue - amount)
            }));
            
            // 2. Actually save to backend
            await API.post('/payments', {
                partyId: selectedParty._id,
                amount,
                paymentMethod: paymentForm.paymentMethod,
                reference: paymentForm.reference,
                notes: paymentForm.notes
            });
            
            showSuccess(`₹${formatCurrency(amount)} payment recorded for ${selectedParty.name}`);
            setPaymentForm({ amount: '', paymentMethod: 'cash', reference: '', notes: '' });
            
            // 3. Fetch latest ground truth from server silently to ensure full sync
            const timestamp = Date.now();
            fetchPartyPayments(selectedParty._id);
            
            const ledgerRes = await API.get(`/payments/ledger?_t=${timestamp}`);
            if (ledgerRes.data && ledgerRes.data.ledger) {
                setLedger(ledgerRes.data.ledger);
                setSummary(ledgerRes.data.summary);
                
                const updatedParty = ledgerRes.data.ledger.find(p => p._id === selectedParty._id);
                if (updatedParty) {
                    setSelectedParty(updatedParty);
                }
            }
            
        } catch (err) {
            showError(err.response?.data?.message || 'Failed to record payment');
            // Revert on failure by re-fetching
            fetchLedger();
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePayment = (payment) => {
        setConfirmDialog({
            open: true,
            title: 'Delete Payment?',
            message: `Delete ₹${formatCurrency(payment.amount)} payment? This will increase the due amount.`,
            variant: 'danger',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                try {
                    // Optimistic update
                    setSelectedParty(prev => ({
                        ...prev,
                        totalPaid: prev.totalPaid - payment.amount,
                        due: prev.due + payment.amount,
                        totalManualPayments: prev.totalManualPayments - payment.amount
                    }));
                    setSummary(prev => ({
                        ...prev,
                        totalPaid: prev.totalPaid - payment.amount,
                        totalDue: prev.totalDue + payment.amount
                    }));

                    await API.delete(`/payments/${payment._id}`);
                    showSuccess('Payment deleted');
                    
                    // Refresh silently
                    const timestamp = Date.now();
                    fetchPartyPayments(selectedParty._id);
                    const ledgerRes = await API.get(`/payments/ledger?_t=${timestamp}`);
                    if (ledgerRes.data && ledgerRes.data.ledger) {
                        setLedger(ledgerRes.data.ledger);
                        setSummary(ledgerRes.data.summary);
                        const updatedParty = ledgerRes.data.ledger.find(p => p._id === selectedParty._id);
                        if (updatedParty) setSelectedParty(updatedParty);
                    }
                } catch (err) {
                    showError('Failed to delete payment');
                    fetchLedger(); // revert on fail
                }
            }
        });
    };

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val);
    const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
    const getMethodLabel = (val) => METHODS.find(m => m.value === val)?.label || val;
    const getMethodEmoji = (val) => METHODS.find(m => m.value === val)?.emoji || '💰';

    if (loading) return <LoadingSpinner text="Loading balance ledger..." />;

    // Search filter
    const searchResults = searchQuery.trim().length >= 1
        ? ledger.filter(p =>
            p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.phone?.includes(searchQuery)
        ).slice(0, 10)
        : [];

    return (
        <div className="ledger-page fade-in">
            <div className="page-header">
                <div>
                    <h1>Balance Ledger</h1>
                    <p className="subtitle" style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                        Search a party to view dues and record payments
                    </p>
                </div>
            </div>

            {/* Global Summary */}
            <div className="ledger-global-stats">
                <div className="global-stat-card">
                    <div className="global-stat-icon billed"><HiOutlineClipboardList /></div>
                    <div className="global-stat-info">
                        <span className="global-stat-label">Total Billed</span>
                        <span className="global-stat-value">₹{formatCurrency(summary.totalBilled)}</span>
                    </div>
                </div>
                <div className="global-stat-card">
                    <div className="global-stat-icon collected"><HiOutlineCheckCircle /></div>
                    <div className="global-stat-info">
                        <span className="global-stat-label">Total Collected</span>
                        <span className="global-stat-value" style={{ color: '#00D4AA' }}>₹{formatCurrency(summary.totalPaid)}</span>
                    </div>
                </div>
                <div className="global-stat-card">
                    <div className="global-stat-icon outstanding"><HiOutlineCurrencyRupee /></div>
                    <div className="global-stat-info">
                        <span className="global-stat-label">Outstanding Dues</span>
                        <span className="global-stat-value" style={{ color: '#FF6B9D' }}>₹{formatCurrency(summary.totalDue)}</span>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="ledger-search-section" ref={searchRef}>
                <div className="ledger-search-wrap">
                    <span className="ledger-search-icon"><HiOutlineSearch /></span>
                    <input
                        type="text"
                        className="ledger-search-input"
                        placeholder="Search party by name or phone number..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setShowDropdown(true);
                        }}
                        onFocus={() => searchQuery.trim().length >= 1 && setShowDropdown(true)}
                    />
                    {/* Search Results Dropdown */}
                    {showDropdown && searchQuery.trim().length >= 1 && (
                        <div className="ledger-search-results">
                            {searchResults.length === 0 ? (
                                <div className="search-no-results">
                                    No parties found for "{searchQuery}"
                                </div>
                            ) : (
                                searchResults.map(party => (
                                    <div
                                        key={party._id}
                                        className="search-result-item"
                                        onClick={() => selectParty(party)}
                                    >
                                        <div className="search-result-avatar">{getInitials(party.name)}</div>
                                        <div className="search-result-info">
                                            <div className="search-result-name">{party.name}</div>
                                            <div className="search-result-phone">{party.phone} {party.city ? `· ${party.city}` : ''}</div>
                                        </div>
                                        <span className={`search-result-due ${party.due > 0 ? 'has-due' : 'settled'}`}>
                                            {party.due > 0 ? `₹${formatCurrency(party.due)}` : '✓ Settled'}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog
                isOpen={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                variant={confirmDialog.variant}
                confirmText="Delete"
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
            />

            {/* Selected Party Profile */}
            {selectedParty ? (
                <div className="party-profile">
                    {/* Header */}
                    <div className="party-profile-header">
                        <div className="party-profile-left">
                            <div className="party-profile-avatar">{getInitials(selectedParty.name)}</div>
                            <div className="party-profile-meta">
                                <h2>{selectedParty.name}</h2>
                                <div className="party-contact">
                                    <span><HiOutlinePhone /> {selectedParty.phone}</span>
                                    {selectedParty.email && <span><HiOutlineMail /> {selectedParty.email}</span>}
                                    {selectedParty.city && <span>📍 {selectedParty.city}</span>}
                                </div>
                            </div>
                        </div>
                        <button className="btn-close-profile" onClick={closePartyProfile} title="Close">
                            <HiOutlineX />
                        </button>
                    </div>

                    {/* Due Summary */}
                    <div className="due-summary-grid">
                        <div className="due-card orders">
                            <div className="due-card-label">Orders</div>
                            <div className="due-card-value">{selectedParty.orderCount}</div>
                        </div>
                        <div className="due-card billed">
                            <div className="due-card-label">Total Billed</div>
                            <div className="due-card-value">₹{formatCurrency(selectedParty.totalBilled)}</div>
                        </div>
                        <div className="due-card paid">
                            <div className="due-card-label">Total Paid</div>
                            <div className="due-card-value">₹{formatCurrency(selectedParty.totalPaid)}</div>
                        </div>
                        <div className="due-card due">
                            <div className="due-card-label">Due Amount</div>
                            <div className="due-card-value">₹{formatCurrency(selectedParty.due)}</div>
                        </div>
                    </div>

                    {/* Record Payment Form */}
                    {selectedParty.due > 0 && (
                        <div className="record-payment-section">
                            <div className="record-payment-title">
                                <HiOutlinePlus /> Record Payment
                            </div>
                            <form onSubmit={handleRecordPayment}>
                                <div className="payment-form-row three-col">
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>Amount *</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            placeholder={`Max ₹${formatCurrency(selectedParty.due)}`}
                                            value={paymentForm.amount}
                                            onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                            min="1"
                                            required
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>Reference / Txn ID</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Optional"
                                            value={paymentForm.reference}
                                            onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>Notes</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Optional"
                                            value={paymentForm.notes}
                                            onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                    <div className="payment-method-pills">
                                        {METHODS.map(m => (
                                            <button
                                                key={m.value}
                                                type="button"
                                                className={`method-pill ${paymentForm.paymentMethod === m.value ? 'active' : ''}`}
                                                onClick={() => setPaymentForm({ ...paymentForm, paymentMethod: m.value })}
                                            >
                                                {m.emoji} {m.label}
                                            </button>
                                        ))}
                                    </div>
                                    <button type="submit" className="btn-record" disabled={submitting || !paymentForm.amount}>
                                        {submitting ? 'Recording...' : (
                                            <>
                                                <HiOutlineCheckCircle />
                                                Record ₹{paymentForm.amount ? formatCurrency(parseFloat(paymentForm.amount)) : '0'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Transaction History */}
                    <div className="txn-history-section">
                        <div className="txn-history-header">
                            <h3>
                                <HiOutlineClock /> Payment History
                                {partyPayments.length > 0 && (
                                    <span className="txn-count-badge">{partyPayments.length}</span>
                                )}
                            </h3>
                        </div>

                        {paymentsLoading ? (
                            <div className="txn-empty">Loading transactions...</div>
                        ) : partyPayments.length === 0 ? (
                            <div className="txn-empty">
                                <div className="txn-empty-icon">📋</div>
                                No payment transactions recorded yet.
                                {selectedParty.due > 0 && <><br/>Record the first payment above.</>}
                            </div>
                        ) : (
                            <div className="txn-list">
                                {partyPayments.map(payment => (
                                    <div key={payment._id} className="txn-item">
                                        <div className="txn-item-left">
                                            <div className="txn-type-icon payment">
                                                {getMethodEmoji(payment.paymentMethod)}
                                            </div>
                                            <div className="txn-info">
                                                <span className="txn-method">{getMethodLabel(payment.paymentMethod)}</span>
                                                <span className="txn-meta">
                                                    {new Date(payment.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    <span className="dot"></span>
                                                    {new Date(payment.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                    {payment.reference && (
                                                        <>
                                                            <span className="dot"></span>
                                                            Ref: {payment.reference}
                                                        </>
                                                    )}
                                                    {payment.notes && (
                                                        <>
                                                            <span className="dot"></span>
                                                            {payment.notes}
                                                        </>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="txn-item-right">
                                            <span className="txn-amount">+₹{formatCurrency(payment.amount)}</span>
                                            <button
                                                className="btn-txn-delete"
                                                title="Delete payment"
                                                onClick={() => handleDeletePayment(payment)}
                                            >
                                                <HiOutlineTrash />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Landing / Empty State */
                <div className="ledger-landing">
                    <div className="ledger-landing-icon">
                        <HiOutlineBookOpen />
                    </div>
                    <h3>Search a Party to Begin</h3>
                    <p>Type a party name or phone number above to view their outstanding balance, record payments, and see transaction history.</p>
                </div>
            )}
        </div>
    );
};

export default BalanceLedgerPage;
