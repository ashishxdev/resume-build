export function getSafeRedirect(value: string | undefined): string {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }

  try {
    const baseURL = "http://local.invalid";
    const redirectURL = new URL(value, baseURL);

    if (redirectURL.origin !== baseURL) {
      return "/dashboard";
    }

    return `${redirectURL.pathname}${redirectURL.search}${redirectURL.hash}`;
  } catch {
    return "/dashboard";
  }
}
