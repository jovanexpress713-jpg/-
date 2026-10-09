import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { STATUS_LABEL } from "../data/catalog";
import type { Status } from "../data/types";

const TONE: Record<Status, string> = {
  active: "text-status-active",
  waiting: "text-status-waiting",
  inactive: "text-status-inactive",
};

export function StatusChip({
  status,
  className,
  showLabel = true,
}: {
  status: Status;
  className?: string;
  showLabel?: boolean;
}) {
  const { t } = useSettings();
  const label = STATUS_LABEL[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-label font-medium whitespace-nowrap",
        TONE[status],
        className,
      )}
    >
      <span className="relative flex h-[6px] w-[6px] shrink-0">
        <span className="absolute inset-0 animate-pulse-dot rounded-full bg-current" />
        <span className="relative h-[6px] w-[6px] rounded-full bg-current" />
      </span>
      {showLabel && t(label[0], label[1])}
    </span>
  );
}

export function StatusBadge({ status, count }: { status: Status; count: number }) {
  return (
    <span
      className={cn(
        "badge",
        status === "active" && "bg-status-active/15 text-status-active",
        status === "waiting" && "bg-status-waiting/15 text-status-waiting",
        status === "inactive" && "bg-status-inactive/15 text-status-inactive",
      )}
    >
      {count}
    </span>
  );
}
