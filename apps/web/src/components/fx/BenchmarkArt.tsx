import { addressMark, SEAL_ART, type STATE_ART } from "@/art/benchmark";

const ADDRESS_LABEL = "Address mark: made by Datum from the address";

export function AddressMark({ address }: { address: string }) {
  return (
    <span className="address-mark" role="img" title={ADDRESS_LABEL} aria-label={ADDRESS_LABEL}>
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: addressMark(address) }} />
    </span>
  );
}

export function StateArt({ kind }: { kind: (typeof STATE_ART)[number] }) {
  return <img className="state-art" src={`/art/${kind}.svg`} alt="" aria-hidden="true" width="112" height="80" />;
}

export function ArtSeal({ kind, id }: { kind: keyof typeof SEAL_ART; id?: string }) {
  return <span id={id} className={`art-seal art-seal--${kind}`}>{SEAL_ART[kind]}</span>;
}
