export type AuthUser = {
  userId: number;
  username: string;
  displayName: string;
  role: string;
  status: string;
  createdAt?: number;
  updatedAt?: number;
};

export type AuthRegisterPayload = {
  username: string;
  password: string;
  displayName?: string;
};

export type AuthChangePasswordPayload = {
  oldPassword: string;
  newPassword: string;
};

export type AuthResetPasswordPayload = {
  username: string;
};

export type AuthResetPasswordResult = {
  username: string;
  temporaryPassword: string;
};
