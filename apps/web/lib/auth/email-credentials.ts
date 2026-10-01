export type EmailCredentials = {
  email: string;
  name?: string;
  password: string;
};

type PrepareEmailCredentialsInput = {
  email: string;
  mode: "signin" | "signup";
  name: string;
  password: string;
};

type PreparedEmailCredentials =
  | { credentials: EmailCredentials; error: null }
  | { credentials: null; error: string };

export function prepareEmailCredentials({
  email,
  mode,
  name,
  password,
}: PrepareEmailCredentialsInput): PreparedEmailCredentials {
  const normalizedEmail = email.trim();

  if (mode === "signin") {
    return {
      credentials: { email: normalizedEmail, password },
      error: null,
    };
  }

  const normalizedName = name.trim();

  if (normalizedName.length < 2) {
    return {
      credentials: null,
      error: "Please enter a name with at least 2 characters.",
    };
  }

  return {
    credentials: {
      email: normalizedEmail,
      name: normalizedName,
      password,
    },
    error: null,
  };
}
