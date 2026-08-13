import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import logoImg from '../assets/images/logo.png';
import bgImg from '../assets/images/background.jpg';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error('Please enter username and password');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/lgu/login', { username: username.trim(), password });
      if (data.error) {
        toast.error('Invalid username or password');
        return;
      }
      login(data.token, data.user);
      if (data.user.role === 'LGU_Admin') {
        toast.success('Welcome to LGU Admin Dashboard');
        navigate('/lgu');
      } else if (data.user.role === 'Barangay_Official') {
        toast.success('Welcome to Barangay Dashboard');
        navigate('/brgy');
      } else if (data.user.role === 'Rescuer') {
        toast.error('Rescuer accounts must use the mobile app.');
        useAuthStore.getState().logout();
        return;
      } else {
        toast.error('Unauthorized role. Access denied.');
        useAuthStore.getState().logout();
        return;
      }
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error('Invalid username or password');
      } else if (err.code === 'ERR_NETWORK' || err.message?.includes('Network')) {
        toast.error('Cannot connect to server. Please try again.');
      } else {
        toast.error('Login failed. Please try again.');
      }
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-[900px] bg-white rounded-3xl shadow-xl overflow-hidden flex min-h-[520px]">
        {/* Left — background image with BRFE highlight */}
        <div className="hidden md:block w-[45%] relative">
          <img src={bgImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-[#133458]/60" />
          <div className="relative z-10 flex flex-col items-center justify-center h-full p-8 text-center">
            <h2 className="text-white text-4xl font-extrabold tracking-widest">BRFE</h2>
            <p className="text-white/70 text-sm mt-2">Bago Residents Flood Evacuees</p>
          </div>
        </div>

        {/* Right — login form with logo */}
        <div className="flex-1 flex flex-col justify-center px-8 md:px-12 py-10">
          {/* Big logo */}
          <div className="flex justify-center mb-6">
            <img src={logoImg} alt="BRFE" className="w-28 h-28 object-contain" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 text-center">Welcome back</h1>
          <p className="text-slate-500 text-sm mt-1 text-center">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full h-11 border border-slate-300 rounded-lg px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#133458]/20 focus:border-[#133458] transition placeholder:text-slate-400"
                placeholder="Enter your username"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full h-11 border border-slate-300 rounded-lg px-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#133458]/20 focus:border-[#133458] transition placeholder:text-slate-400"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#133458] hover:bg-[#0f2a47] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
