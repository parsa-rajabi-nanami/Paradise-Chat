import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { MessageSquare, Mail, Lock, User, Loader2 } from 'lucide-react';


const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(50, 'Username must be less than 50 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/[A-Z]/, 'Password must contain at least one uppercase letter').regex(/[a-z]/, 'Password must contain at least one lowercase letter').regex(/[0-9]/, 'Password must contain at least one number'),
  password_confirm: z.string(),
  passphrase: z.string().min(16, 'Passphrase must be at least 16 characters').max(100, 'Passphrase must be less than 100 characters'),
  display_name: z.string().optional()
}).refine(data => data.password === data.password_confirm, {
  message: 'Passwords do not match',
  path: ['password_confirm']
});


export function RegisterPage() {
  const navigate = useNavigate();
  const registerUser = useAuthStore(state => state.register);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: {
      errors
    }
  } = useForm({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = async data => {
    setIsLoading(true);
    try {
      await registerUser(data);
      toast.success('Account created successfully!');
      navigate('/chat');
    } catch (error) {
      const errorData = error.response?.data;
      if (errorData) {
        Object.keys(errorData).forEach(key => {
          const messages = errorData[key];
          if (Array.isArray(messages)) {
            messages.forEach(msg => toast.error(msg));
          } else {
            toast.error(messages);
          }
        });
      } else {
        toast.error('Registration failed. Please try again.');
      }
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
          <h1 className="text-3xl font-bold text-[var(--color-text)]">Create Account</h1>
          <p className="mt-2 text-[var(--color-text-muted)]">Join ChatApp and start chatting</p>
        </div>

        {/* Form */}
        <div className="card p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                <input {...register('email')} type="email" id="email" className="input pl-10" placeholder="you@example.com" />
              </div>
              {errors.email && <p className="mt-1 text-sm text-[var(--color-danger)]">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                <input {...register('username')} type="text" id="username" className="input pl-10" placeholder="johndoe" />
              </div>
              {errors.username && <p className="mt-1 text-sm text-[var(--color-danger)]">{errors.username.message}</p>}
            </div>

            <div>
              <label htmlFor="display_name" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Display Name <span className="text-[var(--color-text-muted)]">(optional)</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                <input {...register('display_name')} type="text" id="display_name" className="input pl-10" placeholder="John Doe" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                <input {...register('password')} type="password" id="password" className="input pl-10" placeholder="Create a strong password" />
              </div>
              {errors.password && <p className="mt-1 text-sm text-[var(--color-danger)]">{errors.password.message}</p>}
            </div>

            <div>
              <label htmlFor="password_confirm" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                <input {...register('password_confirm')} type="password" id="password_confirm" className="input pl-10" placeholder="Confirm your password" />
              </div>
              {errors.password_confirm && <p className="mt-1 text-sm text-[var(--color-danger)]">{errors.password_confirm.message}</p>}
            </div>

            <div>
              <label htmlFor="passphrase" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Security Passphrase
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                <input {...register('passphrase')} type="text" id="passphrase" className="input pl-10" placeholder="Enter secret passphrase" />
              </div>
              {errors.passphrase && <p className="mt-1 text-sm text-[var(--color-danger)]">
                {errors.passphrase.message}
              </p>}
            </div>

            <button type="submit" disabled={isLoading} className="btn btn-submit">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[var(--color-text-muted)]">
              Already have an account?{' '}
              <Link to="/login" className="font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}