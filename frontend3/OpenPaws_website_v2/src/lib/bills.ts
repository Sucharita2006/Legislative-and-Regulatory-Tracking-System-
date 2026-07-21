import { apiFetch } from "./api";
import { getUser } from "./auth";

export type Bill = {
  source_id: string;
  title: string;
  congress: number;
  bill_type: string;
  status: string | null;
  ai_summary: string | null;
  relevance_score: number | null;
  policy_area: string | null;
  sponsor_name: string | null;
  sponsor_party: string | null;
  sponsor_state: string | null;
  introduced_date: string | null;
  updated_at: string | null;
};

export type BillAction = {
  action_date: string;
  text: string;
  action_type: string | null;
  chamber: string | null;
};

export async function searchBills(params: Record<string, string | number>) {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const user = await getUser();
  const res = await apiFetch(`/documents/search?${qs}`, user?.email ?? "", {});
  if (!res.ok) throw new Error(`Failed to fetch bills (${res.status})`);
  return res.json();
}

export async function fetchBillDetails(sourceId: string): Promise<Bill> {
  const user = await getUser();
  const res = await apiFetch(`/documents/${encodeURIComponent(sourceId)}`, user?.email ?? "", {});
  if (!res.ok) throw new Error(`Failed to fetch bill (${res.status})`);
  return res.json();
}

export async function fetchBillActions(sourceId: string): Promise<BillAction[]> {
  const user = await getUser();
  const res = await apiFetch(
    `/documents/${encodeURIComponent(sourceId)}/actions`,
    user?.email ?? "",
    {},
  );
  if (!res.ok) throw new Error(`Failed to fetch bill actions (${res.status})`);
  return res.json();
}

export async function fetchSubjectsGrouped() {
  const user = await getUser();
  const res = await apiFetch("/subjects/grouped", user?.email ?? "", {});
  if (!res.ok) throw new Error(`Failed to fetch subjects (${res.status})`);
  return res.json();
}
