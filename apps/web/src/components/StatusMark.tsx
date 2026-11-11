import { STATUS_LABEL, type Status } from "@/lib/view";

/**
 * Four distinct shapes, readable without colour:
 *   true          filled disc with a cross
 *   false         ring with an X
 *   cannot_check  dashed ring
 *   unsupported   ring with a centre dot
 */
export function StatusMark({ status, withLabel = false, label: wording }: { status: Status; withLabel?: boolean; label?: string }) {
  const label = wording ?? STATUS_LABEL[status];
  return (
    <span className="status-mark">
      <svg
        className={`status-mark__svg status-mark__svg--${status}`}
        width="20"
        height="20"
        viewBox="0 0 20 20"
        role={withLabel ? undefined : "img"}
        aria-label={withLabel ? undefined : label}
        aria-hidden={withLabel ? true : undefined}
        focusable="false"
      >
        {status === "true" && (
          <>
            <circle className="sm-fill" cx="10" cy="10" r="9" />
            <line className="sm-knock" x1="5" y1="10" x2="15" y2="10" />
            <line className="sm-knock" x1="10" y1="5" x2="10" y2="15" />
          </>
        )}
        {status === "false" && (
          <>
            <circle className="sm-ring" cx="10" cy="10" r="8.2" />
            <line className="sm-ring" x1="6.5" y1="6.5" x2="13.5" y2="13.5" />
            <line className="sm-ring" x1="13.5" y1="6.5" x2="6.5" y2="13.5" />
          </>
        )}
        {status === "cannot_check" && <circle className="sm-dash" cx="10" cy="10" r="8.2" />}
        {status === "unsupported" && (
          <>
            <circle className="sm-ring" cx="10" cy="10" r="8.2" />
            <circle className="sm-dot" cx="10" cy="10" r="2.2" />
          </>
        )}
      </svg>
      {withLabel && <span className="status-mark__label">{label}</span>}
    </span>
  );
}
