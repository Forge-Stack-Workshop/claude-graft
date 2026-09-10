---
name: osi-model-analysis
description: >-
  Network analysis framework built on the 7 layers of the OSI reference model.
  Use this skill whenever the user mentions OSI, network layers, "which layer",
  layer numbers (L1–L7), classifying a protocol or a piece of network equipment
  onto a layer, diagnosing a network fault layer by layer, or wants to explain a
  networking concept by traversing the stack (encapsulation/decapsulation).
  Trigger even when the user doesn't say "OSI" explicitly — e.g. "is a switch
  layer 2 or 3?", "where does TLS sit?", "my connection is flaky, help me isolate
  the problem", "walk me through what happens when I load a web page". Covers
  three modes: classifying a protocol/device onto a layer, explaining a concept
  layer by layer, and troubleshooting a network fault bottom-up (L1→L7).
origin: chrysa
---

# OSI Model Analysis

The OSI model is a **7-layer reference model** for reasoning about networking.
Each layer has a single responsibility, talks only to the layers directly above
and below it, and adds/reads its own header (encapsulation). Use it as a *mental
map*: to classify where something belongs, to explain a concept without skipping
steps, or to isolate a fault methodically.

> **Read first, then act.** For deeper questions, load the reference files:
> - Mapping to the real world (TCP/IP) and classic classification traps →
>   `references/osi-vs-tcpip.md`
> - Fault-isolation checklist with CLI tools → `references/troubleshooting.md`

## The 7 layers (top → bottom)

| # | Layer | Role (one line) | PDU | Examples (protocols / equipment) |
|---|-------|-----------------|-----|----------------------------------|
| 7 | Application | Interface to the user/app; the actual service | Data | HTTP(S), DNS, SMTP, FTP, SSH, DHCP, gRPC · *proxy, WAF, API gateway* |
| 6 | Presentation | Encoding, serialization, encryption, compression | Data | TLS/SSL*, ASCII/UTF-8, JPEG, JSON/XML, ASN.1, gzip |
| 5 | Session | Opens/manages/closes dialogues between hosts | Data | NetBIOS, RPC, PPTP, SOCKS, session tickets |
| 4 | Transport | End-to-end delivery, ports, reliability, flow ctrl | Segment (TCP) / Datagram (UDP) | TCP, UDP, QUIC*, SCTP · *L4 load balancer, stateful firewall* |
| 3 | Network | Logical addressing + routing between networks | Packet | IP(v4/v6), ICMP, OSPF, BGP, IPsec · *router, L3 switch* |
| 2 | Data Link | Framing + local delivery on one link (MAC) | Frame | Ethernet, Wi-Fi (802.11), ARP, VLAN, PPP · *switch, bridge, NIC* |
| 1 | Physical | Bits on the wire: signals, voltage, media | Bit | Copper/fiber/radio, RJ45, 1000BASE-T · *hub, cable, repeater* |

\* = notorious "overlapping" cases — see the traps in `references/osi-vs-tcpip.md`.

**Encapsulation direction:** sending goes **down** the stack (L7→L1), each layer
wrapping the previous PDU in its own header; receiving goes **up** (L1→L7),
each layer stripping its header. `Data → Segment → Packet → Frame → Bits`.

## Mnemonics (both directions)

- **L7 → L1** (top-down): *"All People Seem To Need Data Processing"*
  — **A**pplication, **P**resentation, **S**ession, **T**ransport, **N**etwork,
  **D**ata Link, **P**hysical.
- **L1 → L7** (bottom-up): *"Please Do Not Throw Sausage Pizza Away"*
  — **P**hysical, **D**ata Link, **N**etwork, **T**ransport, **S**ession,
  **P**resentation, **A**pplication.

Pick the bottom-up version when troubleshooting (you diagnose from L1 up).

## Mode 1 — Classify a protocol or device onto a layer

Use when the user asks "which layer is X?" / "is a switch L2 or L3?".

1. Identify the **primary unit of work**: bits → L1, frames/MAC → L2,
   IP/routing → L3, ports/end-to-end → L4, encoding/crypto → L6, the app
   service itself → L7. This "what does it fundamentally address/deliver?"
   question resolves most cases.
2. **Name the layer, its number, and the PDU**, then give one sentence of
   justification tied to the role.
3. **Flag overlaps honestly.** Many real things span layers (a "L3 switch"
   routes *and* switches; TLS is often taught at L6 but rides on L4 and is
   arguably L5–6; QUIC does transport at L4 but over UDP and includes crypto).
   Say the common answer *and* the nuance rather than pretending it's clean.
   Details and the canonical traps: `references/osi-vs-tcpip.md`.

**Example**
Input: "Which layer is a firewall on?"
Output: "Depends on the firewall. A classic packet filter/stateful firewall
works at **L3–L4** (IP addresses, ports, TCP state). A next-gen / application
firewall (WAF) inspects payloads at **L7**. So: 'firewall' isn't one layer —
name the type first."

## Mode 2 — Explain a concept layer by layer

Use when the user wants to understand *how something works across the stack*
(e.g. "what happens when I open a website?").

1. State the concept, then walk the relevant layers **in the direction the data
   flows** — top-down for a request being sent, bottom-up for one being received.
2. At each layer, say **what that layer adds or does** and **why the layer below
   is needed**. This is the encapsulation story: each header answers a question
   the lower layer will ask ("which port?", "which host?", "which NIC?").
3. Keep layers the concept doesn't touch brief or skip them, but say you're
   skipping them — don't silently drop L5–L6.

**Example skeleton for "loading `https://site.com`":**
DNS (L7) resolves the name → TCP handshake (L4) opens a connection to port 443
→ TLS (L6/L5) negotiates encryption → HTTP request (L7) is sent → each segment
becomes an IP packet (L3) routed hop-by-hop → framed as Ethernet/Wi-Fi (L2) for
each link → transmitted as signals (L1). The reply climbs back up the stack.

## Mode 3 — Troubleshoot a fault bottom-up (L1 → L7)

Use when something "doesn't work" and the cause is unknown. Diagnose **from the
bottom up**: a broken lower layer makes every layer above it fail, so confirming
L1–L2 first avoids chasing phantom application bugs.

Quick heuristic (the fast isolation path — full checklist in
`references/troubleshooting.md`):

1. **L1 Physical** — link light, cable, interface up? (`ip link`)
2. **L2 Data Link** — MAC/ARP, VLAN, local switch reachable? (`ip neigh`, `arp`)
3. **L3 Network** — got an IP + gateway? can you ping the gateway, then a public
   IP like `1.1.1.1`? (`ip addr`, `ping`, `traceroute`)
4. **L4 Transport** — is the port open / listening / not firewalled?
   (`ss -tulpn`, `nc -vz host port`)
5. **L5–L6 Session/Presentation** — TLS handshake, cert valid?
   (`openssl s_client -connect host:443`)
6. **L7 Application** — DNS resolves? does the app-level request succeed?
   (`dig`, `curl -v`)

The tell: **ping by IP works but by name fails → DNS (L7), not the network.**
**Ping fails to gateway → stop, it's L1–L3, don't touch the app.** This "lowest
failing layer wins" rule is the whole point of going bottom-up.

## Key rules to keep in mind

- **OSI is a *reference model*, not what runs.** Real networks run the **TCP/IP**
  stack (4 or 5 layers). OSI is the shared vocabulary for reasoning and teaching;
  don't claim packets carry an "OSI layer 5 header." See `references/osi-vs-tcpip.md`.
- **Layers 5 and 6 are fuzzy.** Session and Presentation rarely map to distinct
  real protocols; TCP/IP folds them into the Application layer. When unsure, say
  so instead of forcing a crisp assignment.
- **Many things straddle layers.** Switches (L2, but "L3 switches" route),
  TLS (L6-ish, but tied to L4/L5), QUIC (L4 transport carrying L5–L7 concerns),
  gateways/proxies (L7 but sit inline with L3–L4). Give the standard answer and
  name the overlap — precision here is the value you add.
