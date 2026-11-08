---
name: embedded-c-patterns
description: Bare-metal embedded C patterns for ARM Cortex-M microcontrollers—register access, clock gating, GPIO/timer/UART drivers, interrupt handling, memory constraints, linker scripts, and startup code.
origin: "Bare-Metal Embedded C Programming (Packt), Chapters 1–2"
version: 1.0
applies_to:
  - "**/*.c"
  - "**/*.h"
  - "**/linker_scripts/**"
  - "**/startup/**"
keywords:
  - "bare-metal"
  - "embedded"
  - "register"
  - "MMIO"
  - "ARM"
  - "Cortex-M"
  - "GPIO"
  - "clock-gating"
  - "interrupt"
  - "linker"
---

# Embedded C Patterns — Bare-Metal ARM Cortex-M Development

Bare-metal embedded C bypasses abstraction layers (HAL, RTOS) to access hardware directly via
memory-mapped I/O (MMIO). This enables full hardware control, deterministic timing, and minimal
code/RAM footprint — at the cost of manual register bookkeeping, no runtime safety net, and
platform-specific code. The patterns below generalize across Cortex-M families (STM32, NXP
Kinetis, Nordic nRF, TI Tiva); addresses and bit positions always come from the target's
reference manual, never assumed.

**Use this skill when:**
- Writing firmware that runs directly on microcontroller hardware (no OS, no HAL).
- Configuring peripherals (GPIO, timers, UART, ADC, SPI, I2C) at the register level.
- Implementing interrupt handlers (ISRs) or time-critical, deterministic code.
- Writing or reviewing startup code and linker scripts.
- Debugging hard faults, missed interrupts, or corrupted globals in constrained-RAM firmware.

**Do not use this skill for:** RTOS task design, HAL/CMSIS-driver-based application code, or
Linux-userspace embedded work (those need different concurrency and memory models).

______________________________________________________________________

## 1. Registers, MMIO, and `volatile`

Every peripheral is a block of registers at a fixed physical address, defined by the vendor's
memory map. Always declare register accesses as `volatile` — the compiler must reload the value
from memory on every access, because the value can change from hardware (interrupt, DMA, external
pin) between reads, not just from program flow.

```c
#define GPIOA_BASE      0x40020000UL
#define GPIOA_MODER     (*(volatile uint32_t *)(GPIOA_BASE + 0x00))
#define GPIOA_ODR       (*(volatile uint32_t *)(GPIOA_BASE + 0x14))
#define GPIOA_IDR       (*(volatile uint32_t *)(GPIOA_BASE + 0x10))

// Prefer a typed struct overlay over ad-hoc macros for multi-register peripherals:
typedef struct {
    volatile uint32_t MODER;
    volatile uint32_t OTYPER;
    volatile uint32_t OSPEEDR;
    volatile uint32_t PUPDR;
    volatile uint32_t IDR;
    volatile uint32_t ODR;
} GPIO_TypeDef;
#define GPIOA  ((GPIO_TypeDef *)GPIOA_BASE)

GPIOA_MODER |= (1U << 10);   // set bit 10 (read-modify-write)
GPIOA_MODER &= ~(1U << 11);  // clear bit 11
```

**Rules:**
- Register pointers are always `volatile`; the struct-overlay pattern still needs `volatile`
  members, not a `volatile` pointer to a non-volatile struct.
- Read-modify-write (`|=`, `&=`) is not atomic. If an ISR touches the same register, disable that
  interrupt (or use a bit-band / atomic-set-clear register when the peripheral provides one)
  around the sequence.
- Never cache a register's value in a plain (non-volatile) local across a delay or wait loop —
  the compiler may hoist the read out of the loop and spin forever on a stale value.
- Bit positions and field widths belong in named constants (`GPIO_MODER_MODE5_Pos`), never magic
  numbers, so the intent survives a register-map revision.

## 2. Clock Gating

Peripherals are clock-gated off by default to save power; a register write before the clock is
enabled either has no effect or faults. Always enable the peripheral clock first, and insert a
short delay (a few dummy reads of the enable register) before the first access, since the clock
domain crossing takes a cycle or two to propagate.

```c
#define RCC_AHB1ENR   (*(volatile uint32_t *)(RCC_BASE + 0x30))

RCC_AHB1ENR |= (1U << 0);          // enable GPIOA clock
(void)RCC_AHB1ENR;                 // dummy read: let the clock domain settle
GPIOA_MODER |= (1U << 10);         // now safe to configure
```

Symptom of skipping this: the peripheral silently ignores writes (reads back the reset value),
which looks like a wiring fault, not a software bug — check the clock-enable register first when
a peripheral "does nothing."

## 3. GPIO Driver Pattern

```c
void gpio_configure_output(GPIO_TypeDef *port, uint32_t pin) {
    port->MODER &= ~(0x3U << (pin * 2));
    port->MODER |=  (0x1U << (pin * 2));   // 01 = general-purpose output
    port->OTYPER &= ~(1U << pin);           // push-pull
}

void gpio_write(GPIO_TypeDef *port, uint32_t pin, bool high) {
    if (high) {
        port->ODR |= (1U << pin);
    } else {
        port->ODR &= ~(1U << pin);
    }
}

bool gpio_read(const GPIO_TypeDef *port, uint32_t pin) {
    return (port->IDR & (1U << pin)) != 0;
}
```

Prefer atomic bit-set/bit-reset registers (`BSRR` on STM32: high halfword clears, low halfword
sets) over `ODR |=`/`&=` when available — a single write, no read-modify-write race with an ISR.

## 4. Timer Driver Pattern

Timers generate periodic interrupts or PWM without CPU polling. Minimal periodic-tick setup:

```c
void timer_init_periodic(uint32_t period_ticks) {
    TIM2->PSC = 8399;                 // prescaler: divide input clock (e.g. 84 MHz -> 10 kHz)
    TIM2->ARR = period_ticks - 1;     // auto-reload value -> interrupt period
    TIM2->DIER |= (1U << 0);          // enable update interrupt
    TIM2->CR1 |= (1U << 0);           // enable counter
    NVIC_ISER0 |= (1U << TIM2_IRQn);
}

void TIM2_IRQHandler(void) {
    if (TIM2->SR & (1U << 0)) {       // check update-interrupt flag
        TIM2->SR &= ~(1U << 0);       // clear flag FIRST — before doing work
        tick_count++;
    }
}
```

Clear the interrupt's pending/status flag before (or at the very start of) handling it, not after
— clearing late risks a second edge arriving during handling and being silently swallowed by the
NVIC on some cores.

## 5. UART Driver Pattern (polled vs interrupt-driven)

```c
// Polled TX — simple, blocks the CPU; fine for logging, wrong for real-time paths.
void uart_send_byte(uint8_t byte) {
    while (!(USART2->SR & (1U << 7))) { }   // wait for TXE (transmit register empty)
    USART2->DR = byte;
}

// Interrupt-driven RX into a ring buffer — non-blocking, bounded latency.
void USART2_IRQHandler(void) {
    if (USART2->SR & (1U << 5)) {           // RXNE: data received
        uint8_t byte = (uint8_t)USART2->DR; // reading DR clears RXNE
        ring_buffer_push(&rx_buf, byte);
    }
}
```

Reading the data register clears the RX-not-empty flag on most UART peripherals — do it exactly
once per interrupt, never speculatively, or bytes get dropped.

## 6. Interrupts & ISR Discipline

```c
void EXTI0_IRQHandler(void) {
    if (EXTI->PR & (1U << 0)) {
        EXTI->PR |= (1U << 0);      // write-1-to-clear the pending bit
        button_pressed_flag = 1;    // defer real work to main loop
    }
}
```

**Rules:**
- Keep ISRs short: clear the flag, capture the minimal data, set a `volatile` flag or push to a
  lock-free ring buffer, return. Do the real work in `main()`'s loop, polling the flag.
- Any variable shared between an ISR and `main()` must be `volatile`; if it's wider than the
  processor's atomic access width (e.g. a 64-bit counter on a 32-bit core) it also needs an
  explicit critical section (disable that interrupt / `__disable_irq()`) around both sides.
- Register the handler name exactly as the vendor's startup file / vector table expects
  (`USART2_IRQHandler`, not `usart2_isr`) — a name mismatch falls back to the weak default handler
  and the interrupt appears to "never fire."
- Enable the interrupt in the NVIC (`NVIC_ISER`) only after the peripheral is fully configured —
  otherwise a spurious first interrupt can fire against half-initialized state.
- Prioritize interrupts deliberately (`NVIC_SetPriority`); an unprioritized time-critical ISR can
  be starved by a lower-priority-but-registered-first one on some vector layouts.

## 7. Startup Code & Linker Script

Bare-metal has no OS to set up the C runtime — startup code and the linker script do it together.

**Startup code responsibilities:**
1. Set the initial stack pointer (from the linker-provided `_estack` symbol).
2. Copy `.data` (initialized globals) from flash to RAM.
3. Zero `.bss` (uninitialized globals).
4. Call any C++ static constructors, if applicable.
5. Call `main()`.
6. Populate the exception/interrupt vector table (reset handler, hard fault, each peripheral IRQ).

```c
extern uint32_t _sidata, _sdata, _edata, _sbss, _ebss, _estack;
extern int main(void);

void Reset_Handler(void) {
    uint32_t *src = &_sidata, *dst = &_sdata;
    while (dst < &_edata) { *dst++ = *src++; }        // copy .data from flash
    for (dst = &_sbss; dst < &_ebss; dst++) { *dst = 0; } // zero .bss
    main();
    while (1) { }   // main() must never return on bare metal
}

__attribute__((section(".isr_vector")))
void (* const vector_table[])(void) = {
    (void (*)(void))&_estack,   // initial stack pointer
    Reset_Handler,
    NMI_Handler,
    HardFault_Handler,
    // ... remaining exceptions, then peripheral IRQs in vendor-defined order
};
```

**Linker script responsibilities:** define memory regions (FLASH/RAM origin + length from the
datasheet) and place sections into them.

```ld
MEMORY {
    FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 512K
    RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 128K
}

SECTIONS {
    .isr_vector : { KEEP(*(.isr_vector)) } > FLASH
    .text       : { *(.text*) *(.rodata*) } > FLASH
    .data : {
        _sdata = .;
        *(.data*)
        _edata = .;
    } > RAM AT> FLASH
    _sidata = LOADADDR(.data);
    .bss : {
        _sbss = .;
        *(.bss*) *(COMMON)
        _ebss = .;
    } > RAM
    _estack = ORIGIN(RAM) + LENGTH(RAM);   // stack grows down from top of RAM
}
```

The `AT> FLASH` clause is what makes `.data` live in flash at load time but RAM at run time — the
startup code's flash-to-RAM copy loop depends on this split (`_sidata` vs `_sdata`).

## 8. Memory Constraints

- Total RAM is typically tens to a few hundred KB — every global/static variable is a permanent
  reservation for the whole program's lifetime; prefer stack-local or reused scratch buffers.
- The stack and heap (if `malloc` is used at all) share the remaining RAM after `.data`/`.bss` —
  size the stack generously (worst-case nested calls + ISR nesting) and place a guard/canary
  region, since there's no MMU to catch a stack-into-heap overrun.
- Avoid dynamic allocation on the hot path; prefer static or pool allocation — fragmentation on a
  32 KB heap is fatal in ways it isn't on a desktop.
- `const` data (lookup tables, format strings) belongs in flash (`.rodata`), not RAM — verify the
  linker script places it there, not accidentally copied into `.data`.
- Use fixed-width types (`uint8_t`, `int32_t` from `<stdint.h>`) everywhere a register width or
  wire-format size matters — `int`/`long` width is not guaranteed across toolchains.

______________________________________________________________________

## Common Pitfalls

1. **Missing `volatile`** — compiler caches a register or ISR-shared flag in a register/optimizes
   away the "redundant" reload; the poll loop spins forever or reads stale data.
2. **Non-atomic read-modify-write raced by an ISR** — `REG |= bit` reads, modifies, writes; an
   interrupt between the read and write that also touches `REG` loses one of the two updates.
3. **Peripheral clock not enabled before configuration** — writes silently no-op; looks like a
   hardware fault.
4. **Clearing the interrupt flag after handling instead of before/first** — a second edge during
   handling can be missed depending on the NVIC's pending-bit semantics.
5. **ISR name mismatch with the vendor vector table** — falls back to the weak default handler;
   interrupt "never fires" with no compiler warning.
6. **No exception vector table, or table not placed at address 0 / VTOR mismatch** — any fault or
   interrupt has nowhere to dispatch → hard fault or lockup.
7. **`main()` returning** — undefined on bare metal (nothing to return to); always end in an
   infinite loop or low-power wait.
8. **`.data`/`.bss` not initialized by startup code** (or linker script missing the flash/RAM
   split) — globals read garbage or stale flash contents on first access.
9. **Stack overflow into `.bss`/`.data`** — no MMU to fault on this; corrupts unrelated globals,
   producing symptoms far from the real cause (classic "heisenbug" in embedded).
10. **Long-running or blocking code inside an ISR** — starves lower-priority interrupts, blows
    real-time deadlines; defer work to the main loop via a flag or queue.
11. **Bloated startup/init code** — every enabled peripheral and unnecessary `memset` costs boot
    time and code size; initialize only what the firmware actually uses.
12. **Assuming a register layout across MCU families** — bit positions and even register offsets
    differ between vendors and often between variants of the same vendor's family; always check
    the specific part's reference manual, never copy addresses from another board's code.

______________________________________________________________________

## References

- Vendor reference manual for the specific MCU part (register maps, reset values, clock tree).
- **ARM Cortex-M Generic User Guide** — NVIC, exception model, core peripherals (SysTick, SCB).
- **GNU Arm Embedded Toolchain** — `arm-none-eabi-gcc`, `-mcpu=cortex-m4 -mthumb` flags.
- **OpenOCD** — debugging and firmware download via JTAG/SWD.
- *Bare-Metal Embedded C Programming* (Packt) — startup code, linker scripts, register-level
  peripheral configuration.
