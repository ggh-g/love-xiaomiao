const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const LOVE_BANK_TABLE = "love_bank_events";
export const LOVE_BANK_ID =
  import.meta.env.VITE_SUPABASE_BANK_ID || "xiaomiao-love-bank";

export const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);

function makeAuthHeaders(extraHeaders = {}) {
  const headers = {
    apikey: supabaseAnonKey,
    ...extraHeaders,
  };

  if (supabaseAnonKey && !supabaseAnonKey.startsWith("sb_publishable_")) {
    headers.Authorization = `Bearer ${supabaseAnonKey}`;
  }

  return headers;
}

function buildTableUrl() {
  return new URL(`/rest/v1/${LOVE_BANK_TABLE}`, supabaseUrl).toString();
}

async function parseResponse(response) {
  if (response.ok) {
    if (response.status === 204) {
      return null;
    }
    return response.json();
  }

  const message = await response.text();
  throw new Error(message || `Supabase request failed: ${response.status}`);
}

export async function fetchLoveBankEvents() {
  const url = new URL(buildTableUrl());
  url.searchParams.set("select", "id,bank_id,kind,amount,label,created_at");
  url.searchParams.set("bank_id", `eq.${LOVE_BANK_ID}`);
  url.searchParams.set("order", "created_at.desc");

  const response = await fetch(url, {
    headers: makeAuthHeaders(),
  });

  return parseResponse(response);
}

export async function insertLoveBankEvents(payload) {
  const response = await fetch(buildTableUrl(), {
    method: "POST",
    headers: makeAuthHeaders({
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function resetLoveBankEvents() {
  const url = new URL(buildTableUrl());
  url.searchParams.set("bank_id", `eq.${LOVE_BANK_ID}`);

  const response = await fetch(url, {
    method: "DELETE",
    headers: makeAuthHeaders(),
  });

  return parseResponse(response);
}
