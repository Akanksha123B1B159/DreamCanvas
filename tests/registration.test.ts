jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/app/_libs/registrationRateLimit', () => ({
  consumeRegistrationAttempt: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import { consumeRegistrationAttempt } from '@/app/_libs/registrationRateLimit';
import { POST } from '@/app/api/auth/register/route';
import {
  getPasswordStrength,
  isValidRegistrationEmail,
  isValidRegistrationName,
  isValidRegistrationPassword,
} from '@/app/_libs/registrationPolicy';

const mockCreateClient = jest.mocked(createClient);
const mockConsumeRegistrationAttempt = jest.mocked(consumeRegistrationAttempt);
const mockSignUp = jest.fn();
const mockUpsert = jest.fn();
const mockFrom = jest.fn(() => ({ upsert: mockUpsert }));

function registrationRequest(body: unknown) {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Real-IP': '192.0.2.10',
    },
    body: JSON.stringify(body),
  });
}

describe('registration security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    mockConsumeRegistrationAttempt.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 900,
    });
    mockCreateClient.mockReturnValue({
      auth: { signUp: mockSignUp },
      from: mockFrom,
    } as unknown as ReturnType<typeof createClient>);
    mockUpsert.mockResolvedValue({ error: null });
  });

  it('classifies password strength and enforces the 12-character minimum', () => {
    expect(isValidRegistrationPassword('short-pass')).toBe(false);
    expect(isValidRegistrationPassword('exactly12!!')).toBe(false);
    expect(isValidRegistrationPassword('exactly12!!!')).toBe(true);
    expect(getPasswordStrength('short-pass')).toBe('weak');
    expect(getPasswordStrength('validpass123')).toBe('medium');
    expect(getPasswordStrength('StrongPassword123!')).toBe('strong');
  });

  it('validates email and full-name fields', () => {
    expect(isValidRegistrationEmail('person@example.com')).toBe(true);
    expect(isValidRegistrationEmail('not-an-email')).toBe(false);
    expect(isValidRegistrationName('Ada Lovelace')).toBe(true);
    expect(isValidRegistrationName('   ')).toBe(false);
    expect(isValidRegistrationName('Name\u0000')).toBe(false);
  });

  it('rejects short passwords at the API before calling Supabase', async () => {
    const response = await POST(registrationRequest({
      email: 'person@example.com',
      password: 'short-pass',
      full_name: 'Ada Lovelace',
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Password must be at least 12 characters long.',
    });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('normalizes the email but forwards a valid password unchanged', async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'new-user', identities: [{ id: 'identity' }] },
      },
      error: null,
    });

    const response = await POST(registrationRequest({
      email: '  Person@Example.com ',
      password: 'StrongPassword123! ',
      full_name: '  Ada Lovelace  ',
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'person@example.com',
      password: 'StrongPassword123! ',
      options: { data: { full_name: 'Ada Lovelace' } },
    });
  });

  it('returns the same success response for duplicate accounts without exposing identity data', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'existing-user', identities: [] } },
      error: null,
    });

    const response = await POST(registrationRequest({
      email: 'person@example.com',
      password: 'StrongPassword123!',
      full_name: 'Ada Lovelace',
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns the same generic success response for duplicate-account errors', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: { message: 'User already registered' },
    });

    const response = await POST(registrationRequest({
      email: 'person@example.com',
      password: 'StrongPassword123!',
      full_name: 'Ada Lovelace',
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  it('does not expose other Supabase error details', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: { message: 'Internal provider detail' },
    });

    const response = await POST(registrationRequest({
      email: 'person@example.com',
      password: 'StrongPassword123!',
      full_name: 'Ada Lovelace',
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'We could not complete registration with those details. Please try again or log in.',
    });
  });

  it('rate-limits attempts before processing registration', async () => {
    mockConsumeRegistrationAttempt.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 120,
    });

    const response = await POST(registrationRequest({
      email: 'person@example.com',
      password: 'StrongPassword123!',
      full_name: 'Ada Lovelace',
    }));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('120');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('fails closed if the shared rate limiter is unavailable', async () => {
    mockConsumeRegistrationAttempt.mockRejectedValue(new Error('Redis unavailable'));

    const response = await POST(registrationRequest({
      email: 'person@example.com',
      password: 'StrongPassword123!',
      full_name: 'Ada Lovelace',
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Registration is temporarily unavailable. Please try again later.',
    });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
