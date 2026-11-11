/** Fixed text. Every token page carries it, word for word. */
export function NotTold() {
  return (
    <aside className="not-told" aria-labelledby="not-told-h">
      <h2 id="not-told-h">What this does not tell you</h2>
      <p>
        Datum checks claims against the chain as it is now. It does not tell you whether a token is a good idea, who is
        behind it, whether liquidity can be pulled, how much a few wallets hold, or whether a claim was made in good
        faith. A claim is a statement by a wallet. Each result shows the account that was read and the slot it was read at.
      </p>
    </aside>
  );
}
