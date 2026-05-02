import { useEffect, useRef, type ReactNode } from "react";
import { ClerkProvider, SignIn, SignUp, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Zap, BarChart3, Film, Clock } from "lucide-react";
import LandingPage from "@/pages/LandingPage";
import AnalyzerPage from "@/pages/AnalyzerPage";
import HistoryPage from "@/pages/HistoryPage";
import LearnMorePage from "@/pages/LearnMorePage";
import PricingPage from "@/pages/PricingPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 2 } },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = (() => {
  try {
    return (
      publishableKeyFromHost(
        window.location.hostname,
        import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
      ) ?? import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
    );
  } catch {
    return import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
  }
})();

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(230,90%,65%)",
    colorForeground: "#f4f4f5",
    colorMutedForeground: "#71717a",
    colorDanger: "#ef4444",
    colorBackground: "#0d0d0d",
    colorInput: "#18181b",
    colorInputForeground: "#f4f4f5",
    colorNeutral: "#3f3f46",
    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#0d0d0d] rounded-2xl w-[420px] max-w-full overflow-hidden border border-white/10",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white font-semibold tracking-tight",
    headerSubtitle: "text-zinc-400",
    socialButtonsBlockButtonText: "text-white font-medium",
    formFieldLabel: "text-zinc-300 text-sm",
    footerActionLink: "text-indigo-400 hover:text-indigo-300",
    footerActionText: "text-zinc-500",
    dividerText: "text-zinc-600",
    identityPreviewEditButton: "text-indigo-400",
    formFieldSuccessText: "text-emerald-400",
    alertText: "text-white",
    logoBox: "flex justify-center mb-1",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors",
    formButtonPrimary: "bg-indigo-600 hover:bg-indigo-500 transition-colors font-semibold",
    formFieldInput: "bg-[#18181b] border-white/10 text-white",
    footerAction: "border-t border-white/[0.08]",
    dividerLine: "bg-white/10",
    alert: "bg-red-500/10 border border-red-500/20 rounded-lg",
    otpCodeFieldInput: "bg-[#18181b] border-white/10 text-white",
    formFieldRow: "gap-2",
    main: "gap-3",
  },
};

// Higgsfield-style showcase panel shown on the right side of auth pages
function AuthShowcase({ mode }: { mode: "sign-in" | "sign-up" }) {
  const metrics = [
    { label: "Pacing", value: 87, color: "#34d399" },
    { label: "Visual Hook", value: 74, color: "#6366f1" },
    { label: "Captions", value: 91, color: "#a78bfa" },
  ];
  return (
    <div className="relative flex-1 hidden lg:flex flex-col justify-between overflow-hidden bg-[#070707] p-12">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 60% at 60% 40%, rgba(99,102,241,0.18) 0%, transparent 70%)" }}
      />
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs text-zinc-400 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          AI-powered video intelligence
        </div>
        <h2 className="text-4xl font-bold text-white leading-tight tracking-tight max-w-xs">
          {mode === "sign-in"
            ? "Your videos deserve a second opinion."
            : "Start ranking your content today."}
        </h2>
        <p className="mt-4 text-zinc-500 text-sm leading-relaxed max-w-sm">
          ClipRank analyzes pacing, visual hooks, and captions using AI — giving you actionable scores in seconds.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="relative z-10"
      >
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 max-w-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">hook_video_v3.mp4</p>
              <p className="text-xs text-zinc-500">45s · 15 frames analyzed</p>
            </div>
            <span className="ml-auto text-2xl font-bold text-indigo-400">82</span>
          </div>
          <div className="space-y-3">
            {metrics.map((m, i) => (
              <div key={m.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">{m.label}</span>
                  <span className="font-mono font-semibold" style={{ color: m.color }}>{m.value}/100</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: m.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${m.value}%` }}
                    transition={{ duration: 1, delay: 0.5 + i * 0.15, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3 mt-4 flex-wrap">
          {[
            { icon: <Film className="w-3 h-3" />, text: "Frame-level AI" },
            { icon: <BarChart3 className="w-3 h-3" />, text: "3 metrics scored" },
            { icon: <Clock className="w-3 h-3" />, text: "Results in ~10s" },
          ].map((s) => (
            <div key={s.text} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-xs text-zinc-500">
              {s.icon}{s.text}
            </div>
          ))}
        </div>
      </motion.div>

      <p className="relative z-10 text-xs text-zinc-600">
        {mode === "sign-up" ? "3 free credits on signup · No credit card required" : "Welcome back to ClipRank"}
      </p>
    </div>
  );
}

function AuthPageLayout({ mode, children }: { mode: "sign-in" | "sign-up"; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <div className="w-full lg:w-[460px] flex-shrink-0 flex flex-col items-center justify-center px-8 py-12 min-h-screen">
        <div className="w-full max-w-[400px]">
          <div className="flex items-center gap-2 mb-10">
            <img src={`${basePath}/logo.svg`} className="w-8 h-8" alt="ClipRank" />
            <span className="font-semibold text-lg text-white tracking-tight">ClipRank</span>
          </div>
          {children}
          <p className="mt-6 text-center text-xs text-zinc-600">
            By continuing, you agree to our{" "}
            <a href="#" className="underline hover:text-zinc-400 transition-colors">Terms</a>
            {" "}and{" "}
            <a href="#" className="underline hover:text-zinc-400 transition-colors">Privacy Policy</a>.
          </p>
        </div>
      </div>
      <AuthShowcase mode={mode} />
    </div>
  );
}

// Route guards — show content immediately while Clerk loads (better UX than Show)
function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && isSignedIn) return <Redirect to="/app" />;
  return <LandingPage />;
}

function AppRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && !isSignedIn) return <Redirect to="/" />;
  return <AnalyzerPage />;
}

function HistoryRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && !isSignedIn) return <Redirect to="/" />;
  return <HistoryPage />;
}

function SignInPage() {
  return (
    <AuthPageLayout mode="sign-in">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </AuthPageLayout>
  );
}

function SignUpPage() {
  return (
    <AuthPageLayout mode="sign-up">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </AuthPageLayout>
  );
}

function CacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsub = addListener(({ user }) => {
      const uid = user?.id ?? null;
      if (prev.current !== undefined && prev.current !== uid) qc.clear();
      prev.current = uid;
    });
    return unsub;
  }, [addListener, qc]);
  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      signInFallbackRedirectUrl={`${basePath}/app`}
      signUpFallbackRedirectUrl={`${basePath}/app`}
      localization={{
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to continue analyzing" } },
        signUp: { start: { title: "Create your account", subtitle: "Start with 3 free credits — no card needed" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <CacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRoute} />
            <Route path="/app" component={AppRoute} />
            <Route path="/history" component={HistoryRoute} />
            <Route path="/learn-more" component={LearnMorePage} />
            <Route path="/pricing" component={PricingPage} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  useEffect(() => { document.documentElement.classList.add("dark"); }, []);
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}
