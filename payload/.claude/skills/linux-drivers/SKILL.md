---
name: linux-drivers
description: Linux device driver architecture covering char/block drivers, kernel modules, device tree, interrupts, DMA, sysfs, kernel concurrency (spinlocks/mutexes), and I2C/SPI bus drivers.
origin: Linux Device Driver Development (2nd Edition), John Madieu
---

# Linux Device Drivers

Core patterns and essential APIs for kernel device driver development.

## When to Activate

- Developing character or block device drivers for custom hardware
- Integrating peripherals via I2C, SPI, or GPIO buses
- Managing hardware interrupts, threaded IRQs, and DMA transfers
- Building kernel modules with loadable/unloadable code
- Exposing device properties via sysfs attributes
- Porting drivers to embedded systems via device tree
- Choosing between spinlocks, mutexes, and atomics for kernel concurrency
- Handling platform devices and bus-based drivers

## Kernel Module Fundamentals

Every driver exists as a loadable kernel module with init/exit phases. The
kernel calls `_init` at load time and `_exit` at unload; both must be
symmetric — anything registered in `_init` must be unregistered in `_exit`.

```c
static int __init my_driver_init(void)
{
    // register resources (chrdev, class, IRQ...)
    return 0;  // return 0 on success, negative errno on failure
}

static void __exit my_driver_exit(void)
{
    // unregister resources in reverse order
}

module_init(my_driver_init);
module_exit(my_driver_exit);

MODULE_LICENSE("GPL");
MODULE_AUTHOR("Author Name");
MODULE_DESCRIPTION("Device driver description");
```

- `module_param()` exposes tunables in `/sys/module/<name>/parameters/`; use
  `S_IRUGO` for read-only unless the parameter is safe to change live.
- Build via `make` with `KDIR`/`CONFIG_KERNEL_DIR` pointing to the kernel
  source/headers tree; a minimal `Makefile` uses
  `obj-m += my_driver.o` and invokes `make -C $(KDIR) M=$(PWD) modules`.
- Never do blocking work in `_init`/`_exit` beyond what's necessary — probe
  deferral (`-EPROBE_DEFER`) exists for dependencies not yet ready.

## Character Device Drivers

```c
// Dynamic device number allocation (kernel assigns major) — preferred over
// register_chrdev_region(), which requires knowing the major in advance
alloc_chrdev_region(&dev, first_minor, count, name);
static const struct file_operations my_fops = {
    .owner   = THIS_MODULE,
    .open    = my_open,
    .release = my_release,
    .read    = my_read,
    .write   = my_write,
    .unlocked_ioctl = my_ioctl,
};

cdev_init(&my_cdev, &my_fops);
cdev_add(&my_cdev, dev, count);          // returns 0 on success
device_create(my_class, NULL, dev, NULL, "my_device%d", minor);
```

- `device_create()` registers the device with sysfs/udev so `/dev/my_deviceN`
  appears automatically — don't hand-roll `mknod` in production drivers.
- Use `copy_to_user()`/`copy_from_user()` for every buffer crossing the
  user/kernel boundary; never dereference a user pointer directly.
- Block drivers follow the same registration shape but implement `blk_mq`
  queue callbacks (`queue_rq`) against a `struct gendisk` instead of
  `file_operations` — I/O is submitted as `struct request`s, not read/write
  calls, and must support multi-queue dispatch for performance.

## Interrupts

```c
irqreturn_t my_isr(int irq, void *dev_id)
{
    struct my_device *device = dev_id;

    if (!device_interrupt_pending(device))
        return IRQ_NONE;          // not ours — required on shared lines

    // Ack hardware here; never block in a hard IRQ handler
    schedule_work(&device->deferred_work);  // defer to bottom half
    return IRQ_HANDLED;
}

request_irq(irq, my_isr, IRQF_SHARED, "my_device", device);
```

- Hard IRQ context cannot sleep: no `mutex_lock()`, no `kmalloc(GFP_KERNEL)`,
  no blocking I/O. Defer real work via a threaded IRQ
  (`request_threaded_irq()`), workqueue, or tasklet.
- Always check device-specific status before returning `IRQ_HANDLED` on a
  shared line — claiming an interrupt that wasn't yours starves other
  devices sharing it.
- `free_irq()` in the exit/remove path, matching every `request_irq()`.

## Kernel Concurrency

Pick the primitive by context, not habit.

| Primitive | Can sleep? | Use for |
| --- | --- | --- |
| Spinlock (`spin_lock`) | No | Short critical sections, IRQ handlers, per-CPU data |
| Mutex (`mutex_lock`) | Yes | Longer critical sections in process context |
| Atomic (`atomic_t`, `atomic_inc`) | N/A | Single counters, flags — no ordering needed |
| RCU | N/A (readers) | Read-mostly data structures, frequent readers/rare writers |

```c
static DEFINE_SPINLOCK(my_lock);
unsigned long flags;

spin_lock_irqsave(&my_lock, flags);  // also usable inside IRQ context
// critical section — must be short, no sleeping
spin_unlock_irqrestore(&my_lock, flags);
```

- A spinlock disables preemption (and, with `_irqsave`, local interrupts) on
  the current CPU — the holder must never sleep or it deadlocks the CPU.
- Use `spin_lock_irqsave()`/`_irqrestore()` whenever the same lock is also
  taken from an interrupt handler, to avoid a self-deadlock.
- Mutexes are cheaper than spinlocks for long sections because contended
  waiters sleep instead of spinning, but they must never be taken in
  interrupt/atomic context.

## Device Tree

```dts
my_device: my-device@0 {
    compatible = "vendor,my-device";
    reg = <0x0 0x1000>;
    interrupts = <31 IRQ_TYPE_LEVEL_HIGH>;
};
```

```c
static const struct of_device_id my_of_match[] = {
    { .compatible = "vendor,my-device" }, { }
};
MODULE_DEVICE_TABLE(of, my_of_match);

static struct platform_driver my_driver = {
    .probe = my_probe, .remove = my_remove,
    .driver = { .name = "my_driver", .of_match_table = my_of_match },
};
```

- The `compatible` string binds a DT node to a driver's match table — treat
  the binding as an ABI: once merged upstream, it cannot change.
- `probe()` replaces `_init` for resource acquisition per matched device
  instance; a driver may probe multiple times for multiple device nodes.
- Read properties with `of_property_read_u32()`,
  `devm_clk_get()`/`devm_gpiod_get()` — prefer the `devm_*` managed variants
  so resources are freed automatically on probe failure or `remove()`.

## DMA

```c
// Coherent (bidirectional, CPU-visible) buffer — no manual cache flushing
void *buf = dma_alloc_coherent(dev, size, &dma_handle, GFP_KERNEL);

// Streaming mapping for a buffer allocated elsewhere — pair map/unmap
dma_addr_t addr = dma_map_single(dev, cpu_addr, size, DMA_TO_DEVICE);
dma_sync_single_for_cpu(dev, addr, size, DMA_FROM_DEVICE);
dma_unmap_single(dev, addr, size, DMA_TO_DEVICE);
```

- `dma_alloc_coherent()` suits small, frequently-touched control structures
  (descriptors, ring buffers); streaming DMA (`dma_map_single()`/`_sg()`)
  suits one-shot transfers — always pick the correct direction flag
  (`DMA_TO_DEVICE`, `DMA_FROM_DEVICE`, `DMA_BIDIRECTIONAL`).
- On IOMMU-backed systems, DMA buffers must come from `dma_alloc_coherent()`
  or a mapped streaming buffer — a raw `kmalloc()` pointer isn't guaranteed
  physically contiguous or IOMMU-visible.

## Sysfs Attributes

```c
static ssize_t my_attr_show(struct device *dev,
                             struct device_attribute *attr, char *buf)
{
    return sysfs_emit(buf, "%d\n", device_get_value(dev));
}

static ssize_t my_attr_store(struct device *dev, struct device_attribute *attr,
                              const char *buf, size_t count)
{
    int value;

    if (kstrtoint(buf, 10, &value))
        return -EINVAL;
    device_set_value(dev, value);
    return count;
}

static DEVICE_ATTR_RW(my_attr);   // creates /sys/.../my_attr
```

- Every kobject exposing sysfs files is backed by a `struct kobject`; its
  `ktype`'s `sysfs_ops` dispatch `show`/`store` to attributes. One value per
  file — sysfs forbids multiplexing several fields into one file's text.
- Register attributes via `DEVICE_ATTR_RW`/`_RO`/`_WO` and an attribute
  group (`ATTRIBUTE_GROUPS()`), not manual `sysfs_create_file()` calls in
  probe — groups are created/removed atomically with the device.

## I2C and SPI Device Drivers

Both buses follow the same driver shape: an ID table, a `probe`/`remove` pair
matched via `of_match_table`, and a transfer call that can sleep.

```c
static const struct i2c_device_id my_i2c_id[] = { { "my-i2c-device", 0 }, { } };
MODULE_DEVICE_TABLE(i2c, my_i2c_id);

static struct i2c_driver my_i2c_driver = {
    .driver = { .name = "my_i2c_driver", .of_match_table = my_of_match },
    .probe = my_i2c_probe, .remove = my_i2c_remove, .id_table = my_i2c_id,
};

// Transfers can sleep — never call from interrupt/atomic context
i2c_smbus_read_byte_data(client, reg);
i2c_transfer(client->adapter, msgs, num_msgs);

struct spi_transfer transfer = { .tx_buf = tx, .rx_buf = rx, .len = len };
spi_sync(spi_device, &message);   // also sleeps — same rule as I2C
```

## Common Pitfalls

- ❌ Static device number without dynamic fallback — conflicts with other drivers.
- ❌ Asymmetric init/exit — resource registered but not released, or
  released in the wrong order.
- ❌ Dereferencing user-space pointers directly instead of
  `copy_to_user()`/`copy_from_user()`.
- ❌ Blocking (`mutex_lock`, `kmalloc(GFP_KERNEL)`, sleeping I/O) inside a
  hard IRQ handler — use a threaded IRQ or defer to a workqueue.
- ❌ Not checking device-specific status before returning `IRQ_HANDLED` on a
  shared line — starves other devices sharing the interrupt; missing
  `free_irq()` on removal.
- ❌ Taking a mutex inside a spinlock-protected section or interrupt
  context — mutexes can sleep, spinlocks/IRQ context cannot; forgetting
  `_irqsave`/`_irqrestore` when the same spinlock is also acquired from an
  interrupt handler causes self-deadlock.
- ❌ Hardcoded I2C/SPI addresses or GPIO numbers instead of a device tree
  binding — breaks portability; an upstream `compatible` string is ABI, not
  free to change.
- ❌ Allocating DMA buffers with `kmalloc()` on IOMMU systems — use
  `dma_alloc_coherent()` or a mapped streaming buffer; skipping
  `dma_sync_single_for_cpu()`/`_for_device()` around streaming access.
- ❌ Calling `i2c_transfer()` or `spi_sync()` from interrupt/atomic
  context — both bus transfers can sleep; ignoring bus errors (NACK,
  timeout) instead of propagating a negative errno.
- ❌ Multiplexing several values into one sysfs attribute file instead of
  one value per file; manual `sysfs_create_file()` calls in `probe()`
  instead of an attribute group created/removed atomically with the device.
