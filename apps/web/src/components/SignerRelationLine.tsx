import { RELATION_LABEL, shortAddress, type RelationKind } from "@/lib/view";

/** Shows how the publishing wallet relates to the token, as is. Never a verdict. */
export function SignerRelationLine({ publisher, relations }: { publisher: string; relations: readonly RelationKind[] }) {
  const text = relations.length ? relations.map((r) => RELATION_LABEL[r]).join("; ") : "Relation not checked";
  return (
    <p className="relation">
      <span className="relation__by">Published by</span> <code className="relation__who">{shortAddress(publisher)}</code>
      <span className="relation__sep" aria-hidden="true"> · </span>
      <span className="relation__what">{text}</span>
    </p>
  );
}
