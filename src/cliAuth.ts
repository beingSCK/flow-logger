/**
 * CLI Auth - File-based OAuth token management
 *
 * Reads tokens from cli-tokens.json in the project root.
 * Compatible with token format from calendar-automaton.
 *
 * Setup: Copy cli-tokens.json from calendar-automaton or run the OAuth
 * flow there first to get tokens.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// Token file is in project root
const PROJECT_ROOT = join(dirname(import.meta.path), "..");
const TOKEN_FILE = join(PROJECT_ROOT, "cli-tokens.json");

interface TokenData {
  token: string;
  refresh_token: string;
  token_uri: string;
  client_id: string;
  client_secret: string;
  scopes: string[];
  expiry: string; // ISO date string
}

/**
 * Read token data from cli-tokens.json
 */
function readTokenFile(): TokenData {
  if (!existsSync(TOKEN_FILE)) {
    throw new Error(
      `Token file not found at ${TOKEN_FILE}\n\n` +
        "To set up CLI tokens:\n" +
        "  1. Copy cli-tokens.json from calendar-automaton project, or\n" +
        "  2. Create a new OAuth token using Google's OAuth 2.0 flow\n\n" +
        "The file should contain: token, refresh_token, client_id, client_secret, expiry"
    );
  }

  const content = readFileSync(TOKEN_FILE, "utf-8");
  return JSON.parse(content) as TokenData;
}

/**
 * Write updated token data back to cli-tokens.json
 */
function writeTokenFile(data: TokenData): void {
  writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
}

/**
 * Check if the token is expired (with 60 second buffer)
 */
function isTokenExpired(expiryStr: string): boolean {
  const expiry = new Date(expiryStr);
  const now = new Date();
  const bufferMs = 60 * 1000; // 60 second buffer
  return now.getTime() >= expiry.getTime() - bufferMs;
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(tokenData: TokenData): Promise<TokenData> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: tokenData.refresh_token,
      client_id: tokenData.client_id,
      client_secret: tokenData.client_secret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();

  // Calculate new expiry time
  const expiresInSeconds = data.expires_in || 3600;
  const newExpiry = new Date(Date.now() + expiresInSeconds * 1000);

  return {
    ...tokenData,
    token: data.access_token,
    expiry: newExpiry.toISOString(),
  };
}

/**
 * Get a valid access token, refreshing if necessary.
 */
export async function getAccessToken(): Promise<string> {
  let tokenData = readTokenFile();

  // Check if token is expired
  if (isTokenExpired(tokenData.expiry)) {
    console.log("Token expired, refreshing...");
    tokenData = await refreshAccessToken(tokenData);
    writeTokenFile(tokenData);
    console.log("Token refreshed successfully");
  }

  return tokenData.token;
}

/**
 * Check if CLI auth is configured (token file exists)
 */
export function isAuthConfigured(): boolean {
  return existsSync(TOKEN_FILE);
}
