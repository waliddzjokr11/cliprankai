import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function CookiePolicyPage() {
  usePageTitle("Cookie Policy");
  const [, nav] = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
          <button onClick={() => nav("/")} className="text-zinc-500 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex items-center gap-2">
            <img src={`${basePath}/logo.svg`} className="w-6 h-6" alt="ClipRank" />
            <span className="font-semibold">ClipRank</span>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-2">Cookie Policy</h1>
        <p className="text-zinc-500 text-sm mb-10">Last updated: May 14, 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">What are cookies?</h2>
          <p className="text-zinc-400 leading-relaxed">Cookies are small text files stored on your device by your browser. They help websites remember your preferences and provide a better experience.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Cookies we use</h2>
          <div className="space-y-4">
            {[
              { name: "Strictly Necessary", basis: "No consent required", desc: "Session cookies set by Clerk for authentication. Without these, you cannot log in. These cannot be disabled.", cookies: ["__session (Clerk auth token)", "__client_uat (Clerk user state)"] },
              { name: "Analytics (Optional)", basis: "Consent required", desc: "Google Analytics 4 cookies to understand how visitors use the site. No personal data is sent. Only loaded after you accept.", cookies: ["_ga (2 years)", "_ga_* (session, 2 years)"] },
            ].map(cat => (
              <div key={cat.name} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{cat.name}</h3>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${cat.basis === "No consent required" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>{cat.basis}</span>
                </div>
                <p className="text-sm text-zinc-400 mb-3">{cat.desc}</p>
                <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
                  {cat.cookies.map(c => <li key={c}>{c}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Managing your preferences</h2>
          <p className="text-zinc-400 leading-relaxed mb-3">You can change your cookie consent at any time by clicking the cookie settings button in the footer of any page. You can also clear cookies in your browser settings — note this will log you out of ClipRank.</p>
          <p className="text-zinc-400 leading-relaxed">All major browsers allow you to block cookies: see your browser's help documentation for instructions.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Contact</h2>
          <p className="text-zinc-400">For questions about our cookie use, contact us at <a href="mailto:support@cliprankai.com" className="text-indigo-400 hover:underline">support@cliprankai.com</a>.</p>
        </section>
      </main>
    </div>
  );
}
