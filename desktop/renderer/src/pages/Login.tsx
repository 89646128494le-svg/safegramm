import React, { useEffect, useState } from 'react';
import { apiClient, ApiError } from '../core/api/client';
import './Login.css';

interface LoginProps {
  onLogin: (token: string) => void;
}

type LoginStep = 'credentials' | 'email' | 'cloudCode';

interface LoginResponse {
  token?: string;
  error?: string;
  message?: string;
  hasCloudCode?: boolean;
  code?: string;
}

const EMAIL_RESEND_COOLDOWN_SEC = 60;

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [cloudCode, setCloudCode] = useState('');
  const [step, setStep] = useState<LoginStep>('credentials');
  const [hasCloudCode, setHasCloudCode] = useState(false);
  const [devEmailCode, setDevEmailCode] = useState('');
  const [info, setInfo] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const resetStepState = () => {
    setStep('credentials');
    setEmailCode('');
    setCloudCode('');
    setHasCloudCode(false);
    setDevEmailCode('');
    setInfo('');
    setError(null);
    setResendCooldown(0);
  };

  const sendEmailCode = async (): Promise<boolean> => {
    if (!username.trim()) {
      setError('Enter username first.');
      return false;
    }
    if (resendCooldown > 0) {
      return true;
    }

    setIsSendingCode(true);
    setError(null);
    try {
      const response = await apiClient.post<{ hasCloudCode?: boolean; code?: string }>(
        '/api/auth/send-login-email-code',
        { username: username.trim() }
      );
      setStep('email');
      setHasCloudCode(Boolean(response?.hasCloudCode));
      setDevEmailCode(response?.code || '');
      setInfo('Enter the code sent to your email.');
      setResendCooldown(EMAIL_RESEND_COOLDOWN_SEC);
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to send email code.');
      } else {
        setError('Connection error while requesting email code.');
      }
      return false;
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Enter username and password.');
      return;
    }
    if (step === 'email' && emailCode.trim().length < 4) {
      setError('Enter the email verification code.');
      return;
    }
    if (step === 'cloudCode' && cloudCode.trim().length < 4) {
      setError('Enter the cloud code.');
      return;
    }

    setIsLoading(true);

    try {
      const payload: Record<string, string> = {
        username: username.trim(),
        password,
      };
      if (step !== 'credentials' && emailCode.trim()) {
        payload.emailCode = emailCode.trim();
      }
      if (step === 'cloudCode' && cloudCode.trim()) {
        payload.cloudCode = cloudCode.trim();
      }

      const response = await apiClient.post<LoginResponse>('/api/auth/login', payload);

      if (response?.token) {
        onLogin(response.token);
        return;
      }

      if (response?.error === 'email_verification_required') {
        setHasCloudCode(Boolean(response?.hasCloudCode));
        setInfo(response?.message || 'Email verification is required.');
        setStep('email');
        await sendEmailCode();
        return;
      }

      if (response?.error === 'cloud_code_required') {
        setStep('cloudCode');
        setInfo(response?.message || 'Enter your cloud code to continue.');
        return;
      }

      if (response?.error === 'invalid_email_code') {
        setStep('email');
        setError('Invalid email verification code.');
        return;
      }

      if (response?.error === 'invalid_cloud_code') {
        setStep('cloudCode');
        setError('Invalid cloud code.');
        return;
      }

      setError('Login failed. Check your credentials.');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'invalid_email_code') {
          setStep('email');
          setError('Invalid email verification code.');
        } else if (err.code === 'invalid_cloud_code') {
          setStep('cloudCode');
          setError('Invalid cloud code.');
        } else if (err.code === 'bad_creds') {
          setError('Invalid username or password.');
        } else {
          setError(err.message || 'Connection error.');
        }
      } else {
        setError('Connection error.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>SafeGram</h1>
          <p>
            {step === 'credentials'
              ? 'Desktop login'
              : step === 'email'
              ? 'Step 2 of 3: email verification'
              : 'Step 3 of 3: cloud code'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}
          {info && <div className="info-message">{info}</div>}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (step !== 'credentials') resetStepState();
              }}
              placeholder="Enter username"
              required
              autoFocus
              disabled={isLoading || isSendingCode}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (step !== 'credentials') resetStepState();
              }}
              placeholder="Enter password"
              required
              disabled={isLoading || isSendingCode}
            />
          </div>

          {step === 'email' && (
            <>
              <div className="form-group">
                <label htmlFor="email-code">Email Code</label>
                <input
                  id="email-code"
                  type="text"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  autoFocus
                  disabled={isLoading}
                />
              </div>
              {devEmailCode ? <div className="info-inline">Dev code: {devEmailCode}</div> : null}
              <div className="actions-row">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={sendEmailCode}
                  disabled={isLoading || isSendingCode || resendCooldown > 0}
                >
                  {isSendingCode
                    ? 'Sending...'
                    : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Send Code'}
                </button>
                {hasCloudCode ? <span className="flow-note">Cloud code will be requested next.</span> : null}
              </div>
            </>
          )}

          {step === 'cloudCode' && (
            <div className="form-group">
              <label htmlFor="cloud-code">Cloud Code</label>
              <input
                id="cloud-code"
                type="password"
                value={cloudCode}
                onChange={(e) => setCloudCode(e.target.value)}
                placeholder="PIN / cloud code"
                autoFocus
                disabled={isLoading}
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || isSendingCode || !username || !password}
          >
            {isLoading
              ? 'Working...'
              : step === 'credentials'
              ? 'Login'
              : step === 'email'
              ? 'Verify Code'
              : 'Unlock'}
          </button>

          {step !== 'credentials' && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={resetStepState}
              disabled={isLoading || isSendingCode}
            >
              Start Over
            </button>
          )}
        </form>

        <div className="login-footer">
          <p>Registration remains available from the mobile/web client.</p>
        </div>
      </div>
    </div>
  );
}
