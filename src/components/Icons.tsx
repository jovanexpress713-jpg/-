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
