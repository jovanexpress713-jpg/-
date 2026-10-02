import { useEffect, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { FLEET } from "../data/fleet";
import { PhoneFrame } from "./PhoneFrame";
import { SplashScreen } from "./SplashScreen";
import { HomeScreen } from "./HomeScreen";
import { LiveScreen } from "./LiveScreen";
import { OrdersScreen, ProfileScreen } from "./Screens";
import { IconArrowRight, IconScan, IconTruck } from "../components/Icons";

type ScreenId = "splash" | "home" | "live" | "orders" | "profile";

import { useFleetStore } from "../state/fleetStore";

export function MobileApp() {
  const { t } = useSettings();
  const { trucks } = useFleetStore();
  const [screen, setScreen] = useState<ScreenId>("home");
  const [tab, setTab] = useState("home");
  const [currentId, setCurrentId] = useState(trucks[0]?.id || "v1");
  const [scanning, setScanning] = useState(false);
  const [replay, setReplay] = useState(0);

  const current = trucks.find((v) => v.id === currentId) ?? trucks[0] ?? FLEET[0];

  useEffect(() => {
    const onReplay = () => setReplay((r) => r + 1);
    window.addEventListener("ejaz-replay", onReplay);
    return () => window.removeEventListener("ejaz-replay", onReplay);
  }, []);

  useEffect(() => {
    if (!scanning) return;
    const id = window.setTimeout(() => {
      setScanning(false);
      const pick = FLEET[Math.floor(Math.random() * FLEET.length)];
      setCurrentId(pick.id);
      setScreen("live");
    }, 1900);
    return () => window.clearTimeout(id);
  }, [scanning]);

  const CHIPS: [ScreenId, string][] = [
    ["splash", t("Splash", "شاشة البداية")],
    ["home", t("Home", "الرئيسية")],
    ["live", t("Tracking", "التتبع الحي")],
    ["orders", t("Orders", "الطلبات")],
    ["profile", t("Profile", "الحساب")],
  ];

  const FEATURES: [string, string, React.ReactNode][] = [
    [
      t("Scan to open", "امسح للعرض"),
      t(
        "A camera layer with corner brackets and a moving line resolves the shipment instantly.",
        "طبقة كاميرا بإطار زوايا وخط متحرك تحدد الشحنة فورًا.",
      ),
      <IconScan size={16} key="1" />,
    ],
    [
      t("Live telemetry", "بيانات حية"),
      t(
        "Speed, turn-by-turn capsule and ETA driven by the same shared clock as the console.",
        "السرعة واتجاهات الدوران والوصول تعمل من نفس ساعة اللوحة.",
      ),
      <IconTruck size={16} key="2" />,
    ],
    [
      t("Recent shipments", "الشحنات الأخيرة"),
      t(
        "Cards with a real route map and one tap into the full-screen tracking view.",
        "بطاقات مع خريطة حقيقية ودخول بشاشة كاملة للتتبع.",
      ),
      <IconArrowRight size={16} key="3" />,
    ],
  ];

  const open = (id: string) => {
    setCurrentId(id);
    setScreen("live");
  };

  const renderScreen = (id: ScreenId) => {
    switch (id) {
      case "splash":
        return <SplashScreen replayKey={replay} />;
      case "home":
        return (
          <HomeScreen
            vehicles={trucks}
            currentId={currentId}
            onOpen={open}
            onScan={() => setScanning(true)}
            tab={tab}
            onTab={(x) => {
              setTab(x);
              setScreen(x as ScreenId);
            }}
          />
        );
      case "live":
        return (
          <LiveScreen v={current} onBack={() => setScreen("home")} onInfo={() => setScreen("orders")} />
        );
      case "orders":
        return (
          <OrdersScreen
            vehicles={trucks}
            onOpen={open}
            tab={tab}
            onTab={(x) => {
              setTab(x);
              setScreen(x as ScreenId);
            }}
          />
        );
      case "profile":
        return (
          <ProfileScreen
            vehicles={trucks}
            tab={tab}
            onTab={(x) => {
              setTab(x);
              setScreen(x as ScreenId);
            }}
          />
        );
    }
  };

  return (
    <div className="dotted-light scroll-thin h-full overflow-y-auto bg-paper">
      <div className="mx-auto max-w-[1180px] px-5 py-10">
        <header className="max-w-[560px]">
          <span className="inline-flex items-center gap-2 rounded-full bg-navy px-3 py-1.5 text-[10.5px] font-semibold tracking-[0.16em] text-accent-2 uppercase">
            {t("Mobile companion", "تطبيق الجوال المرافق")}
          </span>
          <h1 className="mt-4 text-[28px] leading-tight font-medium text-navy">
            {t(
              "EJAZ client tracking, in the pocket.",
              "تتبّع شحنات العملاء من إيجاز، في جيبك.",
            )}
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-navy/60">
            {t(
              "Five working screens — splash, home, live tracking, orders and profile — sharing the same design tokens as the web console, on the same live clock.",
              "خمس شاشات عاملة — البداية، الرئيسية، التتبع الحي، الطلبات والحساب — بنفس متغيرات التصميم في لوحة التحكم، وبنفس الساعة الحية.",
            )}
          </p>
        </header>

        <div className="mt-8 flex flex-wrap gap-2">
          {CHIPS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setScreen(id)}
              className={cn(
                "rounded-[5px] px-3 py-2 text-[12px] transition-all duration-200 active:scale-95",
                screen === id
                  ? "bg-navy font-semibold text-white"
                  : "bg-navy/5 text-navy/60 hover:bg-navy/10",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-10 grid items-center gap-12 lg:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            {FEATURES.map(([title, text, icon], i) => (
              <div
                key={title}
                style={{ animationDelay: `${i * 60}ms` }}
                className="animate-fade-up flex gap-3 rounded-[16px] bg-paper p-4 shadow-[0_18px_40px_-28px_color-mix(in_oklab,var(--color-navy)_45%,transparent)]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent-2/12 text-accent-2">
                  {icon}
                </span>
                <div>
                  <div className="text-[13px] font-medium text-navy">{title}</div>
                  <div className="mt-0.5 text-[11.5px] leading-relaxed text-navy/60">{text}</div>
                </div>
              </div>
            ))}

            <div className="rounded-[16px] bg-navy p-4 text-white/75">
              <div className="text-[10.5px] tracking-[0.16em] text-white/50 uppercase">
                {t("Device frame", "إطار الجهاز")}
              </div>
              <div className="mt-1 text-[12.5px] tabular-nums">
                286 × 600 px · 7 px bezel · 48 px radius · Dynamic Island · 9:41
              </div>
            </div>
          </div>

          <div className="relative mx-auto h-[700px] w-[540px] overflow-hidden">
            <button
              onClick={() => setScreen("splash")}
              className="absolute top-[54px] left-[-86px] origin-top-right rotate-[-9deg] scale-[0.78] transition-transform duration-300 hover:scale-[0.82]"
            >
              <PhoneFrame>
                <SplashScreen replayKey={replay} />
              </PhoneFrame>
            </button>

            <button
              onClick={() => setScreen("orders")}
              className="absolute top-[128px] right-[-96px] origin-top-left rotate-[8deg] scale-[0.78] transition-transform duration-300 hover:scale-[0.82]"
            >
              <PhoneFrame tone="light">
                <OrdersScreen vehicles={FLEET} onOpen={open} tab="orders" onTab={() => {}} />
              </PhoneFrame>
            </button>

            <button
              onClick={() => setScreen("profile")}
              className="absolute bottom-[6px] left-[-64px] origin-bottom-right rotate-[7deg] scale-[0.72] transition-transform duration-300 hover:scale-[0.76]"
            >
              <PhoneFrame tone="light">
                <ProfileScreen vehicles={FLEET} tab="profile" onTab={() => {}} />
              </PhoneFrame>
            </button>

            <div className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
              <PhoneFrame
                glow
                tone={screen === "orders" || screen === "profile" ? "light" : "dark"}
              >
                {renderScreen(screen)}
              </PhoneFrame>
            </div>

            {scanning && (
              <div className="animate-fade-in absolute top-1/2 left-1/2 z-30 h-[600px] w-[286px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[48px] bg-black/85 backdrop-blur-sm">
                <div className="flex h-full flex-col items-center justify-center px-8">
                  <div className="relative h-40 w-40">
                    {[
                      "top-0 left-0 border-t-2 border-l-2 rounded-tl-[18px]",
                      "top-0 right-0 border-t-2 border-r-2 rounded-tr-[18px]",
                      "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-[18px]",
                      "bottom-0 right-0 border-b-2 border-r-2 rounded-br-[18px]",
                    ].map((c) => (
                      <span key={c} className={cn("absolute h-9 w-9 border-accent-2", c)} />
                    ))}
                    <span className="animate-scan absolute inset-x-3 top-1/2 h-[2px] rounded-full bg-accent-2 shadow-[0_0_18px_4px_color-mix(in_oklab,var(--color-accent-2)_55%,transparent)]" />
                  </div>
                  <div className="mt-6 text-[12px] font-medium text-white">
                    {t("Scanning shipment code…", "جارٍ مسح رمز الشحنة…")}
                  </div>
                  <div className="mt-1 text-[10.5px] text-white/55">
                    {t("Align the QR inside the frame", "حاذِ رمز QR داخل الإطار")}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
