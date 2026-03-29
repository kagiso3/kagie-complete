import type { Role } from "./enums";
import type { UserRecord } from "./entities";

export interface RegisterStudentInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RefreshSessionInput {
  refreshToken: string;
}

export interface CreateAssistantInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface BootstrapMasterAdminInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthTokenPayload {
  sub: string;
  role: Role;
  email: string;
  tokenVersion: number;
  type: "access" | "refresh";
}

export interface AuthSession {
  user: UserRecord;
  tokens: AuthTokens;
}
