---
name: electronics-fundamentals
description: Core principles of electronic circuits, semiconductor components, operational amplifiers, filters, and digital logic for embedded systems, signal processing, and power control applications.
origin: "Électronique - Fondements et applications (2e édition), Dunod; Pérez, Lagoute, Fourniols, Bouhours"
---

# Electronics Fundamentals

Essential knowledge for designing and troubleshooting circuits, selecting components, and applying analog/digital signal processing techniques.

## When to Activate

- Designing analog circuits with discrete or integrated components
- Selecting or troubleshooting diodes, transistors, or operational amplifiers
- Implementing signal conditioning, filtering, or amplification stages
- Building power control circuits (rectification, stabilization, switching)
- Analyzing circuit behavior using Thévenin/Norton/Millman equivalents
- Implementing active or passive filters for signal processing
- Designing digital logic or ADC/DAC interfaces

## Circuit Fundamentals

### Basic Laws & Theorems

- **Kirchhoff's laws**: voltage around any loop sums to zero; current into a node equals current out.
- **Thévenin equivalent**: any linear two-terminal network reduces to a single source `E_th` in series with `R_th`. Get `E_th` as the open-circuit voltage, `R_th` by passivating independent sources (short voltage sources, open current sources) and computing the equivalent resistance seen from the terminals.
- **Norton equivalent**: dual form — a current source `I_n = E_th / R_th` in parallel with `R_th`. Use Norton when the load impedance is small compared to the rest of the circuit (better numerical stability); use Thévenin otherwise.
- **Superposition**: with multiple independent sources, compute the response to each source alone (others passivated), then sum linearly. Valid only in linear circuits.
- **Millman's theorem**: fast nodal-voltage shortcut for computing the potential of a node connected to several branches. General form for a node A fed by conductances `G_i` at potentials `U_i`, plus any current sources `I_k` injected directly into the node:

  ```
  U_A = (Σ G_i · U_i + Σ I_k) / Σ G_i
  ```

  Apply it in circuits with several op-amps or resistive summing nodes — it is strictly a rewrite of the node law in terms of voltage, so it also works at the ground/mass node to check consistency.
- **Wheatstone bridge**: precision resistance measurement via null-voltage balance across two resistive dividers.

**Pitfall**: applying Millman's theorem to a node that also has a direct voltage source connected to it (not through a resistor) — that branch must be handled separately or converted to a Norton-equivalent current injection first.

### Impedance & Frequency Response

- **Impedance (Z)**: complex generalization of resistance; `Z_C = 1/(jωC)`, `Z_L = jωL`. Reactance introduces frequency-dependent phase shift, resistance does not.
- **Transfer function H(jω)**: ratio of output to input phasor; its magnitude gives gain vs. frequency, its argument gives phase shift.
- **Cutoff frequency `f_c`**: point where `|H|` drops 3 dB (to `1/√2` of its passband value). Filters are specified and compared relative to `f_c`.
- **Quality factor (Q)**: sharpness of a resonance or filter transition; high Q = narrow, peaked response, more sensitive to component tolerance.

## Semiconductor Components

### Diodes

Non-linear devices: conduct in forward direction, block in reverse. Real diodes are modeled piecewise-linearly around a threshold voltage `U_d` (≈0.6–0.7 V silicon) and a small dynamic (bulk) resistance `R_i`.

- **Rectifier diodes**: convert AC to DC; account for the forward drop `U_d` when sizing supply headroom.
- **Zener diodes**: designed to conduct in reverse once the voltage reaches a fixed threshold `U_z` (the Zener voltage, a few volts up to tens of volts). Three-segment piecewise model:

  ```
  I = 0                          for  -U_z < U < U_d   (blocked)
  I = (U - U_d) / R_i             for  U > U_d           (forward conduction)
  I = (U + U_z) / R_i'            for  U < -U_z          (Zener/reverse regulation)
  ```

  `R_i'` is the Zener dynamic resistance — very small, which is exactly why the reverse branch stays nearly flat and useful for voltage regulation and overvoltage clamping.
- **Thyristors**: controlled switches triggered by a gate pulse; once triggered they stay on until current drops below a holding value — used for power control (dimmers, motor drives).
- **TRIACs**: bidirectional thyristors for AC switching (both half-cycles).

**Common pitfall**: neglecting the forward-voltage drop and reverse-recovery time in fast-switching designs; also, forgetting a Zener needs a series current-limiting resistor sized so its operating current stays within the datasheet range (too little current = poor regulation, too much = excess dissipation).

### Transistors (Bipolar)

Current-amplifying device with current gain `β = I_c / I_b`. The intersection of the load line (drawn from the supply voltage and load resistance) with the transistor's characteristic curve gives the **operating point** (quiescent point, Q-point) — the DC bias around which the signal swings.

Two operating regions:

- **Linear (active)**: small-signal amplification; the Q-point sits mid-characteristic so the AC signal swings symmetrically without clipping. Used in audio and sensor front ends.
- **Saturation/cutoff**: on/off switching; the Q-point sits at either extreme of the load line. Used in logic and power switching.

Characterized by:
- **Collector-emitter voltage (V_ce)**: sets the operating point on the load line.
- **Base current (I_b)**: the input signal; determines collector current via `I_c = β · I_b`.
- **Thermal sensitivity**: `β` and `V_be` drift with temperature — a hot transistor drifts the Q-point, which can cause thermal runaway in poorly-biased stages.

**Best practice**: use matched transistor pairs (or on-chip arrays) to cancel offset drift in differential/analog stages; add emitter degeneration resistors for bias stability against `β` and temperature spread.

### Field-Effect Transistors (FET / JFET / MOSFET)

Voltage-controlled current sources with extremely high input impedance (>1 GΩ). The gate voltage modulates channel conductivity; conduction is through majority carriers only (no minority-carrier storage), so FETs switch faster and are more temperature-stable than bipolars.

- **Key advantage**: negligible loading on the driving signal source (ideal for high-impedance sensors, sample-and-hold buffers, analog switches).
- **Key disadvantage**: lower transconductance/voltage gain per stage than an equivalent bipolar transistor.
- **Applications**: high-impedance signal conditioning, analog switches, current sources, input stages of instrumentation amplifiers.

## Operational Amplifiers

High-gain, versatile integrated circuits for linear signal processing.

### Core Properties (ideal vs. real)

- **Very high open-loop gain** (>100 dB, i.e. >10^5): closed-loop behavior is set almost entirely by the feedback network, not by the op-amp itself — as long as loop gain stays large.
- **Negative feedback** sets the actual circuit gain (e.g. `G = -R_f/R_in` inverting). Positive feedback instead drives the op-amp into a comparator/oscillator regime.
- **Input impedance**: ideally infinite; real op-amps draw a small bias current into each input, which produces an output offset through any resistor it flows through.
- **Output impedance**: ideally zero; real op-amps have finite output drive current and non-zero output resistance, limiting load driving.
- **Slew rate (`v_m`)**: the maximum rate of change the output can follow, in V/µs. A large-amplitude, high-frequency signal exceeding the slew rate becomes a triangular wave instead of the intended shape — check `v_m ≥ 2π·f·V_peak` (full-power bandwidth) before trusting a design at high frequency/amplitude.
- **Input offset voltage (`U_off`) and bias current**: real, non-zero imperfections that add a small DC error at the output. In a DC-coupled inverting amplifier, `U_off` appears amplified by `(1 + R_f/R_in)` at the output; a series capacitor at the input blocks this DC term in AC-coupled stages. Many op-amps expose an external "offset null"/"balance" trim pin — otherwise, select a low-offset part rather than trying to compensate around it.

### Standard Configurations

- **Inverting amplifier**: gain `= -R_f/R_in`; 180° phase shift; input impedance = `R_in`.
- **Non-inverting amplifier**: gain `= 1 + R_f/R_g`; no phase inversion; very high input impedance.
- **Integrator**: `V_out ∝ -∫V_in dt`; useful for ramp generation and low-pass filtering of DC drift, but DC offset accumulates over time unless bled off by a parallel large resistor.
- **Differentiator**: `V_out ∝ -dV_in/dt`; amplifies high-frequency noise disproportionately — rarely used bare, usually combined with a series input resistor to tame gain at high frequency.
- **Summing amplifier**: weighted linear combination of multiple inputs, each scaled by its own input resistor ratio to `R_f`.

**Critical pitfall**: feedback instability at high frequencies (phase shift approaching 180° at unity loop gain causes oscillation) — always verify gain margin and phase margin, and confirm the op-amp's gain-bandwidth product supports the required closed-loop gain at the operating frequency.

## Passive & Active Filters

### Passive Filters (Resistor-Capacitor-Inductor)

- **Limitations**: frequency-dependent gain loss only; cannot amplify; loaded output impedance interacts with the following stage (cascading passive filter cells changes the combined response unless buffered).
- **Advantages**: no power supply required; simple, robust, no stability concerns.

### Active Filters (Op-Amp Based)

- **Sallen-Key topology**: single op-amp per second-order section, low sensitivity to component tolerances, non-inverting, easy to cascade for higher-order designs.
- **Rauch (multiple-feedback) cell**: inverting single-op-amp alternative to Sallen-Key, often preferred for higher Q.
- **Kerwin-Huelsman-Newcomb (KHN) / state-variable / "universal" filter**: three op-amps, simultaneously outputs low-pass, high-pass, and bandpass from one stage — useful when several filter responses are needed from the same input.
- **Filter order**: higher order → sharper roll-off past cutoff but more components and tighter tolerance sensitivity.
- **Butterworth response**: maximally flat in the passband, `|H(jω)|² = 1 / (1 + (ω/ω_c)^(2n))`; simplest to design when passband ripple must be zero, at the cost of a less steep transition than Chebyshev for the same order.
- **Gabarit (filter template/mask)**: the Bode-plane region (gain vs. frequency) that a design must stay within — passband ripple limit, stopband attenuation floor, and the transition band between them. Every design starts by drawing this mask before choosing topology/order.

Design workflow:
1. Specify cutoff frequency, Q (selectivity), and required order from the gabarit (attenuation vs. transition-width trade-off).
2. Choose topology (Butterworth for flat passband, Chebyshev for steeper roll-off with passband ripple, Sallen-Key/Rauch/KHN for the implementation).
3. Calculate component values from the standard normalized tables/formulas for the chosen response.
4. Verify stability and frequency response via simulation before build.

**Common error**: ignoring the op-amp's own bandwidth limit — its open-loop gain-bandwidth product must exceed the filter's cutoff frequency by a comfortable margin (rule of thumb ≥10×), otherwise the op-amp itself becomes the dominant, unintended pole and the measured response degrades from the design.

## Digital Logic & Conversion

### Boolean Algebra & Logic Gates

- **AND, OR, NOT**: basic operators; combined via De Morgan's laws (`NOT(A AND B) = (NOT A) OR (NOT B)`, and its dual) to convert between gate families (e.g. implement any function with only NAND gates).
- **Combinatorial logic**: output depends only on current inputs (no memory).
- **Sequential logic**: output depends on input history via flip-flops/latches (state/memory element).
- **Truth tables**: enumerate all input combinations and expected outputs — the baseline verification tool before simulation.

### Analog-to-Digital Conversion (ADC)

Quantizes a continuous analog voltage into discrete digital levels.

- **Resolution**: number of bits sets the step size; 8-bit = 256 levels, 12-bit = 4096 levels — higher resolution reduces quantization error but costs conversion time and often sample rate.
- **Sampling rate**: must exceed 2× the highest signal frequency of interest (Nyquist criterion), or higher-frequency content aliases back into the passband as false low-frequency signal.
- **Conversion time**: finite, non-zero latency per sample — bounds the usable sample rate and affects closed-loop control timing.

### Digital-to-Analog Conversion (DAC)

Reconstructs an analog signal from digital codes.

- **Settling time**: time to reach final output value within spec after a code change — critical when multiplexing a single DAC across several channels.
- **Glitch energy**: unwanted transient spikes during code transitions (e.g. major carry, 011...1 → 100...0), which a downstream reconstruction filter must attenuate.

## Best Practices

1. **Measure first**: use oscilloscope/multimeter before assuming a component has failed.
2. **Thermal design**: dissipate heat efficiently; track component temperatures under worst-case load, not just nominal.
3. **Component tolerances**: design assuming ±5% or ±10% component variation; verify the circuit still meets spec at the tolerance extremes.
4. **Frequency margins**: use frequency compensation and phase/gain-margin analysis, not guesswork, for any feedback loop.
5. **Power supply decoupling**: place bypass capacitors close to IC power pins (a bulk capacitor plus a small high-frequency capacitor per IC).
6. **Ground planes**: provide low-impedance return paths to prevent noise coupling between stages.

## Common Pitfalls

- Ignoring phase margin and gain margin in feedback systems → sustained oscillation.
- Neglecting op-amp input offset voltage and bias current → DC drift, especially with high feedback-resistor values.
- Exceeding an op-amp's slew rate at the required amplitude/frequency → triangular-wave distortion instead of the intended waveform.
- Using high-impedance nodes without buffering → noise pickup and signal loading.
- Designing filters without accounting for op-amp bandwidth → response degrades from the theoretical design past a certain frequency.
- Mismatched transistor pairs → poor temperature tracking in analog/differential stages.
- Applying Millman's theorem across a node with a direct (non-resistive) voltage source attached → incorrect result unless that branch is isolated first.
- Sampling below the Nyquist rate → aliasing corrupts the digitized signal irrecoverably.
- Over-driving logic inputs beyond rated levels → excessive supply current, noise margin loss, and long-term degradation.
- Inadequate heat dissipation → thermal runaway and early component failure.

## Checklist Before Prototyping

- [ ] Circuit analysis complete (Thévenin/Norton/Millman, frequency response, stability)
- [ ] Component datasheets reviewed (ratings, temperature range, thermal properties)
- [ ] Power supply adequate (current capacity, voltage regulation, ripple limits)
- [ ] Decoupling capacitors placed close to all ICs
- [ ] Input/output impedance matching verified
- [ ] Filter/amplifier frequency response verified via simulation, including op-amp bandwidth margin
- [ ] Feedback stability checked (gain and phase margin above the recommended threshold)
- [ ] Slew rate sufficient for the required output amplitude and frequency
- [ ] Protection circuits in place (diodes, fuses, current limits)
- [ ] Thermal analysis completed; cooling adequate if needed
- [ ] Board layout minimizes long signal paths and ground loops
