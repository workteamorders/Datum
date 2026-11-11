import { MEMO_MAX_BYTES } from "@/lib/memo";
import { formatInt } from "@/lib/view";
import { Ruler } from "./Ruler";

/** The exact bytes that will be written to the chain, and how much room is left. */
export function MemoPreview({ memo, bytes }: { memo: string; bytes: number }) {
  const over = bytes > MEMO_MAX_BYTES;
  return (
    <section className="memo" aria-labelledby="memo-h">
      <h3 id="memo-h">Memo preview</h3>
      <pre className="memo__text mono">{memo}</pre>
      <Ruler
        limit={MEMO_MAX_BYTES}
        max={640}
        now={bytes}
        limitLabel={`Largest allowed ${MEMO_MAX_BYTES} bytes`}
        nowLabel={over ? `${formatInt(bytes)} bytes, over by ${formatInt(bytes - MEMO_MAX_BYTES)}` : `${formatInt(bytes)} bytes`}
        ticks={[
          { at: 0, label: "0" },
          { at: 256, label: "256" },
          { at: 512, label: "512" },
          { at: 640, label: "640" },
        ]}
        description={
          over
            ? `Memo is ${bytes} bytes; the largest allowed is ${MEMO_MAX_BYTES}; over by ${bytes - MEMO_MAX_BYTES}.`
            : `Memo is ${bytes} bytes; the largest allowed is ${MEMO_MAX_BYTES}; within the limit.`
        }
      />
    </section>
  );
}
