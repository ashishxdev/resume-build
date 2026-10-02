export type AuthFailure = {
  code?: string;
  message?: string;
  status?: number;
  statusCode?: number;
};

export function isInvalidResetTokenError(error: AuthFailure | null) {
  return error?.code === "INVALID_TOKEN";
}

export function getPasswordResetErrorMessage(error: AuthFailure | null) {
  if (error?.status === 429 || error?.statusCode === 429) {
    return "Too many attempts. Wait a moment and try again with this link.";
  }

  if (error?.code === "PASSWORD_TOO_LONG") {
    return "Use no more than 128 characters for your new password.";
  }

  return "We could not update your password. Please try again shortly.";
}
