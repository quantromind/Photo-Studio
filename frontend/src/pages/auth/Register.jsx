import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Auth.css';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '', email: '', password: '', phone: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await register({ ...formData, role: 'customer' });
            navigate('/customer/orders');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-bg">
                <div className="auth-bg__circle auth-bg__circle--1"></div>
                <div className="auth-bg__circle auth-bg__circle--2"></div>
                <div className="auth-bg__circle auth-bg__circle--3"></div>
            </div>

            <div className="auth-card glass-card slide-up">
                <div className="auth-card__header">
                    <div className="auth-card__logo">📸</div>
                    <h1>Create Account</h1>
                    <p>Join PhotoStudio to track your orders</p>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="name">Full Name</label>
                        <input id="name" name="name" type="text" className="form-control"
                            placeholder="John Doe" value={formData.name} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="reg-email">Email Address</label>
                        <input id="reg-email" name="email" type="email" className="form-control"
                            placeholder="john@example.com" value={formData.email} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="reg-password">Password</label>
                        <input id="reg-password" name="password" type="password" className="form-control"
                            placeholder="Min 6 characters" value={formData.password} onChange={handleChange} required minLength={6} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="phone">Phone Number</label>
                        <input id="phone" name="phone" type="text" className="form-control"
                            placeholder="+91 9876543210" value={formData.phone} onChange={handleChange} />
                    </div>
                    <button type="submit" className="btn btn-primary btn-lg auth-btn" disabled={loading}>
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                <div className="auth-card__footer">
                    <p>Already have an account? <Link to="/login">Sign in</Link></p>
                </div>
            </div>
        </div>
    );
};

export default Register;
