import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function TermsPage() {
  usePageTitle("Terms of Service");
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
        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-zinc-500 text-sm mb-10">Last updated: May 14, 2026</p>

        {[
          { title: "1. Acceptance", body: "By accessing or using ClipRank AI at cliprankai.com, you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not access the service." },
          { title: "2. Service description", body: "ClipRank AI provides AI-powered video analysis to estimate the virality potential of social media video content. Scores and feedback are algorithmic estimates only — we make no guarantee that a high score will result in actual viral distribution on any platform." },
          { title: "3. User accounts", body: "You must create an account to use ClipRank AI. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorised use of your account." },
          { title: "4. Credits and payments", body: "Credits are required to analyse videos (1 credit per 10 seconds of video). Credits are purchased via PayPal and are non-refundable once used. Unused credits do not expire. We reserve the right to modify credit pricing with 30 days' notice." },
          { title: "5. Acceptable use", body: "You may not use ClipRank AI to: upload content that is illegal, harmful, or violates third-party rights; attempt to reverse-engineer or scrape the AI analysis system; create accounts programmatically or abuse the free credit system; upload content you do not own or have permission to analyse." },
          { title: "6. Intellectual property", body: "You retain all rights to the videos you upload. You grant us a limited, temporary licence to process your video for analysis purposes only. We delete video files immediately after processing. Our software, branding, and analysis methodology are our intellectual property." },
          { title: "7. Data and privacy", body: "Our collection and use of your personal data is described in our Privacy Policy. By using the service you agree to our data practices." },
          { title: "8. Disclaimers", body: "The service is provided 'as is' without warranties of any kind. We do not warrant that analysis results will be accurate, complete, or suitable for any particular purpose. AI scores are estimates only." },
          { title: "9. Limitation of liability", body: "To the maximum extent permitted by law, ClipRank AI shall not be liable for any indirect, incidental, special, consequential or punitive damages arising from your use of the service." },
          { title: "10. Termination", body: "We may terminate or suspend your account at any time for violation of these terms. You may delete your account at any time from account settings." },
          { title: "11. Changes to terms", body: "We reserve the right to modify these terms at any time. We will provide at least 14 days' notice of material changes. Continued use after changes constitutes acceptance." },
          { title: "12. Governing law", body: "These terms are governed by applicable law. Any disputes shall be resolved through good-faith negotiation before pursuing formal legal remedies." },
        ].map(({ title, body }) => (
          <section key={title} className="mb-7">
            <h2 className="text-lg font-semibold mb-2">{title}</h2>
            <p className="text-zinc-400 leading-relaxed">{body}</p>
          </section>
        ))}

        <p className="text-zinc-600 text-sm mt-8">Questions? Contact us at support@cliprankai.com</p>
      </main>
    </div>
  );
}
