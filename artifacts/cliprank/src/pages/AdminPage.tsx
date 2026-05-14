import { useState } from "react";
import { useUser } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Shield, Users, MessageSquare, Settings, Check, X, RefreshCw, ArrowLeft, Edit2, Save } from "lucide-react";

const ADMIN_USER_ID = "user_3DAainmIJ1RHEdNGbA8rXsNn8Nk";

type Tab = "requests" | "users" | "messages" | "cms";

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const [, nav] = useLocation();
  const [tab, setTab] = useState<Tab>("requests");

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.id !== ADMIN_USER_ID) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="text-center">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-zinc-400 mb-6">You don't have permission to view this page.</p>
          <button onClick={() => nav("/")} className="px-5 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">Go Home</button>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: "requests", label: "Access Requests", icon: Users },
    { id: "users", label: "Users & Credits", icon: Shield },
    { id: "messages", label: "Contact Messages", icon: MessageSquare },
    { id: "cms", label: "Site Content", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/[0.06] bg-[#0a0a0a]/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => nav("/app")} className="text-zinc-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              <span className="font-semibold">Admin Panel</span>
            </div>
          </div>
          <span className="text-xs sm:text-sm text-zinc-500 truncate max-w-[180px] sm:max-w-none">
            {user.primaryEmailAddress?.emailAddress}
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Scrollable tab bar for mobile */}
        <div className="flex gap-2 mb-6 sm:mb-8 overflow-x-auto pb-2 border-b border-white/[0.06] scrollbar-none">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === id ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>

        {tab === "requests" && <AccessRequestsTab adminId={user.id} />}
        {tab === "users" && <UsersTab adminId={user.id} />}
        {tab === "messages" && <MessagesTab adminId={user.id} />}
        {tab === "cms" && <CmsTab adminId={user.id} />}
      </div>
    </div>
  );
}

function AccessRequestsTab({ adminId }: { adminId: string }) {
  const qc = useQueryClient();
  const { data: requests, isLoading } = useQuery({
    queryKey: ["/api/admin/requests", adminId],
    queryFn: () => fetch(`/api/admin/requests?userId=${adminId}`).then(r => r.json()),
  });

  const approve = useMutation({
    mutationFn: ({ id, credits }: { id: string; credits: number }) =>
      fetch(`/api/admin/requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: adminId, credits }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/requests", adminId] }),
  });

  const reject = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: adminId }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/requests", adminId] }),
  });

  const [creditAmounts, setCreditAmounts] = useState<Record<string, number>>({});

  if (isLoading) return <Loading />;

  const list = Array.isArray(requests) ? requests : [];
  const pending = list.filter((r: any) => r.status === "pending");
  const processed = list.filter((r: any) => r.status !== "pending");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold mb-4">Pending Requests ({pending.length})</h2>
        {pending.length === 0 ? (
          <EmptyState message="No pending requests" />
        ) : (
          <div className="space-y-3">
            {pending.map((req: any) => (
              <motion.div key={req.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium truncate">{req.email}</span>
                      <span className="text-xs text-zinc-500">{new Date(req.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-zinc-400 mb-3 leading-relaxed">{req.reason}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        placeholder="Credits"
                        defaultValue={10}
                        min={1}
                        max={9999}
                        className="w-28 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500"
                        onChange={e => setCreditAmounts(prev => ({ ...prev, [req.id]: parseInt(e.target.value) || 10 }))}
                      />
                      <button
                        onClick={() => approve.mutate({ id: req.id, credits: creditAmounts[req.id] ?? 10 })}
                        className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => reject.mutate(req.id)}
                        className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-sm font-medium transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {processed.length > 0 && (
        <div>
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Processed ({processed.length})</h2>
          <div className="space-y-2">
            {processed.map((req: any) => (
              <div key={req.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium text-sm truncate block">{req.email}</span>
                  <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{req.reason}</p>
                </div>
                <span className={`self-start sm:self-auto text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${
                  req.status === "approved" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                }`}>
                  {req.status === "approved" ? `Approved · ${req.grantedCredits} credits` : "Rejected"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UsersTab({ adminId }: { adminId: string }) {
  const qc = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ["/api/admin/users", adminId],
    queryFn: () => fetch(`/api/admin/users?userId=${adminId}`).then(r => r.json()),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCredits, setEditCredits] = useState<number>(0);

  const updateCredits = useMutation({
    mutationFn: ({ targetUserId, credits }: { targetUserId: string; credits: number }) =>
      fetch(`/api/admin/users/${targetUserId}/credits`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: adminId, credits }),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/users", adminId] }); setEditingId(null); },
  });

  if (isLoading) return <Loading />;

  const list = Array.isArray(users) ? users : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-semibold">All Users ({list.length})</h2>
        <button onClick={() => qc.invalidateQueries({ queryKey: ["/api/admin/users", adminId] })} className="text-zinc-500 hover:text-white transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="border-b border-white/[0.06] text-zinc-500 text-xs uppercase tracking-wider">
              <th className="px-4 sm:px-5 py-3 text-left">Email / User ID</th>
              <th className="px-4 sm:px-5 py-3 text-right">Credits</th>
              <th className="px-4 sm:px-5 py-3 text-right">Joined</th>
              <th className="px-4 sm:px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {list.map((u: any) => (
              <tr key={u.userId} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 sm:px-5 py-3">
                  <div className="font-medium truncate max-w-[200px]">{u.email || <span className="text-zinc-600 italic">No email</span>}</div>
                  <div className="text-xs text-zinc-600 font-mono truncate max-w-[200px]">{u.userId}</div>
                </td>
                <td className="px-4 sm:px-5 py-3 text-right">
                  {editingId === u.userId ? (
                    <input
                      type="number"
                      value={editCredits}
                      min={0}
                      max={99999}
                      className="w-20 px-2 py-1 rounded bg-white/[0.05] border border-indigo-500/50 text-white text-right focus:outline-none"
                      onChange={e => setEditCredits(parseInt(e.target.value) || 0)}
                    />
                  ) : (
                    <span className={`font-mono font-semibold ${u.credits > 0 ? "text-emerald-400" : "text-zinc-600"}`}>{u.credits}</span>
                  )}
                </td>
                <td className="px-4 sm:px-5 py-3 text-right text-zinc-500 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-4 sm:px-5 py-3 text-right">
                  {editingId === u.userId ? (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => updateCredits.mutate({ targetUserId: u.userId, credits: editCredits })}
                        className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-500 transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingId(u.userId); setEditCredits(u.credits); }}
                      className="p-1.5 rounded bg-white/[0.05] hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MessagesTab({ adminId }: { adminId: string }) {
  const qc = useQueryClient();
  const { data: messages, isLoading } = useQuery({
    queryKey: ["/api/admin/messages", adminId],
    queryFn: () => fetch(`/api/admin/messages?userId=${adminId}`).then(r => r.json()),
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/messages/${id}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: adminId }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/messages", adminId] }),
  });

  if (isLoading) return <Loading />;

  const list = Array.isArray(messages) ? messages : [];

  return (
    <div>
      <h2 className="text-lg sm:text-xl font-semibold mb-4">Contact Messages ({list.length})</h2>
      {list.length === 0 ? <EmptyState message="No messages yet" /> : (
        <div className="space-y-3">
          {list.map((msg: any) => (
            <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className={`border rounded-xl p-4 sm:p-5 transition-colors ${
                msg.read ? "bg-white/[0.02] border-white/[0.06]" : "bg-indigo-500/[0.04] border-indigo-500/20"
              }`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-2 gap-2">
                <div>
                  <span className="font-medium">{msg.name}</span>
                  <span className="text-zinc-500 ml-2 text-sm">{msg.email}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-zinc-600">{new Date(msg.createdAt).toLocaleDateString()}</span>
                  {!msg.read && (
                    <button
                      onClick={() => markRead.mutate(msg.id)}
                      className="text-xs px-2.5 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 transition-colors"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">{msg.message}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function CmsTab({ adminId }: { adminId: string }) {
  const qc = useQueryClient();
  const { data: config, isLoading } = useQuery({
    queryKey: ["/api/config"],
    queryFn: () => fetch("/api/config").then(r => r.json()),
  });

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const labels: Record<string, string> = {
    hero_title: "Hero Title",
    hero_subtitle: "Hero Subtitle",
    hero_cta: "Hero CTA Button",
    hero_badge: "Hero Badge Text",
    features_title: "Features Section Title",
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: adminId, ...edits }),
    });
    qc.invalidateQueries({ queryKey: ["/api/config"] });
    setEdits({});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (isLoading) return <Loading />;

  const merged = { ...(config || {}), ...edits };
  const hasChanges = Object.keys(edits).length > 0;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold">Site Content</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Edit landing page text without code changes</p>
        </div>
        {(hasChanges || saved) && (
          <button
            onClick={save}
            disabled={saving || !hasChanges}
            className="self-start sm:self-auto flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
          </button>
        )}
      </div>
      <div className="space-y-4">
        {Object.entries(labels).map(([key, label]) => (
          <div key={key}>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">{label}</label>
            <input
              type="text"
              value={merged[key] ?? ""}
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:border-indigo-500 transition-colors"
              onChange={e => setEdits(prev => ({ ...prev, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      {!hasChanges && !saved && <p className="text-xs text-zinc-600 mt-4">Make changes above then click Save</p>}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="text-center py-16 text-zinc-600">{message}</div>;
}
