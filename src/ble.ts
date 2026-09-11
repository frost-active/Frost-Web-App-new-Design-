export const DEFAULT_DEVICE_NAME = 'ESP32_RTC';
export const DEVICE_NAME_PREFIXES = ['FROST', 'ESP32_RTC'] as const;
// This is the characteristic UUID used by the ESP32 firmware.
export const CHAR_UUID = '4af12345-6789-abcd-ef12-3456789abcde';
// The Python client discovers the service implicitly. Web Bluetooth needs its
// actual service UUID explicitly to grant access to the characteristic.
export const SERVICE_UUID = (import.meta.env.VITE_FROST_SERVICE_UUID || '').trim().toLowerCase();

export const JSON_CHUNK_SIZE = 40;
export const WRITE_DELAY_MS = 80;
export const STATUS_DELAY_MS = 150;

export const CMD_JSON_BEGIN = 'JSON_BEGIN';
export const CMD_JSON_CHUNK_PREFIX = 'JSON_CHUNK:';
export const CMD_JSON_END = 'JSON_END';
export const CMD_DEVICE_MAC_GET = 'MAC:GET';

type BluetoothCharacteristic = {
  uuid: string;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
  readValue(): Promise<DataView>;
};

type BluetoothService = {
  uuid: string;
  getCharacteristics(): Promise<BluetoothCharacteristic[]>;
};

type BluetoothDevice = {
  id: string;
  name?: string;
  gatt?: {
    connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
  };
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void;
};

type BluetoothRemoteGATTServer = {
  connected: boolean;
  getPrimaryServices(): Promise<BluetoothService[]>;
};

type BluetoothNavigator = Navigator & {
  bluetooth?: {
    requestDevice(options: {
      filters?: Array<{ namePrefix: string }>;
      acceptAllDevices?: boolean;
      optionalServices?: string[];
    }): Promise<BluetoothDevice>;
  };
};

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function textBytes(value: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(value);
  const bytes = new Uint8Array<ArrayBuffer>(new ArrayBuffer(encoded.byteLength));
  bytes.set(encoded);
  return bytes;
}

function bytesText(value: DataView): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(value).trim();
}

export class FrostBleClient {
  private characteristic: BluetoothCharacteristic | null = null;
  private server: BluetoothRemoteGATTServer | null = null;

  constructor(private readonly device: BluetoothDevice) {}

  get name(): string {
    return this.device.name || DEFAULT_DEVICE_NAME;
  }

  get isConnected(): boolean {
    return this.server?.connected === true;
  }

  async connect(): Promise<void> {
    if (!this.device.gatt) throw new Error('This browser does not support GATT connections.');
    this.server = await this.device.gatt.connect();
    try {
      const services = await this.server.getPrimaryServices();
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        const match = characteristics.find((candidate) => candidate.uuid.toLowerCase() === CHAR_UUID);
        if (match) {
          this.characteristic = match;
          break;
        }
      }
    } catch {
      await this.disconnect();
      throw new Error('FROST connected, but the browser cannot access its GATT services. Configure VITE_FROST_SERVICE_UUID.');
    }
    if (!this.characteristic) {
      await this.disconnect();
      throw new Error(`Connected to ${this.name}, but characteristic ${CHAR_UUID} was not found. Verify the firmware UUID.`);
    }
  }

  async disconnect(): Promise<void> {
    this.characteristic = null;
    if (this.server?.connected) {
      const disconnect = (this.server as BluetoothRemoteGATTServer & { disconnect?: () => void }).disconnect;
      disconnect?.call(this.server);
    }
    this.server = null;
  }

  async sendCommand(command: string): Promise<void> {
    if (!this.isConnected || !this.characteristic) throw new Error('BLE device is not connected.');
    await this.characteristic.writeValueWithoutResponse(textBytes(command));
    await sleep(WRITE_DELAY_MS);
  }

  async readStatus(): Promise<string> {
    if (!this.isConnected || !this.characteristic) throw new Error('BLE device is not connected.');
    await sleep(STATUS_DELAY_MS);
    return bytesText(await this.characteristic.readValue());
  }

  async sendAndRead(command: string): Promise<string> {
    await this.sendCommand(command);
    return this.readStatus();
  }

  async syncCurrentTime(now: Date = new Date()): Promise<string> {
    const pad = (value: number) => String(value).padStart(2, '0');
    const command = `SET ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const status = await this.sendAndRead(command);
    if (status.startsWith('ERROR:')) {
      throw new Error(status === 'ERROR:SET time failed' ? 'SET time failed' : status);
    }
    return status;
  }

  async readMacAddress(): Promise<string> {
    const status = await this.sendAndRead(CMD_DEVICE_MAC_GET);
    const prefix = 'DEVICE_MAC:';
    if (!status.startsWith(prefix)) throw new Error(`Unexpected MAC response: ${status}`);
    return status.slice(prefix.length).trim();
  }

  async sendJsonConfiguration(configuration: unknown): Promise<string> {
    const json = JSON.stringify(configuration);
    await this.sendCommand(CMD_JSON_BEGIN);
    const beginStatus = await this.readStatus();
    if (beginStatus !== 'OK:JSON_BEGIN' && beginStatus !== 'OK') {
      throw new Error(`Unexpected JSON_BEGIN response: ${beginStatus}`);
    }
    for (let start = 0; start < json.length; start += JSON_CHUNK_SIZE) {
      await this.sendCommand(`${CMD_JSON_CHUNK_PREFIX}${json.slice(start, start + JSON_CHUNK_SIZE)}`);
    }
    await this.sendCommand(CMD_JSON_END);
    const finalStatus = await this.readStatus();
    if (finalStatus !== 'OK:JSON_APPLIED') throw new Error(`JSON upload failed: ${finalStatus}`);
    return finalStatus;
  }
}

export async function requestFrostDevice(): Promise<FrostBleClient> {
  const bluetooth = (navigator as BluetoothNavigator).bluetooth;
  if (!bluetooth) throw new Error('Web Bluetooth is unavailable. Use Chrome or Edge over HTTPS or localhost.');
  const device = await bluetooth.requestDevice({
    filters: DEVICE_NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
    ...(SERVICE_UUID ? { optionalServices: [SERVICE_UUID] } : {}),
  });
  const client = new FrostBleClient(device);
  await client.connect();
  return client;
}