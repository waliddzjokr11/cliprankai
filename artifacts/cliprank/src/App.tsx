import { useEffect, useRef } from "react";
import { ClerkProvider, HandleSSOCallback, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "@/pages/LandingPage";
import AnalyzerPage from "@/pages/AnalyzerPage";
import HistoryPage from "@/pages/HistoryPage";
import LearnMorePage from "@/pages/LearnMorePage";
import PricingPage from "@/pages/PricingPage";
import AuthPage from "@/pages/AuthPage";
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


// SSO callback — finalizes OAuth session then navigates
function SSOCallbackRoute() {
  const [, setLocation] = useLocation();
  return (
    <HandleSSOCallback
      navigateToApp={() => setLocation("/app")}
      navigateToSignIn={() => setLocation("/auth")}
      navigateToSignUp={() => setLocation("/auth")}
    />
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

// Unified auth page — handles both sign-in and sign-up via email OTP flow
function AuthRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && isSignedIn) return <Redirect to="/app" />;
  return <AuthPage />;
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
      signInUrl={`${basePath}/auth`}
      signUpUrl={`${basePath}/auth`}
      signInFallbackRedirectUrl={`${basePath}/app`}
      signUpFallbackRedirectUrl={`${basePath}/app`}
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
            <Route path="/auth/*?" component={AuthRoute} />
            {/* SSO callback — Clerk redirects here after OAuth; HandleSSOCallback finalizes the session */}
            <Route path="/sso-callback" component={SSOCallbackRoute} />
            {/* Legacy redirects — keep old URLs working */}
            <Route path="/sign-in/*?" component={AuthRoute} />
            <Route path="/sign-up/*?" component={AuthRoute} />
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
