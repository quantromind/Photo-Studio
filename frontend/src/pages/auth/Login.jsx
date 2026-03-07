import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Auth.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const user = await login(email, password);
            if (user.role === 'superadmin') {
                navigate('/admin/dashboard');
            } else if (user.role === 'studioadmin') {
                navigate('/dashboard');
            } else {
                navigate('/customer/orders');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
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
                    <h1>Welcome Back</h1>
                    <p>Sign in to your PhotoStudio account</p>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input
                            id="email"
                            type="email"
                            className="form-control"
                            placeholder="admin@photostudio.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            className="form-control"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg auth-btn" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="auth-card__footer">
                    <p>Don't have an account? <Link to="/register">Sign up</Link></p>
                    <p className="auth-card__track">
                        <Link to="/track">Track your order →</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
