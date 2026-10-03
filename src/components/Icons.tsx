import type { ReactNode } from "react";

interface IconProps {
  className?: string;
  size?: number;
}

function Svg({
  size = 18,
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconDashboard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="7" height="7" rx="1.6" />
    <rect x="14" y="4" width="7" height="7" rx="1.6" />
    <rect x="3" y="14" width="7" height="6" rx="1.6" />
    <rect x="14" y="14" width="7" height="6" rx="1.6" />
  </Svg>
);

export const IconChat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M8 9h8" />
  </Svg>
);

export const IconPartners = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="12" r="3.4" />
    <circle cx="16" cy="12" r="3.4" />
    <path d="M11.4 12h1.2" />
  </Svg>
);

export const IconTracking = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 11.5 21 4l-7.5 17-2.2-7.3z" />
  </Svg>
);

export const IconRequests = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 5h14" />
    <path d="M5 12h14" />
    <path d="M5 19h9" />
    <path d="M17 16v6" />
    <path d="M14 19h6" />
  </Svg>
);

export const IconAnalysis = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h16" />
    <path d="M7 20v-6" />
    <path d="M12 20V6" />
    <path d="M17 20v-9" />
  </Svg>
);

export const IconHistory = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4.5l3 1.8" />
    <path d="M4 3.5 5.5 6" />
  </Svg>
);

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Svg>
);

export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </Svg>
);

export const IconChevron = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Svg>
);

export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12h15" />
    <path d="M13 6l6 6-6 6" />
  </Svg>
);

export const IconArrowLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 12H5" />
    <path d="M11 6l-6 6 6 6" />
  </Svg>
);

export const IconTruck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 7h11v8H2z" />
    <path d="M13 10h4.2l2.8 3v2H13z" />
    <circle cx="6.5" cy="17.4" r="1.7" />
    <circle cx="17" cy="17.4" r="1.7" />
  </Svg>
);

export const IconCargo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
    <path d="M3 7l9 4 9-4" />
    <path d="M12 11v10" />
  </Svg>
);

export const IconRepair = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.5 3.5a4.5 4.5 0 0 0-4.3 6L3 16.7V21h4.3l7.2-7.2a4.5 4.5 0 0 0 6-6L16.5 12 12 7.5z" />
  </Svg>
);

export const IconDriver = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0" />
  </Svg>
);

export const IconReport = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6" />
    <path d="M9 17h4" />
  </Svg>
);

export const IconPhone = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.2 3h3.4l1.8 4.6-2.3 1.4a11.4 11.4 0 0 0 5.9 5.9l1.4-2.3L21 14.4v3.4A2.2 2.2 0 0 1 18.4 20C10.4 19.4 4.6 13.6 4 5.6A2.2 2.2 0 0 1 6.2 3z" />
  </Svg>
);

export const IconMessage = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5.5h16v10H9.5L5 19.3z" />
  </Svg>
);

export const IconZoomIn = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
    <path d="M8.4 11h5.2" />
    <path d="M11 8.4v5.2" />
  </Svg>
);

export const IconZoomOut = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
    <path d="M8.4 11h5.2" />
  </Svg>
);

export const IconScan = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8.5V6.5a3 3 0 0 1 3-3h2" />
    <path d="M21 8.5V6.5a3 3 0 0 0-3-3h-2" />
    <path d="M3 15.5v2a3 3 0 0 0 3 3h2" />
    <path d="M21 15.5v2a3 3 0 0 1-3 3h-2" />
    <path d="M7 12h10" />
  </Svg>
);

export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 11.2 12 4l8 7.2" />
    <path d="M6.4 10v10h11.2V10" />
    <path d="M10 20v-5h4v5" />
  </Svg>
);

export const IconOrders = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7.5h16V20H4z" />
    <path d="M4 7.5 6 4h12l2 3.5" />
    <path d="M9.5 12h5" />
  </Svg>
);

export const IconProfile = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="9" r="3.4" />
    <path d="M5.4 20a6.6 6.6 0 0 1 13.2 0" />
  </Svg>
);

export const IconBell = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 15.5v-5a6 6 0 1 0-12 0v5l-1.8 2.6h15.6z" />
    <path d="M10 21.2a2.2 2.2 0 0 0 4 0" />
  </Svg>
);

export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 11v5.5" />
    <path d="M12 7.6v.6" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
  </Svg>
);

export const IconDoc = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Svg>
);

export const IconThermo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 14.6V5.5a2 2 0 1 0-4 0v9.1a4 4 0 1 0 4 0z" />
    <path d="M12 17.6v-6" />
  </Svg>
);

export const IconFuel = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4.5h9v15H4z" />
    <path d="M13 9.5h3.2l2.8 3v7H13z" />
    <path d="M7 8.5h3" />
  </Svg>
);

export const IconGauge = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 18a8 8 0 1 1 16 0" />
    <path d="M12 18l4.4-5.4" />
  </Svg>
);

export const IconWeight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8.5h16L21.5 20h-19z" />
    <path d="M9 8.5a3 3 0 0 1 6 0" />
  </Svg>
);

export const IconCamera = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8.5h3.2L9.2 6h5.6l2 2.5H20V19H4z" />
    <circle cx="12" cy="13.4" r="3.2" />
  </Svg>
);

export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 16.5V4.5" />
    <path d="M7.5 9 12 4.5 16.5 9" />
    <path d="M4.5 20h15" />
  </Svg>
);

export const IconPin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21.2s6.8-6.4 6.8-11A6.8 6.8 0 1 0 5.2 10.2c0 4.6 6.8 11 6.8 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </Svg>
);

export const IconTurnLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 4v9.5a3 3 0 0 0 3 3h6" />
    <path d="M15 13.5 18 16.5 15 19.5" />
  </Svg>
);

export const IconTurnRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 4v9.5a3 3 0 0 1-3 3H6" />
    <path d="M9 13.5 6 16.5 9 19.5" />
  </Svg>
);

export const IconStraight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v16" />
    <path d="M8 8 12 4l4 4" />
    <path d="M8 16l4 4 4-4" />
  </Svg>
);

export const IconStar = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 4 2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.8-5 2.8 1-5.6-4-3.9 5.5-.8z" />
  </Svg>
);

export const IconFilter = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6.5h16" />
    <path d="M7 12h10" />
    <path d="M10 17.5h4" />
  </Svg>
);

export const IconMenu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h10" />
  </Svg>
);

export const IconBolt = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13.5 3 6 13.5h4.5L9.5 21 18 10.5h-4.5z" />
  </Svg>
);

export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 6.5V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1.5" />
  </Svg>
);

export const IconLayers = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3 9 5-9 5-9-5z" />
    <path d="m4.5 12.5 7.5 4.2 7.5-4.2" />
    <path d="m4.5 16.5 7.5 4.2 7.5-4.2" />
  </Svg>
);

export const IconGlobe = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M4 12h16" />
    <path d="M12 4c2.2 2.2 3.2 5 3.2 8s-1 5.8-3.2 8c-2.2-2.2-3.2-5-3.2-8s1-5.8 3.2-8z" />
  </Svg>
);

export const IconLock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
);

export const IconAlertCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </Svg>
);

export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const IconEyeOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </Svg>
);

export const IconKey = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5L11 9l-1.5-1.5L8 9a6 6 0 1 0 8.5 8.5l6.5-6.5V2h-2z" />
  </Svg>
);

/* ============================================================
   Canonical fleet category glyphs — one distinct silhouette per
   approved truck type so an operator can read the category from
   the icon alone. Same 24px grid, 1.8 stroke, round caps as the
   rest of this set; no decorative or generic substitutes.
   ============================================================ */

/** سطحة · Flatbed — open deck slab with stake pockets, no enclosed box. */
export const IconTruckFlatbed = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 10h4.2l2.8 3v2H13z" />
    <path d="M2 12.6h11v2.4H2z" />
    <path d="M3.6 12.6v-2.4" />
    <path d="M7.5 12.6v-2.4" />
    <path d="M11.4 12.6v-2.4" />
    <circle cx="6.5" cy="17.4" r="1.7" />
    <circle cx="17" cy="17.4" r="1.7" />
  </Svg>
);

/** براد · Refrigerated — insulated box with the nose cooling unit + snowflake. */
export const IconTruckReefer = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 10h4.2l2.8 3v2H13z" />
    <rect x="2" y="6.4" width="11" height="8.6" rx="1.2" />
    <path d="M10.1 6.4V4.4h2.6v2" />
    <path d="M6.4 8.9v4" />
    <path d="M4.7 9.9l3.4 2" />
    <path d="M8.1 9.9l-3.4 2" />
    <circle cx="6.5" cy="17.4" r="1.7" />
    <circle cx="17" cy="17.4" r="1.7" />
  </Svg>
);

/** جاف · Dry Van — fully enclosed box with rear double doors + handle. */
export const IconTruckDry = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 10h4.2l2.8 3v2H13z" />
    <rect x="2" y="6.4" width="11" height="8.6" rx="1.2" />
    <path d="M4.6 6.6v8.2" />
    <path d="M3.3 10.5h.9" />
    <circle cx="6.5" cy="17.4" r="1.7" />
    <circle cx="17" cy="17.4" r="1.7" />
  </Svg>
);

/** ستارة · Curtainsider — box with the roller top rail and curtain folds. */
export const IconTruckCurtain = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 10h4.2l2.8 3v2H13z" />
    <rect x="2" y="6.4" width="11" height="8.6" rx="1.2" />
    <path d="M2 8.2h11" />
    <path d="M4.9 8.4v6.4" />
    <path d="M7.5 8.4v6.4" />
    <path d="M10.1 8.4v6.4" />
    <circle cx="6.5" cy="17.4" r="1.7" />
    <circle cx="17" cy="17.4" r="1.7" />
  </Svg>
);

/* ---- Measurement & telemetry glyphs for the vehicle spec sheets ---- */

/** الطول · Length along the chassis. */
export const IconRuler = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 9h18v6H3z" />
    <path d="M7 9v2.4" />
    <path d="M11 9v3.4" />
    <path d="M15 9v2.4" />
    <path d="M19 9v3.4" />
  </Svg>
);

/** العرض · Horizontal measurement. */
export const IconWidth = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12h18" />
    <path d="M6 9l-3 3 3 3" />
    <path d="M18 9l3 3-3 3" />
    <path d="M3 5.5v13" />
    <path d="M21 5.5v13" />
  </Svg>
);

/** الارتفاع · Vertical measurement. */
export const IconHeight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v18" />
    <path d="M9 6l3-3 3 3" />
    <path d="M9 18l3 3 3-3" />
    <path d="M5.5 3h13" />
    <path d="M5.5 21h13" />
  </Svg>
);

/** التبريد · Cold chain. */
export const IconSnowflake = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v18" />
    <path d="M4.2 7.5l15.6 9" />
    <path d="M19.8 7.5l-15.6 9" />
    <path d="M9.6 4.8 12 6.9l2.4-2.1" />
    <path d="M9.6 19.2 12 17.1l2.4 2.1" />
  </Svg>
);

/** الحمولة / السعة · Payload & capacity. */
export const IconCapacity = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 8.5 12 4l8.5 4.5V16L12 20.5 3.5 16z" />
    <path d="M3.5 8.5 12 13l8.5-4.5" />
    <path d="M12 13v7.5" />
  </Svg>
);

/** عداد المسافة · Odometer. */
export const IconOdometer = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 17a8.5 8.5 0 1 1 17 0" />
    <path d="M12 17l3.6-4.6" />
    <path d="M4.6 12.2h1.6" />
    <path d="M17.8 12.2h1.6" />
    <path d="M12 4.6v1.6" />
  </Svg>
);

/** قوة المحرك · Horsepower. */
export const IconEngine = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9h2V7h4v2h3l3 3v5h-3v2H8v-2H6z" />
    <path d="M3 11h3v4H3z" />
  </Svg>
);

/** رقم اللوحة · Registration plate. */
export const IconPlate = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="7" width="19" height="10" rx="2" />
    <path d="M6.5 12h2.4" />
    <path d="M15.1 12h2.4" />
    <circle cx="12" cy="12" r="1.6" />
  </Svg>
);

/** الجهة المالكة · Owner / partner organisation. */
export const IconBuilding = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 21V5.5A1.5 1.5 0 0 1 5.5 4h7A1.5 1.5 0 0 1 14 5.5V21" />
    <path d="M14 10h4.5A1.5 1.5 0 0 1 20 11.5V21" />
    <path d="M2.5 21h19" />
    <path d="M7 8h4" />
    <path d="M7 12h4" />
    <path d="M7 16h4" />
  </Svg>
);

/** سنة الصنع · Model year. */
export const IconCalendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M3.5 10h17" />
    <path d="M8 3v4" />
    <path d="M16 3v4" />
  </Svg>
);

/** موديل المركبة · Model designation. */
export const IconTag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11.6 3H21v9.4l-8.7 8.7a1.6 1.6 0 0 1-2.3 0l-7.1-7.1a1.6 1.6 0 0 1 0-2.3z" />
    <circle cx="16.6" cy="7.4" r="1.5" />
  </Svg>
);

/** دوران كامل · Full 360° orbit. */
export const IconRotate360 = (p: IconProps) => (
  <Svg {...p}>
    <ellipse cx="12" cy="12" rx="9" ry="4.2" />
    <path d="M12 3.5v17" />
    <path d="M8.6 5.2 12 3.5l3.4 1.7" />
    <path d="M15.4 18.8 12 20.5l-3.4-1.7" />
  </Svg>
);


