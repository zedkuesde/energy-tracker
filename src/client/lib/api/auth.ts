export type AuthSessionResponse = {
  data: {
    authenticated: boolean;
  };
};

export type AuthErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export class AuthRequestError extends Error {
  readonly kind: 'network' | 'api';
  readonly code?: string;
  readonly status?: number;

  constructor(
    kind: 'network' | 'api',
    options: { code?: string; status?: number; message?: string } = {},
  ) {
    super(options.message ?? kind);
    this.name = 'AuthRequestError';
    this.kind = kind;
    this.code = options.code;
    this.status = options.status;
  }
}

const sameOrigin: RequestInit = {
  credentials: 'same-origin',
};

async function readError(response: Response): Promise<AuthErrorBody['error']> {
  try {
    const body = (await response.json()) as AuthErrorBody;
    if (body?.error?.code && body.error.message) {
      return body.error;
    }
  } catch {
    // ignore
  }
  return {
    code: 'api_error',
    message: 'La connexion n’a pas abouti.',
  };
}

export async function fetchSession(): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch('/api/auth/session', sameOrigin);
  } catch {
    throw new AuthRequestError('network');
  }

  if (response.status === 401) {
    return false;
  }
  if (!response.ok) {
    throw new AuthRequestError('api', { status: response.status });
  }
  const body = (await response.json()) as AuthSessionResponse;
  return body.data.authenticated === true;
}

export async function login(email: string, password: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch('/api/auth/login', {
      ...sameOrigin,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new AuthRequestError('network');
  }

  if (response.ok) {
    return;
  }

  const error = await readError(response);
  throw new AuthRequestError('api', {
    code: error.code,
    status: response.status,
    message: error.message,
  });
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      ...sameOrigin,
      method: 'POST',
    });
  } catch {
    throw new AuthRequestError('network');
  }
}
