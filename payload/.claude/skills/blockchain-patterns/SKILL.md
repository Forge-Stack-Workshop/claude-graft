---
name: blockchain-patterns
description: Blockchain and smart contract patterns — consensus models, Solidity smart contract design (modifiers, require/revert/assert), Ethereum transaction lifecycle, wallets and key management, decentralized application (Dapp) architecture, and security patterns against common exploits.
origin: biblio
---

# Blockchain Patterns

Patterns for designing, coding, and securing blockchain applications and smart
contracts, grounded in the Ethereum/Solidity model of trust, integrity, and
decentralization.

## When to Activate

- Designing a smart contract's state, rules, and access control
- Choosing or explaining a consensus mechanism (proof of work vs proof of stake)
- Structuring a decentralized application (Dapp): contract + wallet + frontend
- Reviewing a smart contract for trust/integrity gaps or known exploits
- Managing wallets, private keys, or transaction signing
- Explaining gas, transaction lifecycle, or on-chain vs off-chain data tradeoffs
- Testing or deploying smart contracts to a test or public chain

## The 3 Ds of Blockchain

Every blockchain design decision maps back to three properties:

- **Decentralization** — no single party controls the ledger; participant nodes
  hold identical copies of the chain.
- **Disintermediation** — transactions execute without a trusted middleman
  (bank, escrow agent, broker).
- **Distribution** — the ledger (DLT, distributed ledger technology) is
  replicated across all participant nodes, not stored centrally.

Use these three as a checklist when someone proposes "putting X on a
blockchain" — if none of the three add value over a normal database, don't.

## Consensus Models

Consensus is how participant nodes agree on a single, consistent next block
without a central authority.

| Model | How it works | Tradeoff |
|---|---|---|
| Proof of Work (PoW) | Nodes ("miners") compete to solve a computational puzzle; winner appends the block | Secure, energy-intensive, slower finality |
| Proof of Stake (PoS) | Validators are chosen to propose/attest blocks proportional to staked value | Cheaper, faster, requires stake-slashing rules to punish misbehavior |
| Byzantine fault-tolerant consensus | Nodes vote across multiple rounds, tolerating a fraction of faulty/malicious nodes | Used in permissioned/consortium chains, fast finality, weaker decentralization |

Decision guide:

- Public, adversarial network with unknown participants → PoW or PoS.
- Permissioned consortium (known, semi-trusted participants) → BFT-style
  consensus, favor speed over open participation.
- Never assume "decentralized" implies "trustless" — permissioned chains trade
  decentralization for throughput and governance control.

## Smart Contract Trust & Integrity Patterns

A smart contract encodes rules once; every node re-executes and re-verifies
them. Three Solidity primitives implement trust and integrity:

- **`require(condition)`** — validates a precondition; reverts the whole
  transaction (no state change, gas up to that point still spent) if false.
  Use for input validation and access control checks.
- **`revert()`** — explicitly aborts and reverts state, with an optional
  reason string. Use for custom error branches that don't fit a single
  boolean condition.
- **`assert(condition)`** — checks an invariant that must never be false if
  the contract logic is correct. A failing `assert` signals a bug, not a bad
  input — reserve it for internal invariants, not user input validation.

```solidity
modifier onlyChairperson {
    require(msg.sender == chairperson);
    _;
}

modifier onlyMember {
    require(membership[msg.sender] == 1);
    _;
}

function vote(uint proposal) public onlyMember {
    require(!voters[msg.sender].voted, "Already voted");
    voters[msg.sender].voted = true;
    proposals[proposal].voteCount += 1;
}
```

**Modifiers separate verification from logic.** Define one modifier per rule,
apply it declaratively on the function signature (`onlyMember`,
`onlyChairperson`) instead of inlining checks in every function body. This
lets an auditor read the function signature and know every precondition
without reading the body.

## Contract State Design

- Model contract state with `struct` (a voter's/party's record) and `mapping`
  (address → record) — mirrors a row-keyed table, cheap on-chain lookups.
- Use `enum` for a finite set of phases/states (e.g. `Created`, `Voting`,
  `Ended`) and guard transitions with a phase-check modifier:

```solidity
modifier validPhase(Phase reqPhase) {
    require(state == reqPhase);
    _;
}
```

- Keep contract state minimal. Every stored byte costs gas on every write —
  push derived or bulky data off-chain (see next section) and store only
  the hash or reference on-chain.

## On-Chain vs Off-Chain Data

- **On-chain**: anything that needs the chain's integrity/immutability
  guarantee — ownership records, balances, votes, hashes/fingerprints of
  external documents.
- **Off-chain**: bulky data (documents, images, large datasets) stored in a
  regular database or file store; the contract stores only a hash or URI
  pointing to it, verifiable against the off-chain copy.
- Rule of thumb: if a field is rarely read on-chain and expensive to store,
  it belongs off-chain with an on-chain fingerprint.

## Transaction Lifecycle & Gas

- A transaction (Tx) is signed off-chain with the sender's private key,
  broadcast to the network, picked up by a node, executed, and — once
  consensus is reached — permanently recorded in a block.
- **Gas** is the fee unit for computation/storage; every opcode has a gas
  cost. Set a **gas limit** high enough for the operation but not unbounded —
  it caps worst-case cost if the transaction loops or fails partway.
- A reverted transaction (failed `require`/`revert`) still consumes gas up to
  the point of failure — validate cheap conditions first to fail fast and
  minimize wasted gas.
- Design functions to do the minimum on-chain work; batch or precompute
  off-chain wherever the trust guarantee doesn't require on-chain execution.

## Wallets & Key Management

- A wallet holds the account's **private key** and derives the **public
  key**/address from it; it signs transactions locally before broadcast — the
  private key never leaves the wallet.
- **Mnemonic (seed phrase)**: a human-readable encoding of the private key
  generation seed. Treat it exactly like the private key itself — anyone with
  the mnemonic controls the funds/permissions.
- Separate wallet roles by environment: a dedicated test-chain account for
  development/testing, a distinct account for anything touching real value.
  Never reuse a production private key in a test/dev configuration.
- A browser-extension wallet (signing plugin pattern) mediates between the
  Dapp frontend and the chain: the frontend requests a signature, the wallet
  prompts the user, the user approves, only then is the transaction
  broadcast. Never have the Dapp backend hold or transmit a user's private key.

## Dapp Architecture

A decentralized application separates into three tiers:

1. **Smart contract** — the on-chain logic and state (the trust boundary).
2. **Wallet/signing layer** — mediates identity and transaction approval,
   external to the Dapp's own code.
3. **Frontend/web client** — calls the contract via an RPC/API layer (e.g. a
   JSON-RPC provider), reads state, and submits signed transactions relayed
   through the wallet.

Keep business rules in the contract, not the frontend — the frontend is
convenience/UX only; anyone can bypass it and call the contract directly, so
every rule that must hold has to be enforced in contract code.

## Security Patterns

Known-exploit classes to check for in any contract review:

- **Reentrancy** — an external call in a function lets the callee re-enter
  before the caller's state update completes, draining funds across repeated
  calls. Fix: update state *before* making external calls (checks-effects-
  interactions pattern), or guard with a reentrancy lock.
- **Unrestricted access to privileged functions** — a fund-transferring or
  ownership-changing function missing an `onlyOwner`/`onlyChairperson`-style
  modifier is callable by anyone. Every state-mutating function needs an
  explicit access modifier, not an implicit assumption.
- **Trusting `msg.sender` without validation** — always compare `msg.sender`
  against an authorized address/mapping before honoring a privileged request.
- **Integer overflow/underflow** — arithmetic wrapping silently past
  min/max bounds; use a checked-arithmetic-safe compiler version/library.
- **Unbounded loops over dynamic arrays** — a loop whose length is
  attacker-influenced can exceed the block gas limit and permanently brick
  the function (denial of service).

## Testing & Deployment

- Write incremental contract versions (e.g. add state → add access rules →
  add trust checks) so each version is independently testable — mirrors the
  book's `BallotV1..V4` progression: start with plain state, then layer in
  modifiers, then `require`/`revert`/`assert`.
- Automate contract tests (JS-based test framework against a local test
  chain) covering: happy path, each `require` failure path, and each
  access-control rejection path — a passing suite with no negative-path
  coverage is incomplete.
- Deploy to a public test chain before mainnet; verify the deployed bytecode
  and constructor arguments match the audited source before promoting.
- Never commit a mnemonic, private key, or `.env` file with chain credentials
  to source control — load them via a provider/HD-wallet abstraction that
  reads from an untracked secrets file or environment variable.

## Common Pitfalls

- Skipping the checks-effects-interactions ordering, opening a reentrancy
  window on any function that sends funds externally.
- Enforcing rules only in the frontend, leaving the contract itself callable
  without validation.
- Reusing a real-funds private key/mnemonic in test or CI configuration.
- Storing bulky data on-chain instead of a hash/reference to off-chain storage.
- Treating `assert` as input validation — it should only guard invariants
  that indicate a contract bug if false, not user-controlled conditions.
- Unbounded gas cost from a loop or storage growth with no cap, risking a
  transaction that can never complete within the block gas limit.
- Confusing "decentralized" with "trustless": a permissioned/consortium
  chain still requires trusting the validator set's governance rules.
