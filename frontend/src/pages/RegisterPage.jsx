import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import {
  MessageSquare,
  Mail,
  Lock,
  User,
  KeyRound,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';

const registerSchema = z
  .object({
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username must be less than 50 characters')
      .regex(
        /^[a-zA-Z0-9_]+$/,
        'Username can only contain letters, numbers, and underscores'
      ),
    display_name: z.string().optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    password_confirm: z.string().min(1, 'Please confirm your password'),
    passphrase: z
      .string()
      .min(16, 'Passphrase must be at least 16 characters')
      .max(100, 'Passphrase must be less than 100 characters')
  })
  .refine((data) => data.password === data.password_confirm, {
    message: 'Passwords do not match',
    path: ['password_confirm']
  });

export function RegisterPage() {
  const navigate = useNavigate();
  const registerUser = useAuthStore((state) => state.register);

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange'
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await registerUser(data);
      toast.success('Account created successfully!');
      navigate('/chat');
    } catch (error) {
      const errorData = error.response?.data;

      if (errorData && typeof errorData === 'object') {
        let unhandledMessage = null;

        Object.keys(errorData).forEach((field) => {
          const messages = Array.isArray(errorData[field])
            ? errorData[field].join(' ')
            : errorData[field];

          if (
            ['email', 'username', 'password', 'password_confirm', 'passphrase', 'display_name'].includes(field)
          ) {
            setError(field, { type: 'server', message: messages });
          } else {
            unhandledMessage = messages;
          }
        });

        if (unhandledMessage) {
          toast.error(unhandledMessage);
        }
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-pattern-1 transition-colors duration-300">
      <div className="w-full max-w-md my-8">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-primary)] shadow-md">
            <MessageSquare className="w-8 h-8 text-[var(--color-secondary-text)]" />
          </div>
          <h1 className="mt-4 text-3xl font-bold text-[var(--color-text)]">Create Account</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Join Paradise Chat and start communicating
          </p>
        </div>

        {/* Card Form */}
        <div className="card p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)] pointer-events-none" />
                <input
                  {...register('email')}
                  type="email"
                  id="email"
                  autoComplete="email"
                  disabled={isLoading}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  className="input pl-10 w-full"
                  placeholder="you@example.com"
                />
              </div>
              {errors.email && (
                <p id="email-error" className="mt-1 text-sm text-[var(--color-danger)]">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)] pointer-events-none" />
                <input
                  {...register('username')}
                  type="text"
                  id="username"
                  autoComplete="username"
                  disabled={isLoading}
                  aria-invalid={!!errors.username}
                  aria-describedby={errors.username ? 'username-error' : undefined}
                  className="input pl-10 w-full"
                  placeholder="johndoe"
                />
              </div>
              {errors.username && (
                <p id="username-error" className="mt-1 text-sm text-[var(--color-danger)]">
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Display Name Field */}
            <div>
              <label htmlFor="display_name" className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">
                Display Name <span className="text-[var(--color-text-muted)] font-normal">(optional)</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)] pointer-events-none" />
                <input
                  {...register('display_name')}
                  type="text"
                  id="display_name"
                  autoComplete="name"
                  disabled={isLoading}
                  className="input pl-10 w-full"
                  placeholder="John Doe"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)] pointer-events-none" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="new-password"
                  disabled={isLoading}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className="input pl-10 pr-10 w-full"
                  placeholder="Create a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1 text-sm text-[var(--color-danger)]">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="password_confirm" className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)] pointer-events-none" />
                <input
                  {...register('password_confirm')}
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="password_confirm"
                  autoComplete="new-password"
                  disabled={isLoading}
                  aria-invalid={!!errors.password_confirm}
                  aria-describedby={errors.password_confirm ? 'password-confirm-error' : undefined}
                  className="input pl-10 pr-10 w-full"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus:outline-none"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password_confirm && (
                <p id="password-confirm-error" className="mt-1 text-sm text-[var(--color-danger)]">
                  {errors.password_confirm.message}
                </p>
              )}
            </div>

            {/* Security Passphrase Field */}
            <div>
              <label htmlFor="passphrase" className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">
                Security Passphrase
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)] pointer-events-none" />
                <input
                  {...register('passphrase')}
                  type={showPassphrase ? 'text' : 'password'}
                  id="passphrase"
                  autoComplete="off"
                  disabled={isLoading}
                  aria-invalid={!!errors.passphrase}
                  aria-describedby={errors.passphrase ? 'passphrase-error' : undefined}
                  className="input pl-10 pr-10 w-full"
                  placeholder="Enter secret passphrase (min 16 chars)"
                />
                <button
                  type="button"
                  onClick={() => setShowPassphrase((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus:outline-none"
                  aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                >
                  {showPassphrase ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.passphrase && (
                <p id="passphrase-error" className="mt-1 text-sm text-[var(--color-danger)]">
                  {errors.passphrase.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn btn-submit flex items-center justify-center space-x-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>

          {/* Sign In Footer */}
          <div className="mt-6 text-center text-sm">
            <p className="text-[var(--color-text-muted)]">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-[var(--color-primary)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-sm"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}