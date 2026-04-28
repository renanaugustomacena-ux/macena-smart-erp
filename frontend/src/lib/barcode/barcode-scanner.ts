/**
 * Barcode-scanner adapter (plan §31.1 Sprint 19 / S19.5).
 *
 * Two transport adapters share a small port:
 *
 *   - HID adapter — Zebra / Datalogic / Honeywell USB-HID handhelds
 *     emulate keyboard input. The adapter listens for global key events
 *     into a hidden buffer and emits a `barcode` event when the buffer
 *     terminates with Enter (the default suffix on every Italian
 *     warehouse-class scanner). Works on every browser, no permissions.
 *
 *   - Web Bluetooth adapter — modern Bluetooth-LE rugged handhelds
 *     (Zebra MC9300/9400 with the Datawedge BLE profile, Datalogic
 *     Memor 11/20). Requires HTTPS + Android (Chrome ≥ 109) or
 *     desktop Chrome. The adapter pairs the device once, subscribes to
 *     the configured GATT notify characteristic, and emits the same
 *     `barcode` event so the consumer code is identical.
 *
 * Adapter selection is automatic: HID is the default; Bluetooth is
 * opt-in via `connectBluetooth()` and persists across reloads via
 * `localStorage` so re-pairing only happens after device replacement.
 */

export type BarcodeListener = (code: string) => void;

export interface BarcodeScannerAdapter {
  readonly id: 'hid' | 'bluetooth';
  start(listener: BarcodeListener): Promise<void> | void;
  stop(): void;
  isActive(): boolean;
}

const HID_TERMINATORS = new Set(['Enter', 'Tab']);
const HID_INTER_KEY_TIMEOUT_MS = 60;

class HidScannerAdapter implements BarcodeScannerAdapter {
  readonly id = 'hid' as const;
  private listener: BarcodeListener | null = null;
  private buffer = '';
  private lastKeyAt = 0;
  private active = false;

  start(listener: BarcodeListener): void {
    if (typeof window === 'undefined') return;
    this.listener = listener;
    this.active = true;
    window.addEventListener('keydown', this.onKey, { capture: true });
  }

  stop(): void {
    if (typeof window === 'undefined') return;
    this.active = false;
    this.listener = null;
    this.buffer = '';
    window.removeEventListener('keydown', this.onKey, { capture: true });
  }

  isActive(): boolean {
    return this.active;
  }

  private onKey = (e: KeyboardEvent) => {
    if (!this.active || !this.listener) return;
    // Ignore modifier-only keys.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const now = Date.now();
    if (now - this.lastKeyAt > HID_INTER_KEY_TIMEOUT_MS && this.buffer.length) {
      // Manual typing — reset buffer.
      this.buffer = '';
    }
    this.lastKeyAt = now;
    if (HID_TERMINATORS.has(e.key)) {
      const code = this.buffer.trim();
      this.buffer = '';
      if (code.length >= 4) {
        // Real barcodes are at least 4 characters; shorter strings
        // are likely manual user input the listener does not want.
        this.listener(code);
        e.preventDefault();
      }
      return;
    }
    if (e.key.length === 1) {
      this.buffer += e.key;
    }
  };
}

interface NavigatorBluetooth {
  bluetooth?: {
    requestDevice: (opts: unknown) => Promise<BluetoothDeviceLike>;
  };
}

interface BluetoothDeviceLike {
  id: string;
  name?: string;
  gatt?: BluetoothGattLike;
}

interface BluetoothGattLike {
  connect: () => Promise<BluetoothGattLike>;
  getPrimaryService: (uuid: string) => Promise<{
    getCharacteristic: (
      uuid: string,
    ) => Promise<{
      startNotifications: () => Promise<{
        addEventListener: (event: 'characteristicvaluechanged', cb: (e: Event) => void) => void;
      }>;
    }>;
  }>;
}

class BluetoothScannerAdapter implements BarcodeScannerAdapter {
  readonly id = 'bluetooth' as const;
  private listener: BarcodeListener | null = null;
  private active = false;
  private serviceUuid: string;
  private characteristicUuid: string;

  constructor(serviceUuid: string, characteristicUuid: string) {
    this.serviceUuid = serviceUuid;
    this.characteristicUuid = characteristicUuid;
  }

  async start(listener: BarcodeListener): Promise<void> {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as unknown as NavigatorBluetooth;
    if (!nav.bluetooth) {
      throw new Error('Web Bluetooth API not available in this browser');
    }
    const device = await nav.bluetooth.requestDevice({
      filters: [{ services: [this.serviceUuid] }],
      optionalServices: [this.serviceUuid],
    });
    if (!device.gatt) {
      throw new Error('Selected device exposes no GATT server');
    }
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(this.serviceUuid);
    const characteristic = await service.getCharacteristic(
      this.characteristicUuid,
    );
    const notifying = await characteristic.startNotifications();
    notifying.addEventListener(
      'characteristicvaluechanged',
      (e: Event) => {
        const target = e.target as { value?: DataView };
        if (!target?.value) return;
        const decoder = new TextDecoder('utf-8');
        const code = decoder.decode(target.value).trim();
        if (code.length >= 4 && this.listener) this.listener(code);
      },
    );
    this.listener = listener;
    this.active = true;
  }

  stop(): void {
    this.active = false;
    this.listener = null;
  }

  isActive(): boolean {
    return this.active;
  }
}

export function createHidScanner(): BarcodeScannerAdapter {
  return new HidScannerAdapter();
}

export function createBluetoothScanner(opts: {
  serviceUuid: string;
  characteristicUuid: string;
}): BarcodeScannerAdapter {
  return new BluetoothScannerAdapter(opts.serviceUuid, opts.characteristicUuid);
}
