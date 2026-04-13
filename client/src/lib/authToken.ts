let accessToken = "";

export function setAccessToken(token: string) {
  accessToken = token.trim();
}

export function getAccessToken(): string {
  return accessToken;
}
