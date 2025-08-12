import type { AppConfig, HardwareInfo } from "../types";

// TODO: This is a placeholder ProcessManager during workspace system migration
// The original ProcessManager needs to be restored or reimplemented
export class ProcessManager {
  async startTranscription(config: AppConfig, callback: (eventType: string, data: unknown) => void): Promise<void> {
    console.warn('ProcessManager.startTranscription not yet implemented in new architecture');
    callback('error', { message: 'Transcription temporarily unavailable during system migration' });
  }

  async checkHardware(): Promise<HardwareInfo> {
    console.warn('ProcessManager.checkHardware not yet implemented in new architecture');
    return {
      // Return minimal hardware info placeholder
      cpu: 'Unknown',
      memory: '0 GB',
      gpu: 'Unknown'
    } as HardwareInfo;
  }

  cancelProcess(): void {
    console.warn('ProcessManager.cancelProcess not yet implemented in new architecture');
  }
}