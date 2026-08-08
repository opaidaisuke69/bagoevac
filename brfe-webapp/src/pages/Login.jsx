import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Waves, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      const { data } = await api.post('/lgu/login', { username: username.trim(), password });
      if (data.error) {
        toast.error(data.message || 'Invalid credentials');
        return;
      }
      login(data.token, data.user);
      toast.success(`Welcome back, ${data.user.username}!`);
      navigate(data.user.role === 'LGU_Admin' ? '/lgu' : '/brgy');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 relative overflow-hidden">
        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        {/* Floating shapes */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-32 right-16 w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="w-16 h-16 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mb-8 ring-1 ring-white/20">
            <Waves size={32} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Bago City Flood<br />Evacuee Management
          </h1>
          <p className="text-lg text-blue-100/80 leading-relaxed max-w-md">
            Real-time monitoring, rescue coordination, and evacuation management system for disaster response.
          </p>
          <div className="flex items-center gap-3 mt-10 pt-10 border-t border-white/10">
            <Shield size={16} className="text-blue-200/60" />
            <p className="text-sm text-blue-200/60">Secured portal for LGU officials and Barangay administrators</p>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/25">
              <Waves size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">BRFE System</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="text-slate-500 mt-1.5">Sign in to your admin portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="input"
                placeholder="Enter your username"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="input pr-11"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3.5 text-[15px] flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-10">
            BRFE — Bago Residents Flood Evacuees System &copy; 2024
          </p>
        </div>
      </div>
    </div>
  );
}
