---
name: embedded-linux
description: Embedded Linux system design, cross-compilation toolchains, bootloader configuration (U-Boot), kernel compilation and drivers, root filesystem construction, build system automation (Yocto/Buildroot), device tree configuration, systemd/init, OTA updates, and security hardening for resource-constrained embedded devices.
origin: Mastering Embedded Linux Development (6th ed.)
---

# Embedded Linux Development

Build optimized Linux systems for embedded devices from bootloader to userland.

## Prerequisites (preflight)

```bash
command -v bitbake || echo "WARN: set up Yocto/Poky (bitbake) or Buildroot"
```

## When to Activate

- Designing a cross-compiled embedded system (ARM, RISC-V, MIPS boards)
- Setting up a development workflow for single-board computers (Raspberry Pi, BeaglePlay, custom SoMs)
- Configuring bootloaders, device trees, or a secure boot chain for custom hardware
- Automating builds with Yocto or Buildroot
- Choosing an init system or debugging boot/service startup
- Planning in-field device updates (OTA) or firmware rollback strategies
- Hardening a Linux image against memory/storage constraints or attack surface

## System Stack

An embedded Linux system consists of four layers, built sequentially and validated bottom-up:

1. **Toolchain** — Cross-compiler (GCC/Clang), binutils, libc (glibc/musl/uClibc-ng), kernel headers
2. **Bootloader** — U-Boot (or TF-A + U-Boot on ARMv8), initializes DRAM, loads kernel via device tree
3. **Kernel** — Configured for target CPU (ARM EABI/EABIHF, AArch64, RISC-V), device drivers, optional initramfs
4. **Root filesystem** — Minimal sysroot with init system, libraries, userland tools

Choose your C library early: **glibc** (full POSIX, largest), **musl** (small, static-friendly, embedded-first), **uClibc-ng** (legacy, MMU-less targets). The toolchain must stay identical across the project lifetime — an ABI or libc bump invalidates every prebuilt binary and forces a full rebuild of all four layers.

## Cross-Compilation Essentials

**Toolchain prefix encoding** — GNU tools use a tuple: `<cpu>-<vendor>-<os>-<abi>` (e.g., `aarch64-buildroot-linux-gnu` for ARM 64-bit with glibc, `arm-buildroot-linux-musleabihf` for ARMv7 hard-float with musl).

**Autotools cross-build pattern:**
```bash
./configure --host=aarch64-buildroot-linux-gnu --prefix=/usr \
  CC=aarch64-buildroot-linux-gnu-gcc
make
make DESTDIR=$(gcc -print-sysroot) install
```

**CMake cross-build** needs a toolchain file, not `--host`:
```cmake
# toolchain-aarch64.cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR aarch64)
set(CMAKE_C_COMPILER aarch64-buildroot-linux-gnu-gcc)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
```

Keep host and target build environments strictly separate — even same-architecture (x86→x86) "native" builds diverge over time as host distros update. Prebuilt toolchains from Linaro, Bootlin, or SoC vendors accelerate development; building your own with crosstool-NG or Buildroot gives full control over libc, kernel-header version, and hardening flags (`-fstack-protector-strong`, `-D_FORTIFY_SOURCE=2`, `-pie`).

## Device Trees & U-Boot Boot Sequence

**Device tree** (`.dts`/`.dtsi` → `.dtb`): declarative hardware description passed from bootloader to kernel. One kernel binary boots multiple boards by swapping the DTB — no per-board kernel rebuild needed. `.dtsi` include files hold SoC-common nodes; board `.dts` files override/extend them (`&nodelabel { ... };` overlay syntax).

**U-Boot boot flow:**
1. SPL/TF-A stage initializes DRAM, clocks, serial console (on ARMv8, ATF BL2/BL31 run before U-Boot proper)
2. U-Boot loads kernel image + DTB (+ optional initramfs) into memory from SD/eMMC/NAND/TFTP
3. Passes DTB address and `bootargs` to the kernel (memory layout, `console=`, `root=`, `rootwait`)
4. Kernel parses the device tree, probes drivers via compatible-string matching, mounts root filesystem

Inspect/edit the running environment with `printenv`/`setenv`/`saveenv`; script boot logic in `boot.scr` (mkimage-compiled) or `extlinux.conf`. Use `fw_printenv`/`fw_setenv` from Linux userspace to touch the U-Boot environment without rebooting into the bootloader.

## Build Systems: Yocto vs. Buildroot

**Buildroot** (simpler, faster):
- Kconfig-based single-pass build; generates toolchain, kernel, bootloader, and root filesystem together
- Reproducible, minimal configuration surface — good for small teams, prototyping, education
- No target-side package manager; image is a fixed snapshot, rebuild-and-reflash to update

**Yocto** (production-grade):
- Layer-based architecture (`meta-*` layers); BSP layers supply vendor kernel/U-Boot/drivers
- BitBake recipe system (`.bb`/`.bbappend`/`.bbclass`); shared-state cache (`sstate-cache`) makes incremental rebuilds fast across a team/CI
- `devtool`/extensible SDK (eSDK) lets app developers iterate without rebuilding the whole image
- Optional runtime package management (`opkg`, `rpm`, `dpkg`) for field package updates instead of whole-image OTA

Use Buildroot for small, static, single-purpose images; Yocto for multi-board product lines, long-term maintenance (CVE patching via `meta-*` updates), and teams needing reproducible, auditable builds.

## Kernel Configuration & Drivers

**Kbuild** compiles the kernel for the target CPU/arch. `menuconfig`/`defconfig` selects features; drivers are probed via device tree `compatible` strings or platform data. Common decisions:

- MMU (full virtual memory) vs. µClinux/nommu (rare, RAM-constrained microcontrollers)
- Floating-point ABI: EABIHF (hard-float) vs. softfloat on ARM — never link objects built with different FP ABIs
- Peripheral drivers: USB, Ethernet, GPIO, I2C, SPI, UART, usually wired up entirely through the device tree, not `menuconfig`
- Filesystem support compiled in: ext4, UBI/UBIFS (raw NAND), squashfs (compressed read-only), jffs2 (NAND, wear-leveling built in)
- Build a minimal `initramfs` (CPIO archive, often built by Buildroot/Yocto) when the real rootfs lives behind a driver that needs firmware blobs loaded first, or for rescue/recovery boot

Cross-compile: `make ARCH=arm64 CROSS_COMPILE=aarch64-buildroot-linux-gnu- Image dtbs modules`. Keep kernel config lean — smaller image, smaller attack surface, faster boot; disable unused subsystems (`# CONFIG_X is not set`) rather than leaving defaults.

## Root Filesystem & systemd

Minimum content: `/sbin/init` (or equivalent), a shell, libc, and whatever userland tools the application needs — usually assembled via **BusyBox** for size-constrained images.

**Init system choice:**
- **BusyBox init** — single static binary, `/etc/inittab`, sub-100ms startup, no service dependency graph; fine for single-purpose appliances
- **systemd** — unit-file dependency graph, socket activation, `journald` structured logging, cgroups-based resource control, watchdog integration (`sd_notify`); pulls in more RAM/storage but gives supervised restart, ordering, and `systemd-networkd`/`systemd-timesyncd` for free
- Pick systemd when the device runs multiple cooperating services that need ordered startup, restart-on-crash, or socket activation; pick BusyBox init for a single static binary with no service choreography

**systemd unit example for an application service:**
```ini
[Unit]
Description=Sensor gateway daemon
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/sensor-gateway
Restart=on-failure
WatchdogSec=30
User=sensord

[Install]
WantedBy=multi-user.target
```

Enable a minimal systemd footprint on constrained targets: mask unused units (`systemctl mask`), disable `systemd-udevd` predictable network names if not needed, and prefer `systemd-networkd` over NetworkManager on headless devices.

## Storage Strategy & Filesystems

**Flash media** (SPI-NOR, raw NAND, managed eMMC/SD):
- **SPI-NOR**: small, slow, wear-resistant; typically holds bootloader + DTB, sometimes a fallback kernel
- **Raw NAND**: high capacity, requires a wear-leveling layer (UBI); filesystems: UBIFS, JFFS2
- **Managed (eMMC/SD)**: onboard controller handles wear-leveling and bad-block remapping; use ext4 or F2FS directly

**Read-only root** (squashfs + tmpfs overlay via OverlayFS): hardens the system against power-loss corruption and unauthorized persistence; mount `/etc`, `/var`, `/home` as a writable overlay backed by a small persistent partition, everything else read-only.

## OTA Updates & Secure Boot

**Dual-partition (A/B) update scheme**: active and backup kernel+rootfs partitions; the updater writes the inactive slot, then an atomic bootloader-environment flip promotes it. Roll back automatically if the new slot fails a boot-count/health check (U-Boot `bootcount`, or the framework's own watchdog).

- **Mender** — client/server OTA with A/B rootfs, delta updates, rollback via U-Boot integration, device inventory/deployment management
- **RAUC** — bundle-based (squashfs image + signature), slot-based A/B, good fit for Yocto via `meta-rauc`
- **SWUpdate** — flexible, scriptable update handler, supports single or dual-copy schemes, good for custom fleets

**Secure boot chain**: each stage verifies the signature of the next before executing it — ROM code verifies SPL/TF-A, SPL verifies U-Boot proper, U-Boot verifies the kernel+DTB (FIT image with signed configuration), the kernel optionally verifies the rootfs via **dm-verity** (read-only, hash-tree-checked block device). Break the chain at any stage and the whole guarantee is void — never leave U-Boot's console/JTAG unlocked in production if kernel image verification is enabled, or an attacker just boots an unsigned kernel directly.

Always validate OTA package signatures before applying; never trust a bundle solely because it arrived over TLS — transport security and payload authenticity are separate guarantees.

## Common Pitfalls

- **Mismatched ABI**: linking softfloat and hardfp objects together → silent runtime crashes, not link errors
- **N+1 library dependency**: cross-compiling a package before its dependencies are cross-compiled and installed into the sysroot
- **Static toolchain divergence**: upgrading host libraries without regenerating the target toolchain → subtle incompatibility months later
- **Stale bootloader state**: old DTB or kernel cmdline defaults left in the U-Boot environment after an image update; always verify `bootargs` matches the new kernel's expectations
- **Unmanaged NAND wear**: filesystem without a wear-leveling layer on raw NAND → rapid flash degradation in the field
- **Unsigned/unencrypted firmware**: devices in the field are physically accessible — ship secure boot (signed U-Boot, verified kernel, dm-verity rootfs) for anything handling credentials or safety-relevant logic
- **Insufficient RAM/disk for full Yocto rebuild**: swap thrashing or `sstate-cache` corruption on low-resource CI runners; pre-allocate swap or split builds across `sstate` mirrors
- **A/B update with no health check**: promoting a new slot without a boot-success confirmation bricks the device on first boot failure — always wire a bootcount/watchdog rollback
- **systemd on a 32 MB RAM target**: unit-file overhead and journald can starve a genuinely constrained device; measure before committing to it

Start with a reference board (Raspberry Pi, BeaglePlay, QEMU `virt` machine); validate the full stack there before porting to custom hardware.

## Debugging Across the Boundary

Standard host debugging tools don't work unchanged when the process under test runs on different hardware than the debugger:

- **Remote GDB**: run `gdbserver :1234 ./app` on target, connect from host with `gdb-multiarch` (or the toolchain's own `gdb`) via `target remote target-ip:1234`; point `set sysroot` at the target sysroot so shared libraries resolve
- **Kernel debugging**: `printk`/`dev_dbg` with dynamic debug (`dyndbg` boot param) beats recompiling for every trace point; `ftrace`/`trace-cmd` for scheduling and latency issues; KGDB/JTAG (e.g., OpenOCD) for early-boot or SPL-stage crashes before a console exists
- **Crash triage**: keep `vmlinux` with debug symbols out of the production image but archived per build — `addr2line`/`scripts/decode_stacktrace.sh` need it to turn an oops address into a file:line
- **strace/ltrace**: statically linked or musl-built variants avoid pulling in host-incompatible shared libraries onto the target
- **Core dumps**: constrained storage often can't hold a full core — configure `coredump_filter` or pipe cores off-device (`|` handler in `/proc/sys/kernel/core_pattern`) to a host collector

## Testing & CI for Embedded Images

- **QEMU** (`qemu-system-arm`/`aarch64`) runs the exact kernel+DTB+rootfs combo before touching real hardware — catches userspace and most driver-model bugs early, though it can't replace testing on the real SoC for peripheral timing or DMA issues
- **LAVA** (Linaro Automated Validation Architecture) automates flashing and boot-testing across a lab of physical boards — useful once more than one board revision is in play
- **ptest** (Yocto) bundles each recipe's own test suite into the image for on-target validation without a full toolchain
- Smoke-test every image build: does it boot, reach a login prompt/service-ready state, and pass a basic health check, before it's promoted past CI

## Cheat Sheet — Quick Commands

```bash
# Inspect a device tree blob
dtc -I dtb -O dts my-board.dtb

# Decompile and edit, then recompile
fdtdump my-board.dtb > my-board.dts
dtc -I dts -O dtb my-board.dts -o my-board.dtb

# Check a binary's target architecture and dynamic linker
file myapp
readelf -d myapp | grep NEEDED

# U-Boot environment from a running Linux userspace
fw_printenv
fw_setenv bootargs "console=ttyS0,115200 root=/dev/mmcblk0p2 rootwait"

# Yocto: build and inspect a single recipe
bitbake -c devshell my-recipe
bitbake-layers show-layers
```
