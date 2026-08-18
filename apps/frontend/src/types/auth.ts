export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isEmailVerified: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}
