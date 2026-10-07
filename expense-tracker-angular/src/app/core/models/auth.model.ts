export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  token?: string;
}

export interface ProfileStats {
  totalExpenses: number;
  totalSpent: number;
  totalIncome: number;
  topCategory: string | null;
}

export interface UserProfile extends AuthUser {
  createdAt: string;
  stats: ProfileStats;
}

export interface AuthResult {
  ok: boolean;
  message?: string;
}

export interface MessageResponse {
  message: string;
}

export interface StorageUser {
  user: AuthUser | null;
}