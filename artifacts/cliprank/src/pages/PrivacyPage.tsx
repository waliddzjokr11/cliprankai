import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function PrivacyPage() {
  usePageTitle("Privacy Policy");
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
      <main className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-zinc">
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-zinc-500 text-sm mb-10">Last updated: May 14, 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">1. Who we are</h2>
          <p className="text-zinc-400 leading-relaxed">ClipRank AI ("we", "us", "our") operates cliprankai.com — an AI-powered video analysis service. You can reach us at support@cliprankai.com for any privacy-related questions.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">2. What data we collect</h2>
          <ul className="list-disc list-inside space-y-2 text-zinc-400">
            <li><strong className="text-white">Account data:</strong> Email address and name collected via Clerk authentication (Google OAuth or email/password).</li>
            <li><strong className="text-white">Video data:</strong> Video files you upload are processed server-side for frame extraction and AI analysis, then deleted from our servers. We store anonymised analysis results (scores, transcript, feedback) in our database.</li>
            <li><strong className="text-white">Payment data:</strong> Credit card and payment details are handled entirely by PayPal — we never see or store your card number.</li>
            <li><strong className="text-white">Usage data:</strong> With your consent, we collect anonymised analytics (page views, feature usage) via Google Analytics 4.</li>
            <li><strong className="text-white">Contact data:</strong> Name, email and message content when you submit our contact form.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">3. How we use your data</h2>
          <ul className="list-disc list-inside space-y-2 text-zinc-400">
            <li>To provide, maintain and improve the ClipRank AI service</li>
            <li>To process payments and manage your credit balance</li>
            <li>To respond to contact form messages and support requests</li>
            <li>To send transactional emails (account activity, payment receipts) — no marketing without consent</li>
            <li>To analyse usage patterns and improve the product (only with your consent)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">4. Legal basis (GDPR)</h2>
          <p className="text-zinc-400 leading-relaxed">For users in the EU/EEA, we process your data on the following legal bases:</p>
          <ul className="list-disc list-inside space-y-2 text-zinc-400 mt-2">
            <li><strong className="text-white">Contract performance</strong> — account and service delivery</li>
            <li><strong className="text-white">Legitimate interest</strong> — security monitoring and fraud prevention</li>
            <li><strong className="text-white">Consent</strong> — analytics cookies (you can withdraw at any time)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">5. Data retention</h2>
          <p className="text-zinc-400 leading-relaxed">Video files are deleted immediately after processing. Analysis results are stored for as long as your account is active. You can request deletion at any time by emailing support@cliprankai.com. Contact messages are retained for 2 years.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">6. Third parties</h2>
          <ul className="list-disc list-inside space-y-2 text-zinc-400">
            <li><strong className="text-white">Clerk</strong> — authentication and user management</li>
            <li><strong className="text-white">OpenAI</strong> — video frame and transcript analysis via GPT-4o</li>
            <li><strong className="text-white">PayPal</strong> — payment processing</li>
            <li><strong className="text-white">Google Analytics 4</strong> — anonymised usage analytics (consent required)</li>
            <li><strong className="text-white">Replit</strong> — hosting infrastructure</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">7. Your rights</h2>
          <p className="text-zinc-400 leading-relaxed">You have the right to access, correct, delete, or export your personal data. EU/EEA users also have the right to object to processing and lodge a complaint with your local data protection authority. Contact us at support@cliprankai.com to exercise any of these rights.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">8. Cookies</h2>
          <p className="text-zinc-400 leading-relaxed">We use strictly necessary cookies for authentication (managed by Clerk). We only place analytics cookies after you provide explicit consent. See our <button onClick={() => nav("/cookies")} className="text-indigo-400 hover:underline">Cookie Policy</button> for details.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">9. Changes to this policy</h2>
          <p className="text-zinc-400 leading-relaxed">We may update this policy periodically. We will notify you of significant changes by email or a banner on the site. Continued use of the service after changes constitutes acceptance of the updated policy.</p>
        </section>
      </main>
    </div>
  );
}
