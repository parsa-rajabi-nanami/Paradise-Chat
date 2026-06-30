import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { MessageSquare, Mail, Lock, Loader2 } from 'lucide-react';


const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/[A-Z]/, 'Password must contain at least one uppercase letter').regex(/[a-z]/, 'Password must contain at least one lowercase letter').regex(/[0-9]/, 'Password must contain at least one number'),
  passphrase: z.string().min(16, 'Passphrase must be at least 16 characters').max(100, 'Passphrase must be less than 100 characters'),
});


export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore(state => state.login);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: {
      errors
    }
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange'
  });

  const onSubmit = async data => {
    setIsLoading(true);
    try {
      await login(data);
      toast.success('Welcome back!');
      navigate('/chat');
    } catch (error) {
      const message = error.response?.data?.detail || error.response?.data?.message || error.message || 'Login failed. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-pattern-1 transition-colors duration-300">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-primary)]">
            <MessageSquare className="w-8 h-8 text-[var(--color-secondary-text)]" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-text)]">Welcome Back</h1>
          <p className="mt-2 text-[var(--color-text-muted)]">Sign in to continue to ChatApp</p>
        </div>

        {/* Form */}
        <div className="card p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-[var(--color-text)]">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                <input {...register('email')} type="email" id="email" className="input pl-10" placeholder="you@example.com" />
              </div>
              {errors.email && <p className="mt-1 text-sm text-[var(--color-danger)]">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                <input {...register('password')} type="password" id="password" className="input pl-10" placeholder="Enter your password" />
              </div>
              {errors.password && <p className="mt-1 text-sm text-[var(--color-danger)]">{errors.password.message}</p>}
            </div>

            <div>
              <label htmlFor="passphrase" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Security Passphrase
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                <input {...register('passphrase')} type="password" id="passphrase" className="input pl-10" placeholder="Enter your security phrase" />
              </div>
              {errors.passphrase && <p className="mt-1 text-sm text-[var(--color-danger)]">{errors.passphrase.message}</p>}
            </div>

            <button type="submit" disabled={isLoading} className="btn btn-submit">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className='text-[var(--color-text-muted)]'>
              Don&apos;t have an account?{' '}
              <Link to="/register" className="font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}