import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineArrowLeft, HiOutlineUser, HiOutlinePhone, HiOutlineMail, HiOutlineClipboardList, HiOutlineCurrencyRupee, HiOutlineChatAlt2, HiOutlineSparkles, HiOutlineClock, HiOutlineArrowRight, HiOutlinePhotograph, HiOutlineTrash, HiOutlineShare, HiOutlineEye, HiOutlineBan, HiOutlinePrinter, HiOutlineCash, HiOutlinePencil } from 'react-icons/hi';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import API from '../../api/axios';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import './NewOrderPage.css';
import './NewOrderPage_Professional.css';
import '../studio/OrdersPage.css';
import TaxInvoiceReceipt from '../../components/common/TaxInvoiceReceipt';
import { getFileUrl } from '../../utils/urlHelper';
import { createPortal } from 'react-dom';

// SLA Progress Bar (same as OrdersPage)
const SlaProgressBar = ({ createdAt, estimatedCompletion, status }) => {
    if (!estimatedCompletion || status === 'delivered') return null;

    const start = new Date(createdAt).getTime();
    const end = new Date(estimatedCompletion).getTime();
    const now = Date.now();

    const totalDuration = end - start;
    const elapsed = now - start;
    let progress = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));

    let colorClass = 'progress-normal';
    if (progress > 85) colorClass = 'progress-critical';
    else if (progress > 60) colorClass = 'progress-warning';

    const isOverdue = now > end;

    return (
        <div className="sla-progress-wrapper" title={isOverdue ? "SLA Overdue!" : "Time elapsed"}>
            <div className="sla-progress-bar">
                <div className={`sla-progress-fill ${colorClass}`} style={{ width: `${isOverdue ? 100 : progress}%` }}></div>
            </div>
            <small className={`sla-text ${isOverdue ? 'text-critical' : ''}`}>
                {isOverdue ? 'Overdue!' : `${Math.round(progress)}% elapsed`}
            </small>
        </div>
    );
};

const ALL_STATUSES = ['reception', 'designing', 'printing', 'binding', 'quality_check', 'delivered'];
const STATUS_LABELS = {
    reception: 'Reception', designing: 'Designing', printing: 'Printing',
    binding: 'Binding', quality_check: 'Quality Check', delivered: 'Delivered',
    cancelled: 'Cancelled'
};

const NewOrderPage = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightIndex, setHighlightIndex] = useState(0);
    const [nameSuggestions, setNameSuggestions] = useState([]);
    const [showNameDropdown, setShowNameDropdown] = useState(false);
    const [allCustomersCache, setAllCustomersCache] = useState({ parties: [], customers: [] });
    const nameDropdownRef = useRef(null);
    const [error, setError] = useState('');
    const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });
    const [recentOrders, setRecentOrders] = useState([]);
    const [advancingStatus, setAdvancingStatus] = useState(null);
    const [showStatusModal, setShowStatusModal] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(null);
    const [showBillingModal, setShowBillingModal] = useState(null);
    const [showCancelModal, setShowCancelModal] = useState(null);
    const [showOrderPreview, setShowOrderPreview] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [billingData, setBillingData] = useState({ totalAmount: 0, advancePayment: 0, discount: 0, tax: 0 });
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef2 = useRef(null);
    const listRef = useRef(null);
    const searchInputRef = useRef(null);
    const dropdownWrapperRef = useRef(null);
    const [printInvoiceData, setPrintInvoiceData] = useState(null);

    // Filtered categories (memoized)
    const filteredCategories = useMemo(() => {
        const term = searchTerm.toLowerCase();
        if (!term) return categories;
        return categories.filter(cat =>
            String(cat.description || cat.Description || '').toLowerCase().includes(term) ||
            String(cat.name || '').toLowerCase().includes(term)
        );
    }, [categories, searchTerm]);

    // Reset highlight when search or dropdown changes
    useEffect(() => {
        setHighlightIndex(0);
    }, [searchTerm, showCategoryDropdown]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                showCategoryDropdown &&
                dropdownWrapperRef.current &&
                !dropdownWrapperRef.current.contains(e.target)
            ) {
                setShowCategoryDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showCategoryDropdown]);

    // Toggle a category selection
    const toggleCategory = useCallback((catId) => {
        setFormData(prev => {
            const isRemoving = prev.categoryIds.includes(catId);
            return {
                ...prev,
                categoryIds: isRemoving
                    ? prev.categoryIds.filter(id => id !== catId)
                    : [...prev.categoryIds, catId]
            };
        });
        // Set default qty to 1 when adding
        setCategoryQuantities(prev => {
            const updated = { ...prev };
            if (!updated[catId]) updated[catId] = 1;
            return updated;
        });
        setSearchTerm('');
        searchInputRef.current?.focus();
    }, []);

    // Update quantity for a category
    const updateCategoryQty = useCallback((catId, qty) => {
        const val = Math.max(1, parseInt(qty) || 1);
        setCategoryQuantities(prev => ({ ...prev, [catId]: val }));
    }, []);

    // Update custom price for a category
    const updateCategoryPrice = useCallback((catId, price) => {
        const val = price === '' ? '' : Math.max(0, parseFloat(price) || 0);
        setCategoryPrices(prev => ({ ...prev, [catId]: val }));
    }, []);

    // Keyboard handler
    const handleSearchKeyDown = (e) => {
        if (!showCategoryDropdown) return;
        const len = filteredCategories.length;
        if (len === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIndex(prev => {
                const next = prev < len - 1 ? prev + 1 : 0;
                scrollToItem(next);
                return next;
            });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIndex(prev => {
                const next = prev > 0 ? prev - 1 : len - 1;
                scrollToItem(next);
                return next;
            });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredCategories[highlightIndex]) {
                toggleCategory(filteredCategories[highlightIndex]._id);
            }
        } else if (e.key === 'Escape') {
            setShowCategoryDropdown(false);
        }
    };

    const scrollToItem = (index) => {
        if (listRef.current) {
            const items = listRef.current.querySelectorAll('.dropdown-item');
            if (items[index]) {
                items[index].scrollIntoView({ block: 'nearest' });
            }
        }
    };

    const [formData, setFormData] = useState({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        coupleName: '',
        categoryIds: [],
        notes: '',
        totalAmount: 0,
        advancePayment: 0,
        paymentMode: '',
        discount: 0,
        discountType: 'flat',
        isParty: false
    });
    const [categoryQuantities, setCategoryQuantities] = useState({});
    const [categoryPrices, setCategoryPrices] = useState({});
    const [customerBalance, setCustomerBalance] = useState(0);
    const [mergePreviousBalance, setMergePreviousBalance] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [catRes, ordRes] = await Promise.all([
                    API.get(`/categories?t=${Date.now()}`),
                    API.get('/orders?limit=10')
                ]);
                
                let orderCategories = [];
                if (catRes.data?.categories) {
                    setCategories(catRes.data.categories);
                    orderCategories = catRes.data.categories;
                }
                if (ordRes.data?.orders) {
                    setRecentOrders(ordRes.data.orders);
                }

                // If editing, fetch the order
                if (id) {
                    const res = await API.get(`/orders/${id}`);
                    if (res.data?.order) {
                        const o = res.data.order;
                        const customer = o.customer || o.party;
                        
                        setFormData({
                            customerName: customer?.name || '',
                            customerEmail: customer?.email || '',
                            customerPhone: customer?.phone || '',
                            coupleName: o.coupleName || '',
                            categoryIds: o.categories?.map(c => c._id || c) || [],
                            notes: o.notes || '',
                            totalAmount: o.totalAmount || 0,
                            advancePayment: o.advancePayment || 0,
                            paymentMode: o.paymentMode || '',
                            discount: o.discount || 0,
                            discountType: o.discountType || 'flat',
                            isParty: o.isParty || false,
                            orderId: o.orderId // Keep for display
                        });

                        if (o.categoryQuantities) {
                            // Mongoose Map becomes a plain object in JSON
                            setCategoryQuantities(o.categoryQuantities);
                        }
                        if (o.categoryPrices) {
                            setCategoryPrices(o.categoryPrices);
                        }

                        if (o.party) {
                             setSelectedCustomer({ ...o.party, isParty: true });
                        } else if (o.customer) {
                             setSelectedCustomer({ ...o.customer, isParty: false });
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to fetch data', err);
                showError('Failed to load order data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    // Fetch all customers & parties once (for name search)
    useEffect(() => {
        const fetchAllContacts = async () => {
            try {
                const [partyRes, custRes] = await Promise.all([
                    API.get('/parties'),
                    API.get('/customer/list')
                ]);
                setAllCustomersCache({
                    parties: (partyRes.data?.parties || []).map(p => ({ ...p, isParty: true })),
                    customers: (custRes.data?.customers || []).map(c => ({ ...c, isParty: false }))
                });
            } catch (err) {
                console.error('Failed to fetch contacts', err);
            }
        };
        fetchAllContacts();
    }, []);

    // Close name dropdown on click outside
    useEffect(() => {
        const handleClickOutsideName = (e) => {
            if (nameDropdownRef.current && !nameDropdownRef.current.contains(e.target)) {
                setShowNameDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutsideName);
        return () => document.removeEventListener('mousedown', handleClickOutsideName);
    }, []);

    // Name-based search: filter cached contacts when customerName changes
    useEffect(() => {
        const name = formData.customerName?.trim().toLowerCase();
        if (!name || name.length < 2 || selectedCustomer) {
            setNameSuggestions([]);
            return;
        }
        const allContacts = [...allCustomersCache.parties, ...allCustomersCache.customers];
        const matches = allContacts.filter(c =>
            String(c.name || '').toLowerCase().includes(name) ||
            String(c.phone || '').includes(name)
        ).slice(0, 8);
        setNameSuggestions(matches);
        if (matches.length > 0) setShowNameDropdown(true);
    }, [formData.customerName, allCustomersCache, selectedCustomer]);

    // Select a customer from name suggestions
    const skipPhoneLookupRef = useRef(false);
    const selectCustomerFromSuggestion = (contact) => {
        skipPhoneLookupRef.current = true; // Prevent phone useEffect from overwriting
        setSelectedCustomer(contact);
        setFormData(prev => ({
            ...prev,
            customerName: contact.name || '',
            customerPhone: contact.phone || '',
            customerEmail: contact.email || '',
            isParty: contact.isParty || false
        }));
        setShowNameDropdown(false);
        setNameSuggestions([]);
        if (contact.phone) {
            fetchRecentOrders(contact.phone);
            fetchCustomerDues(contact.phone);
        }
    };

    // Helper: normalize phone — strip +91 / 91 prefix to get 10-digit number
    const normalizePhone = (phone) => {
        if (!phone) return '';
        let p = phone.replace(/[\s\-()]/g, ''); // strip spaces/dashes
        if (p.startsWith('+91')) p = p.slice(3);
        else if (p.startsWith('91') && p.length > 10) p = p.slice(2);
        return p;
    };

    // Customer Lookup Logic (by phone) — runs on phone change or when cache loads
    useEffect(() => {
        // Skip only if selection was just made via name dropdown (one-time skip)
        if (skipPhoneLookupRef.current) {
            skipPhoneLookupRef.current = false;
            return;
        }
        
        const lookupCustomer = async () => {
            const rawPhone = formData.customerPhone || '';
            const normalized = normalizePhone(rawPhone);
            
            if (normalized.length === 10) {
                // Fetch this customer's orders — try both raw and normalized
                fetchRecentOrders(rawPhone);
                
                try {
                    const allContacts = [...allCustomersCache.parties, ...allCustomersCache.customers];
                    
                    // Only do auto-fill if cache has loaded
                    if (allContacts.length === 0) return;
                    
                    // Match: compare normalized phone with normalized stored phone
                    const matchPhone = (storedPhone) => {
                        return normalizePhone(storedPhone) === normalized;
                    };
                    
                    // Try party first
                    let p = allContacts.find(c => c.isParty && matchPhone(c.phone));
                    if (p) {
                        setSelectedCustomer(p);
                        setFormData(prev => ({
                            ...prev,
                            customerName: p.name,
                            customerEmail: p.email || '',
                            isParty: true
                        }));
                        fetchCustomerDues(p.phone);
                        return;
                    }

                    // Try customer
                    let c = allContacts.find(ct => !ct.isParty && matchPhone(ct.phone));
                    if (c) {
                        setSelectedCustomer(c);
                        setFormData(prev => ({
                            ...prev,
                            customerName: c.name,
                            customerEmail: c.email || '',
                            isParty: false
                        }));
                        fetchCustomerDues(c.phone);
                    } else {
                        setSelectedCustomer(null);
                        setCustomerBalance(0);
                        setFormData(prev => ({ ...prev, isParty: false }));
                    }
                } catch (err) {
                    console.error('Lookup failed', err);
                }
            } else {
                // When phone is cleared or shorter, show overall recent orders again
                if (normalized.length < 10) {
                    fetchRecentOrders();
                }
                setSelectedCustomer(null);
                setCustomerBalance(0);
            }
        };
        lookupCustomer();
    }, [formData.customerPhone, allCustomersCache]);

    const fetchCustomerDues = async (phone) => {
        if (!phone) return;
        const normalized = normalizePhone(phone);
        try {
            // Use the dedicated API that accounts for manual payments from Balance Ledger
            const res = await API.get(`/payments/customer-due/${encodeURIComponent(phone)}`);
            if (res.data?.success) {
                setCustomerBalance(res.data.due || 0);
            } else {
                setCustomerBalance(0);
            }
        } catch (err) {
            console.error('Failed to fetch dues', err);
            // Fallback: try with normalized phone
            if (normalized !== phone) {
                try {
                    const res2 = await API.get(`/payments/customer-due/${encodeURIComponent(normalized)}`);
                    if (res2.data?.success) {
                        setCustomerBalance(res2.data.due || 0);
                    }
                } catch (e) {
                    console.error('Fallback due fetch failed', e);
                }
            }
        }
    };

    // Price Calculation Helper
    const getPriceForCategory = useCallback((cat) => {
        if (!cat) return 0;
        if (formData.isParty) {
            const customPriceObj = selectedCustomer?.partyPrices?.find(p => (p.category?._id || p.category) === cat._id);
            const customPrice = customPriceObj ? customPriceObj.price : 0;
            if (customPrice > 0) return customPrice;
            if (cat.partyPrice > 0) return cat.partyPrice;
            return (cat.basePrice || 0);
        } else {
            return (cat.basePrice || 0);
        }
    }, [formData.isParty, selectedCustomer]);

    // Auto-calculate total amount (price × quantity)
    useEffect(() => {
        let total = 0;
        formData.categoryIds.forEach(id => {
            const cat = categories.find(c => c._id === id);
            if (cat) {
                const qty = categoryQuantities[id] || 1;
                const customPrice = categoryPrices[id];
                const unitPrice = (customPrice !== undefined && customPrice !== '') ? parseFloat(customPrice) : getPriceForCategory(cat);
                total += unitPrice * qty;
            }
        });
        setFormData(prev => ({ ...prev, totalAmount: total }));
    }, [formData.categoryIds, getPriceForCategory, categories, categoryQuantities, categoryPrices]);

    // Refetch recent orders
    const fetchRecentOrders = async (phone = null) => {
        try {
            if (phone) {
                // Try with original phone
                const res1 = await API.get(`/orders?phone=${encodeURIComponent(phone)}&limit=10`);
                if (res1.data?.orders && res1.data.orders.length > 0) {
                    setRecentOrders(res1.data.orders);
                    return;
                }
                // Retry with normalized phone (strip +91)
                const norm = normalizePhone(phone);
                if (norm !== phone) {
                    const res2 = await API.get(`/orders?phone=${norm}&limit=10`);
                    if (res2.data?.orders && res2.data.orders.length > 0) {
                        setRecentOrders(res2.data.orders);
                        return;
                    }
                }
                // No orders found for this phone — show general recent
                const res3 = await API.get('/orders?limit=10');
                setRecentOrders(res3.data?.orders || []);
            } else {
                const ordRes = await API.get('/orders?limit=10');
                if (ordRes.data?.orders) setRecentOrders(ordRes.data.orders);
                else setRecentOrders([]);
            }
        } catch (err) {
            console.error('Failed to fetch recent orders', err);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (submitting) return;
        if (formData.categoryIds.length === 0) {
            setError('Please select at least one service.');
            return;
        }
        setError('');
        setShowOrderPreview(true);
    };

    const handleConfirmSubmit = async () => {
        setSubmitting(true);
        setError('');
        try {
            const payload = {
                ...formData,
                customerPhone: formData.customerPhone || '0000000000',
                categoryQuantities: categoryQuantities,
                categoryPrices: categoryPrices,
                totalAmount: parseFloat(formData.totalAmount) || 0,
                advancePayment: parseFloat(formData.advancePayment) || 0,
                paymentMode: formData.paymentMode || '',
                discount: parseFloat(formData.discount) || 0,
                discountType: formData.discountType || 'flat',
            };
            
            let response;
            if (id) {
                response = await API.put(`/orders/${id}`, payload);
                showSuccess(`Order ${formData.orderId || ''} updated successfully!`);
            } else {
                response = await API.post('/orders', payload);
                showSuccess('New Order created & Ledger updated!');
            }
            
            const createdOrder = response.data.order;
            
            setShowOrderPreview(false);
            
            // Auto-print option or just show success? Let's offer a print button in the success state or just redirect.
            // Actually, let's set printInvoiceData if it's a new order
            if (!id && createdOrder) {
                setPrintInvoiceData({
                    order: createdOrder,
                    billing: {
                        totalAmount: createdOrder.totalAmount,
                        advancePayment: createdOrder.advancePayment,
                        discount: createdOrder.discount,
                        tax: createdOrder.tax || 0,
                        taxType: createdOrder.taxType || 'exclusive',
                        notes: createdOrder.notes
                    }
                });
            }

            // Reset form
            setFormData({
                customerName: '', customerEmail: '', customerPhone: '', 
                coupleName: '', categoryIds: [], notes: '', 
                totalAmount: 0, advancePayment: 0, paymentMode: '', discount: 0,
                discountType: 'flat', isParty: false
            });
            setCategoryQuantities({});
            setSelectedCustomer(null);
            fetchRecentOrders(payload.customerPhone);
            setTimeout(() => {
                if (!printInvoiceData) navigate('/orders');
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || `Failed to ${id ? 'update' : 'create'} order`);
            setSubmitting(false);
        }
    };

    // Print Effect
    useEffect(() => {
        if (printInvoiceData) {
            const timer = setTimeout(() => {
                window.print();
                setPrintInvoiceData(null);
                navigate('/orders');
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [printInvoiceData, navigate]);

    // ===== ACTION HANDLERS (same as OrdersPage) =====
    const getBalanceDue = (o) => {
        const total = o.totalAmount || 0;
        const discount = o.discount || 0;
        const tax = o.tax || 0;
        const taxType = o.taxType || 'exclusive';
        const advance = o.advancePayment || 0;
        const taxableAmount = Math.max(0, total - discount);
        let finalTotal = taxableAmount;
        if (taxType !== 'inclusive') finalTotal += (taxableAmount * tax / 100);
        return Math.max(0, Math.round(finalTotal - advance));
    };

    const handleAdvanceStatus = async (order, targetStatus) => {
        if (advancingStatus) return;
        setAdvancingStatus(order._id);
        setError('');
        try {
            const body = targetStatus ? { targetStatus } : {};
            await API.put(`/orders/${order._id}/status`, body);
            const newStatus = targetStatus || ALL_STATUSES[ALL_STATUSES.indexOf(order.status) + 1];
            showSuccess(`Order ${order.orderId} moved to ${STATUS_LABELS[newStatus]}`);
            setShowStatusModal(null);
            fetchRecentOrders();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update status');
            setTimeout(() => setError(''), 5000);
        } finally {
            setAdvancingStatus(null);
        }
    };

    const handleDirectAdvance = async (order) => {
        setConfirmDialog({
            open: true, title: 'Complete Step?', message: 'Mark this step as complete? Order will move to the next status.', variant: 'warning',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                setAdvancingStatus(order._id);
                try {
                    await API.put(`/orders/${order._id}/status`, { note: 'Step completed' });
                    fetchRecentOrders();
                    showSuccess('Step completed');
                } catch (err) {
                    showError(err.response?.data?.message || 'Failed to update status');
                } finally {
                    setAdvancingStatus(null);
                }
            }
        });
    };

    const handleShareWhatsApp = (order) => {
        const trackingLink = `${window.location.origin}/track`;
        const albumLink = `${window.location.origin}/album/${order.orderId}`;
        const message = `Hello ${order.customer?.name || ''},\n\nYour Order ID is: *${order.orderId}*\n\nYou can track your order status here: ${trackingLink}\nView your album here: ${albumLink}`;
        let phone = order.customer?.phone ? order.customer.phone.replace(/\D/g, '') : '';
        if (phone.length === 10) phone = `91${phone}`;
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleDeleteOrder = async (orderId, orderNum) => {
        setConfirmDialog({
            open: true, title: 'Delete Order?', message: `Are you sure you want to delete order ${orderNum}? This cannot be undone.`, variant: 'danger',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                try {
                    await API.delete(`/orders/${orderId}`);
                    showSuccess(`Order ${orderNum} deleted`);
                    fetchRecentOrders();
                } catch (err) {
                    showError(err.response?.data?.message || 'Failed to delete order');
                }
            }
        });
    };

    const handleCancelOrder = async () => {
        if (submitting || !showCancelModal) return;
        setSubmitting(true);
        setError('');
        try {
            await API.put(`/orders/${showCancelModal._id}/cancel`, { reason: cancelReason });
            showSuccess(`Order ${showCancelModal.orderId} has been cancelled`);
            setShowCancelModal(null);
            setCancelReason('');
            fetchRecentOrders();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to cancel order');
            setTimeout(() => setError(''), 5000);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUploadImages = async (orderId) => {
        if (uploading || selectedFiles.length === 0) return;
        setUploading(true);
        setError('');
        try {
            const formData = new FormData();
            selectedFiles.forEach(f => formData.append('images', f));
            await API.post(`/images/upload/${orderId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showSuccess(`${selectedFiles.length} image(s) uploaded successfully!`);
            setSelectedFiles([]);
            setShowUploadModal(null);
            if (fileInputRef2.current) fileInputRef2.current.value = '';
            fetchRecentOrders();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to upload images');
            setTimeout(() => setError(''), 5000);
        } finally {
            setUploading(false);
        }
    };

    const handleUpdateBilling = async (e) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setError('');
        try {
            await API.put(`/orders/${showBillingModal._id}/billing`, billingData);
            showSuccess(`Billing info updated for Order ${showBillingModal.orderId}`);
            setShowBillingModal(null);
            fetchRecentOrders();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update billing');
            setTimeout(() => setError(''), 5000);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <LoadingSpinner text="Preparing new order..." />;

    return (
        <div className="new-order-page">
            <header className="new-order-header">
                <button className="back-btn" onClick={() => navigate('/orders')}>
                    <HiOutlineArrowLeft /> Back to Orders
                </button>
                <div className="header-title">
                    <HiOutlineSparkles className="sparkle-icon" />
                    <h1>{id ? `Edit Order #${formData.orderId || ''}` : 'Create New Order'}</h1>
                </div>
            </header>

            <motion.div 
                className="prof-order-container"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="prof-section-header">
                    <h3><HiOutlineUser /> PATIENT REGISTRATION & BOOKING</h3>
                    <div className="header-action" onClick={() => {
                        setFormData({
                            customerName: '', customerEmail: '', customerPhone: '', 
                            coupleName: '', categoryIds: [], notes: '', 
                            totalAmount: '', advancePayment: 0, paymentMode: '', discount: 0, discountType: 'flat', isParty: false
                        });
                        setCategoryQuantities({});
                        setSelectedCustomer(null);
                    }}>
                        + ADD NEW CUSTOMER (CLEAR)
                    </div>
                </div>

                <div className="prof-form-body">
                    <div className="prof-grid-4">
                        <div className="prof-form-group">
                            <label className="prof-label">MOBILE NUMBER*</label>
                            <input 
                                type="tel" 
                                className="prof-input"
                                required 
                                pattern="[0-9]{10}"
                                placeholder="Enter 10 digit number"
                                value={formData.customerPhone}
                                onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                            />
                        </div>

                        <div className="prof-form-group" style={{ position: 'relative' }} ref={nameDropdownRef}>
                            <label className="prof-label">CUSTOMER NAME*</label>
                            <input 
                                type="text" 
                                className="prof-input"
                                required
                                placeholder="Search or enter name"
                                value={formData.customerName}
                                onChange={(e) => {
                                    setSelectedCustomer(null);
                                    setFormData({...formData, customerName: e.target.value});
                                }}
                                onFocus={() => { if (nameSuggestions.length > 0) setShowNameDropdown(true); }}
                                autoComplete="off"
                            />
                            {showNameDropdown && nameSuggestions.length > 0 && (
                                <div className="name-suggestions-dropdown">
                                    {nameSuggestions.map((s, idx) => (
                                        <div 
                                            key={s._id || idx}
                                            className="name-suggestion-item"
                                            onClick={() => selectCustomerFromSuggestion(s)}
                                        >
                                            <div className="suggestion-name">
                                                <span>{s.name}</span>
                                                <span className={`suggestion-tag ${s.isParty ? 'tag-party' : 'tag-customer'}`}>
                                                    {s.isParty ? 'Party' : 'Customer'}
                                                </span>
                                            </div>
                                            <div className="suggestion-phone">{s.phone || 'No phone'}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="prof-form-group">
                            <label className="prof-label">COUPLE NAME</label>
                            <input 
                                type="text" 
                                className="prof-input"
                                placeholder="Optional"
                                value={formData.coupleName}
                                onChange={(e) => setFormData({...formData, coupleName: e.target.value})}
                            />
                        </div>

                        <div className="prof-form-group">
                            <label className="prof-label">EMAIL ADDRESS</label>
                            <input 
                                type="email" 
                                className="prof-input"
                                placeholder="Optional"
                                value={formData.customerEmail}
                                onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                            />
                        </div>

                        {selectedCustomer && (
                             <div className="prof-form-group" style={{ gridColumn: 'span 4' }}>
                                <div className="customer-badge" style={{ margin: 0 }}>
                                    Found {selectedCustomer.isParty ? 'Party' : 'Customer'}: <strong>{selectedCustomer.name}</strong>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            <motion.div 
                className="prof-order-container"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
            >
                <div className="prof-section-header" style={{ borderLeftColor: 'var(--accent)' }}>
                    <h3><HiOutlineClipboardList /> SERVICE SELECTION & BILLING</h3>
                    <div className="prof-test-count">
                        Selected: {formData.categoryIds.length}
                    </div>
                </div>

                <div className="prof-form-body">                    {/* Inline Service Selection Table */}
                    <div className="prof-service-table">
                        <div className="prof-table-header">
                            <span>#</span>
                            <span>Type / Category</span>
                            <span>Service Name</span>
                            <span style={{ textAlign: 'center' }}>Qty</span>
                            <span style={{ textAlign: 'center' }}>Unit Price</span>
                            <span style={{ textAlign: 'center' }}>Final Price</span>
                            <span style={{ textAlign: 'right' }}>Total</span>
                        </div>
                        
                        {/* Existing Selected Services */}
                        {formData.categoryIds.map((id, index) => {
                            const cat = categories.find(c => c._id === id);
                            if (!cat) return null;
                            const defaultPrice = getPriceForCategory(cat);
                            const unitPrice = categoryPrices[id] !== undefined ? categoryPrices[id] : defaultPrice;
                            const qty = categoryQuantities[id] || 1;
                            const lineTotal = (unitPrice || 0) * qty;
                            return (
                                <div key={id} className="prof-table-row">
                                    <span>{index + 1}</span>
                                    <span className="col-group" style={{ fontSize: '0.8rem' }}>{cat.description || cat.Description || 'General'}</span>
                                    <span style={{ fontWeight: 600 }}>{cat.name}</span>
                                    <div className="qty-line-controls" style={{ transform: 'scale(0.85)', originX: '50%', margin: '0 auto' }}>
                                        <button type="button" className="qty-btn" onClick={() => updateCategoryQty(id, qty - 1)} disabled={qty <= 1}>−</button>
                                        <input 
                                            type="number" 
                                            className="qty-input" 
                                            value={qty} 
                                            onChange={(e) => updateCategoryQty(id, e.target.value)} 
                                        />
                                        <button type="button" className="qty-btn" onClick={() => updateCategoryQty(id, qty + 1)}>+</button>
                                    </div>
                                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                        ₹{defaultPrice}
                                    </div>
                                    <div className="price-input-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span style={{ marginRight: '4px', color: 'var(--text-secondary)' }}>₹</span>
                                        <input 
                                            type="number"
                                            className="prof-input"
                                            style={{ padding: '4px 8px', width: '80px', height: '30px', textAlign: 'center' }}
                                            value={categoryPrices[id] !== undefined ? categoryPrices[id] : unitPrice}
                                            onChange={(e) => updateCategoryPrice(id, e.target.value)}
                                            placeholder={defaultPrice}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                                        <strong style={{ color: 'var(--primary-light)' }}>₹{lineTotal}</strong>
                                        <button 
                                            type="button" 
                                            className="btn-remove-service"
                                            onClick={() => toggleCategory(id)}
                                            title={`Remove ${cat.name}`}
                                        >
                                            <HiOutlineTrash />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* New Item Search Row */}
                        <div className="prof-table-row new-item-row">
                            <span>{formData.categoryIds.length + 1}</span>
                            <div className="prof-search-wrapper" style={{ gridColumn: 'span 1' }} ref={dropdownWrapperRef}>
                                <input 
                                    ref={searchInputRef}
                                    type="text"
                                    className="prof-inline-search"
                                    placeholder="Search service..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setShowCategoryDropdown(true);
                                    }}
                                    onFocus={() => setShowCategoryDropdown(true)}
                                    onKeyDown={handleSearchKeyDown}
                                />
                                
                                <AnimatePresence>
                                    {showCategoryDropdown && (
                                        <motion.div 
                                            className="services-dropdown"
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            transition={{ duration: 0.15 }}
                                        >
                                            <div className="services-dropdown-header">
                                                <span>Type</span>
                                                <span>Service Name</span>
                                                <span style={{ textAlign: 'right' }}>Price</span>
                                            </div>
                                            <div className="services-list-container" ref={listRef}>
                                                {filteredCategories.length > 0 ? filteredCategories.map((cat, idx) => (
                                                    <div 
                                                        key={cat._id} 
                                                        className={`dropdown-item row-layout ${idx === highlightIndex ? 'highlighted' : ''} ${formData.categoryIds.includes(cat._id) ? 'selected' : ''}`}
                                                        onClick={() => toggleCategory(cat._id)}
                                                        onMouseEnter={() => setHighlightIndex(idx)}
                                                    >
                                                        <div className="item-row">
                                                            <span className="col-group" style={{ fontSize: '0.8rem' }}>{cat.description || cat.Description || 'General'}</span>
                                                            <span className="col-name" style={{ fontSize: '0.85rem' }}>{String(cat.name)}</span>
                                                            <span className="col-price">₹{getPriceForCategory(cat)}</span>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="no-data-msg">No matching services found.</div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <span style={{ color: 'var(--text-muted)', textAlign: 'center' }}>—</span>
                            <span style={{ color: 'var(--text-muted)', textAlign: 'center' }}>—</span>
                            <span style={{ color: 'var(--text-muted)', textAlign: 'center' }}>—</span>
                            <strong style={{ textAlign: 'right', color: 'var(--text-muted)' }}>₹0</strong>
                        </div>
                    </div>

                    {/* Billing & Settlement Section */}
                    <div className="prof-section-header" style={{ borderLeftColor: 'var(--status-critical)', marginTop: '30px' }}>
                        <h3><HiOutlineCash /> BILLING & SETTLEMENT LEDGER</h3>
                    </div>

                    <div className="prof-grid-4" style={{ marginTop: '16px' }}>
                        <div className="prof-form-group">
                            <label className="prof-label">ORDER SUBTOTAL (₹)</label>
                            <input 
                                type="text" 
                                className="prof-input"
                                style={{ background: 'rgba(0,0,0,0.02)', fontWeight: 600 }}
                                disabled
                                value={formData.totalAmount}
                            />
                        </div>

                        <div className="prof-form-group">
                            <label className="prof-label">DISCOUNT</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                                <div style={{ 
                                    display: 'flex', 
                                    borderRadius: '8px 0 0 8px', 
                                    overflow: 'hidden',
                                    border: '1px solid var(--border)',
                                    borderRight: 'none',
                                    height: '42px',
                                    flexShrink: 0
                                }}>
                                    <button 
                                        type="button"
                                        onClick={() => setFormData({...formData, discountType: 'flat'})}
                                        style={{
                                            padding: '0 10px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontWeight: 700,
                                            fontSize: '0.9rem',
                                            background: formData.discountType === 'flat' ? 'var(--primary)' : 'var(--bg-card)',
                                            color: formData.discountType === 'flat' ? '#fff' : 'var(--text-secondary)',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        ₹
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setFormData({...formData, discountType: 'percent'})}
                                        style={{
                                            padding: '0 10px',
                                            border: 'none',
                                            borderLeft: '1px solid var(--border)',
                                            cursor: 'pointer',
                                            fontWeight: 700,
                                            fontSize: '0.9rem',
                                            background: formData.discountType === 'percent' ? 'var(--primary)' : 'var(--bg-card)',
                                            color: formData.discountType === 'percent' ? '#fff' : 'var(--text-secondary)',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        %
                                    </button>
                                </div>
                                <input 
                                    type="number" 
                                    className="prof-input"
                                    style={{ 
                                        color: 'var(--status-critical)', 
                                        fontWeight: 700, 
                                        borderRadius: '0 8px 8px 0',
                                        borderLeft: 'none',
                                        flex: 1,
                                        minWidth: 0
                                    }}
                                    value={formData.discount || 0}
                                    onChange={(e) => setFormData({...formData, discount: parseFloat(e.target.value) || 0})}
                                />
                            </div>
                            {formData.discountType === 'percent' && formData.discount > 0 && (
                                <small style={{ color: 'var(--status-critical)', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                                    = ₹{Math.round((formData.totalAmount * formData.discount) / 100)} off
                                </small>
                            )}
                        </div>

                        <div className="prof-form-group">
                            <label className="prof-label">ADVANCE RECEIVED (₹)</label>
                            <input 
                                type="number" 
                                className="prof-input"
                                style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.1rem' }}
                                value={formData.advancePayment || 0}
                                onChange={(e) => setFormData({...formData, advancePayment: parseFloat(e.target.value) || 0})}
                            />
                            {(formData.advancePayment > 0) && (
                                <select
                                    className="prof-input"
                                    style={{ 
                                        marginTop: '6px', 
                                        fontSize: '0.8rem', 
                                        padding: '6px 10px',
                                        height: '34px',
                                        background: formData.paymentMode ? 'rgba(46, 213, 115, 0.08)' : 'rgba(255,193,7,0.08)',
                                        color: formData.paymentMode ? 'var(--accent)' : 'var(--text-secondary)',
                                        fontWeight: 600,
                                        border: `1px solid ${formData.paymentMode ? 'var(--accent)' : 'var(--border)'}`,
                                    }}
                                    value={formData.paymentMode}
                                    onChange={(e) => setFormData({...formData, paymentMode: e.target.value})}
                                >
                                    <option value="">-- Payment Mode --</option>
                                    <option value="cash">💵 Cash</option>
                                    <option value="upi">📱 UPI (GPay/PhonePe)</option>
                                    <option value="online">🌐 Online Transfer</option>
                                    <option value="card">💳 Card</option>
                                    <option value="cheque">📝 Cheque</option>
                                    <option value="neft">🏦 NEFT/RTGS</option>
                                </select>
                            )}
                        </div>

                        <div className="prof-form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <label className="prof-label" style={{ color: 'var(--status-critical)', marginBottom: 0 }}>PREVIOUS OUTSTANDING (₹)</label>
                                <label style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', opacity: 0.8 }}>
                                    <input 
                                        type="checkbox" 
                                        checked={mergePreviousBalance}
                                        onChange={(e) => setMergePreviousBalance(e.target.checked)}
                                    />
                                    Include in Net?
                                </label>
                            </div>
                            <div className="prof-input" style={{ background: 'rgba(255, 71, 87, 0.08)', color: 'var(--status-critical)', fontWeight: 800 }}>
                                ₹{customerBalance}
                            </div>
                        </div>
                    </div>

                    <div className="prof-grid-4" style={{ marginTop: '10px' }}>
                         <div className="prof-form-group" style={{ gridColumn: 'span 3' }}>
                            <label className="prof-label" style={{ opacity: 0.5 }}>LEDGER REMARKS</label>
                            <input 
                                type="text"
                                className="prof-input"
                                style={{ background: 'transparent', borderBottom: '1px dashed var(--border)' }}
                                placeholder="Add payment reference or remarks..."
                                value={formData.notes}
                                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                            />
                        </div>

                        <div className="prof-form-group">
                            <label className="prof-label">FINAL NET BALANCE (₹)</label>
                            <div className="prof-input" style={(() => {
                                const discountAmt = formData.discountType === 'percent' 
                                    ? Math.round((formData.totalAmount * (formData.discount || 0)) / 100)
                                    : (formData.discount || 0);
                                const netBal = formData.totalAmount - discountAmt - (formData.advancePayment || 0) + (mergePreviousBalance ? customerBalance : 0);
                                return {
                                    background: netBal > 0 ? 'rgba(255, 71, 87, 0.1)' : 'rgba(46, 213, 115, 0.1)',
                                    color: netBal > 0 ? 'var(--status-critical)' : 'var(--accent)',
                                    fontWeight: 900,
                                    fontSize: '1.3rem',
                                    display: 'flex',
                                    alignItems: 'center'
                                };
                            })()}>
                                ₹{(() => {
                                    const discountAmt = formData.discountType === 'percent' 
                                        ? Math.round((formData.totalAmount * (formData.discount || 0)) / 100)
                                        : (formData.discount || 0);
                                    return Math.max(0, formData.totalAmount - discountAmt - (formData.advancePayment || 0) + (mergePreviousBalance ? customerBalance : 0));
                                })()}
                            </div>
                        </div>
                    </div>

                    <div className="prof-form-actions" style={{ marginTop: '30px' }}>
                        {error && <div className="form-error" style={{ marginRight: 'auto' }}>{error}</div>}
                        <button type="button" className="btn-prof btn-prof-outline" onClick={() => navigate('/orders')}>CANCEL</button>
                        <button type="button" className="btn-prof btn-prof-primary" style={{ padding: '14px 40px' }} onClick={handleSubmit} disabled={submitting}>
                            {id ? 'UPDATE ORDER' : 'CREATE ORDER & UPDATE LEDGER'} <HiOutlineArrowRight />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Order Preview Modal */}
            {showOrderPreview && (
                <div className="modal-overlay" onClick={() => setShowOrderPreview(false)}>
                    <div className="modal slide-up" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Review Order Details</h2>
                            <button className="modal-close" onClick={() => setShowOrderPreview(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="preview-section" style={{ background: 'var(--bg-glass)', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '15px' }}>Customer Information</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>Name</div>
                                        <div style={{ fontWeight: '500' }}>{formData.customerName || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>Phone</div>
                                        <div style={{ fontWeight: '500' }}>{formData.customerPhone || 'N/A'}</div>
                                    </div>
                                    {formData.advancePayment > 0 && (
                                        <div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>Advance Payment</div>
                                            <div style={{ fontWeight: '700', color: 'var(--accent)' }}>
                                                ₹{formData.advancePayment} {formData.paymentMode ? `(${formData.paymentMode.toUpperCase()})` : ''}
                                            </div>
                                        </div>
                                    )}
                                    {formData.coupleName && (
                                        <div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>Couple Name</div>
                                            <div style={{ fontWeight: '500' }}>{formData.coupleName}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="preview-section" style={{ background: 'var(--bg-glass)', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '15px' }}>Selected Services</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {formData.categoryIds.map(id => {
                                        const cat = categories.find(c => c._id === id);
                                        if (!cat) return null;
                                        const qty = categoryQuantities[id] || 1;
                                        const customPrice = categoryPrices[id];
                                        const unitPrice = (customPrice !== undefined && customPrice !== '') ? parseFloat(customPrice) : getPriceForCategory(cat);
                                        const lineTotal = unitPrice * qty;
                                        return (
                                            <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span>{cat.name} {qty > 1 ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>×{qty}</span> : ''}</span>
                                                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                        Rate: ₹{unitPrice}
                                                    </small>
                                                </div>
                                                <strong style={{ alignSelf: 'center' }}>₹{lineTotal}</strong>
                                            </div>
                                        );
                                    })}
                                    <hr style={{ borderColor: 'var(--border-color)', margin: '15px 0' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem' }}>
                                        <strong>Total Amount:</strong>
                                        <strong style={{ color: 'var(--primary)' }}>₹{formData.totalAmount}</strong>
                                    </div>
                                </div>
                            </div>

                            {formData.notes && (
                                <div className="preview-section" style={{ background: 'var(--bg-glass)', padding: '20px', borderRadius: '12px' }}>
                                    <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '10px' }}>Notes</h3>
                                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{formData.notes}</p>
                                </div>
                            )}

                            {error && <div className="alert alert-error" style={{ marginTop: '15px' }}>{error}</div>}
                        </div>
                        <div className="modal-footer" style={{ padding: '20px' }}>
                            <button className="btn btn-outlined" onClick={() => setShowOrderPreview(false)} disabled={submitting}>
                                Edit Order
                            </button>
                            <button className="btn btn-primary btn-glow" onClick={handleConfirmSubmit} disabled={submitting}>
                                {submitting ? (id ? 'Updating...' : 'Creating...') : (id ? 'Confirm & Update' : 'Confirm & Create')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recent Orders Table — Same as Orders Page */}
            {recentOrders.length > 0 && (
                <motion.div 
                    className="prof-order-container recent-orders-section"
                    style={{ marginTop: '40px' }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                >
                    <div className="prof-section-header" style={{ borderLeftColor: 'var(--accent-dark)' }}>
                        <h3><HiOutlineClock /> {formData.customerPhone?.length === 10 && formData.customerName ? `ORDER HISTORY FOR ${formData.customerName.toUpperCase()}` : 'RECENT ORDERS HISTORY'}</h3>
                    </div>
                    
                    <div className="prof-form-body" style={{ padding: '0' }}>
                        <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Order ID</th>
                                        <th>Customer</th>
                                        <th>Category</th>
                                        <th>Status</th>
                                        <th>Images</th>
                                        <th>Est. Completion</th>
                                        <th>Due Amount</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentOrders.map((order) => (
                                        <tr key={order._id}>
                                            <td>
                                                <strong style={{ color: 'var(--primary)' }}>
                                                    {order.orderId}
                                                </strong>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{order.customer?.name || order.party?.name || '-'}</div>
                                                <small style={{ color: 'var(--text-muted)' }}>{order.customer?.phone}</small>
                                            </td>
                                            <td>{order.categories?.map(c => c.name).join(', ')}</td>
                                            <td><StatusBadge status={order.status} /></td>
                                            <td>
                                                <span className="image-count">{order.images?.length || 0} 📷</span>
                                            </td>
                                            <td style={{ minWidth: '150px' }}>
                                                {order.status === 'cancelled' ? (
                                                    <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                        🚫 Cancelled
                                                    </span>
                                                ) : order.status === 'delivered' ? (
                                                    order.wasOverdue ? (
                                                        <span style={{ color: 'var(--status-critical)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                            ⚠️ Delivered Late
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--status-delivered)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                            ✅ On Time
                                                        </span>
                                                    )
                                                ) : order.estimatedCompletion ? (
                                                    <SlaProgressBar createdAt={order.createdAt} estimatedCompletion={order.estimatedCompletion} status={order.status} />
                                                ) : '—'}
                                            </td>
                                            <td style={{ fontWeight: 'bold', color: getBalanceDue(order) > 0 ? 'var(--status-critical)' : 'var(--status-delivered)' }}>
                                                <div>₹{getBalanceDue(order)}</div>
                                                {order.advancePayment > 0 && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                        <small style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.7rem' }}>
                                                            Adv: ₹{order.advancePayment}
                                                        </small>
                                                        {order.paymentMode && (
                                                            <span style={{
                                                                fontSize: '0.65rem',
                                                                padding: '1px 6px',
                                                                borderRadius: '4px',
                                                                background: order.paymentMode === 'cash' ? 'rgba(46, 213, 115, 0.15)' 
                                                                    : order.paymentMode === 'upi' ? 'rgba(108, 92, 231, 0.15)' 
                                                                    : 'rgba(0, 168, 255, 0.15)',
                                                                color: order.paymentMode === 'cash' ? '#2ed573' 
                                                                    : order.paymentMode === 'upi' ? '#6c5ce7' 
                                                                    : '#0097e6',
                                                                fontWeight: 700,
                                                                textTransform: 'uppercase'
                                                            }}>
                                                                {order.paymentMode}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                                                    {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                                        <button className="btn btn-sm btn-success"
                                                            disabled={advancingStatus === order._id}
                                                            onClick={() => {
                                                                if (user?.role === 'staff' && !user?.assignedSteps?.includes('reception')) {
                                                                    handleDirectAdvance(order);
                                                                } else {
                                                                    setShowStatusModal(order);
                                                                }
                                                            }}
                                                            title="Change Status">
                                                            <HiOutlineArrowRight />
                                                        </button>
                                                    )}
                                                    <button className="btn btn-sm btn-secondary"
                                                        onClick={() => {
                                                            setBillingData({
                                                                totalAmount: order.totalAmount || 0,
                                                                advancePayment: order.advancePayment || 0,
                                                                discount: order.discount || 0,
                                                                tax: order.tax || 0,
                                                                taxType: order.taxType || 'exclusive'
                                                            });
                                                            setShowBillingModal(order);
                                                        }}
                                                        title="Billing & Invoice">
                                                        <HiOutlineCurrencyRupee />
                                                    </button>
                                                    <button className="btn btn-sm btn-secondary"
                                                        onClick={() => setShowUploadModal(order)}
                                                        title="Upload Images">
                                                        <HiOutlinePhotograph />
                                                    </button>
                                                    {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                                        <button className="btn btn-sm btn-info"
                                                            onClick={() => navigate(`/orders/edit/${order._id}`)}
                                                            title="Edit Order"
                                                            style={{ background: 'var(--primary)', color: 'white' }}>
                                                            <HiOutlinePencil />
                                                        </button>
                                                    )}
                                                    <button className="btn btn-sm btn-secondary"
                                                        onClick={() => setShowDetailModal(order)}
                                                        title="View Details">
                                                        <HiOutlineEye />
                                                    </button>
                                                    <button className="btn btn-sm btn-secondary"
                                                        onClick={() => handleShareWhatsApp(order)}
                                                        title="Share on WhatsApp">
                                                        <HiOutlineShare />
                                                    </button>
                                                    {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                                        <button className="btn btn-sm btn-warning"
                                                            onClick={() => { setShowCancelModal(order); setCancelReason(''); }}
                                                            title="Cancel Order">
                                                            <HiOutlineBan />
                                                        </button>
                                                    )}
                                                    <button className="btn btn-sm btn-danger"
                                                        onClick={() => handleDeleteOrder(order._id, order.orderId)}
                                                        title="Delete Order">
                                                        <HiOutlineTrash />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* ===== STATUS CHANGE MODAL ===== */}
            {showStatusModal && (
                <div className="modal-overlay" onClick={() => setShowStatusModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Change Status — {showStatusModal.orderId}</h2>
                            <button className="modal-close" onClick={() => setShowStatusModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="status-options">
                                {ALL_STATUSES.map((s, i) => {
                                    const currentIdx = ALL_STATUSES.indexOf(showStatusModal.status);
                                    const isNext = i === currentIdx + 1;
                                    const isCurrent = s === showStatusModal.status;
                                    const isPast = i < currentIdx;
                                    return (
                                        <button
                                            key={s}
                                            className={`status-option ${isNext ? 'next' : ''} ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`}
                                            onClick={() => handleAdvanceStatus(showStatusModal, s)}
                                            disabled={advancingStatus || isCurrent || isPast}
                                        >
                                            <span className="status-option__num">{i + 1}</span>
                                            {STATUS_LABELS[s]}
                                            {isNext && <span className="status-option__tag">NEXT →</span>}
                                            {isCurrent && <span className="status-option__tag current-tag">CURRENT</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== DETAIL MODAL ===== */}
            {showDetailModal && (
                <div className="modal-overlay" onClick={() => setShowDetailModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Order Details — {showDetailModal.orderId}</h2>
                            <button className="modal-close" onClick={() => setShowDetailModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-grid">
                                <div>Customer</div><div><strong>{showDetailModal.customer?.name || '-'}</strong></div>
                                <div>Phone</div><div><strong>{showDetailModal.customer?.phone || '-'}</strong></div>
                                <div>Email</div><div><strong>{showDetailModal.customer?.email || '-'}</strong></div>
                                <div>Couple Name</div><div><strong>{showDetailModal.coupleName || '-'}</strong></div>
                                <div>Category</div><div><strong>{showDetailModal.categories?.map(c => c.name).join(', ')}</strong></div>
                                <div>Status</div><div><StatusBadge status={showDetailModal.status} /></div>
                                <div>Total Amount</div><div><strong>₹{showDetailModal.totalAmount || 0}</strong></div>
                                <div>Advance Paid</div><div>
                                    <strong>₹{showDetailModal.advancePayment || 0}</strong>
                                    {showDetailModal.paymentMode && (
                                        <span style={{ 
                                            marginLeft: '8px', 
                                            fontSize: '0.75rem', 
                                            padding: '2px 8px', 
                                            borderRadius: '10px',
                                            background: 'rgba(46, 213, 115, 0.1)',
                                            color: 'var(--accent)',
                                            fontWeight: 700,
                                            textTransform: 'uppercase'
                                        }}>
                                            {showDetailModal.paymentMode}
                                        </span>
                                    )}
                                </div>
                                <div>Balance Due</div><div><strong style={{ color: 'var(--status-critical)' }}>₹{getBalanceDue(showDetailModal)}</strong></div>
                                <div>Notes</div><div><strong>{showDetailModal.notes || '-'}</strong></div>
                                <div>Created</div><div><strong>{new Date(showDetailModal.createdAt).toLocaleString('en-IN')}</strong></div>
                            </div>
                            {showDetailModal.images?.length > 0 && (
                                <div style={{ marginTop: '16px' }}>
                                    <h4 style={{ marginBottom: '8px' }}>Images ({showDetailModal.images.length})</h4>
                                    <div className="image-gallery">
                                        {showDetailModal.images.map((img, i) => (
                                            <div key={i} className="gallery-thumb">
                                                <img src={`https://photostudio.nakshatratechnologies.in${img.url || img}`} alt="" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {showDetailModal.statusHistory?.length > 0 && (
                                <div style={{ marginTop: '16px' }}>
                                    <h4 style={{ marginBottom: '8px' }}>Status History</h4>
                                    <ul className="timestamp-list">
                                        {showDetailModal.statusHistory.map((h, i) => (
                                            <li key={i} className="timestamp-item">
                                                <span className="timestamp-dot"></span>
                                                <div className="timestamp-content">
                                                    <span className="timestamp-status">{STATUS_LABELS[h.status] || h.status}</span>
                                                    <span className="timestamp-date">{new Date(h.changedAt).toLocaleString('en-IN')}</span>
                                                    {h.notes && <span className="timestamp-by">{h.notes}</span>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== UPLOAD MODAL ===== */}
            {showUploadModal && (
                <div className="modal-overlay" onClick={() => { setShowUploadModal(null); setSelectedFiles([]); }}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Upload Images — {showUploadModal.orderId}</h2>
                            <button className="modal-close" onClick={() => { setShowUploadModal(null); setSelectedFiles([]); }}>×</button>
                        </div>
                        <div className="modal-body">
                            {showUploadModal.images?.length > 0 && (
                                <div className="image-gallery">
                                    {showUploadModal.images.map((img, i) => (
                                        <div key={i} className="gallery-thumb">
                                            <img src={`https://photostudio.nakshatratechnologies.in${img.url || img}`} alt="" />
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="upload-area">
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    ref={fileInputRef2}
                                    onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                                />
                            </div>
                            {selectedFiles.length > 0 && <p style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>{selectedFiles.length} file(s) selected</p>}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => { setShowUploadModal(null); setSelectedFiles([]); }}>Cancel</button>
                            <button className="btn btn-primary" disabled={uploading || selectedFiles.length === 0} onClick={() => handleUploadImages(showUploadModal._id)}>
                                {uploading ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== BILLING MODAL ===== */}
            {showBillingModal && (
                <div className="modal-overlay" onClick={() => setShowBillingModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Billing — {showBillingModal.orderId}</h2>
                            <button className="modal-close" onClick={() => setShowBillingModal(null)}>×</button>
                        </div>
                        <form onSubmit={handleUpdateBilling}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Total Amount (₹)</label>
                                    <input className="form-control" type="number" value={billingData.totalAmount} onChange={(e) => setBillingData({ ...billingData, totalAmount: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label>Advance Payment (₹)</label>
                                    <input className="form-control" type="number" value={billingData.advancePayment} onChange={(e) => setBillingData({ ...billingData, advancePayment: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label>Discount (₹)</label>
                                    <input className="form-control" type="number" value={billingData.discount} onChange={(e) => setBillingData({ ...billingData, discount: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label>Tax (%)</label>
                                    <input className="form-control" type="number" value={billingData.tax} onChange={(e) => setBillingData({ ...billingData, tax: Number(e.target.value) })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowBillingModal(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Billing'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== CANCEL MODAL ===== */}
            {showCancelModal && (
                <div className="modal-overlay" onClick={() => setShowCancelModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Cancel Order — {showCancelModal.orderId}</h2>
                            <button className="modal-close" onClick={() => setShowCancelModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Reason for cancellation</label>
                                <textarea className="form-control" rows="3" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Optional cancellation reason..."></textarea>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCancelModal(null)}>Go Back</button>
                            <button className="btn btn-danger" onClick={handleCancelOrder} disabled={submitting}>{submitting ? 'Cancelling...' : 'Confirm Cancel'}</button>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmDialog
                isOpen={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                variant={confirmDialog.variant}
                confirmText={confirmDialog.variant === 'danger' ? 'Delete' : 'Confirm'}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
            />

            {/* Print Portal */}
            {printInvoiceData && createPortal(
                <TaxInvoiceReceipt
                    order={printInvoiceData.order}
                    billingData={printInvoiceData.billing}
                    getFileUrl={getFileUrl}
                    currentUser={user}
                    customerBalance={customerBalance}
                />,
                document.body
            )}
        </div>
    );
};

export default NewOrderPage;
