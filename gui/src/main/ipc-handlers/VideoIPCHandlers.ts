import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import { existsSync, mkdirSync } from 'fs';

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  framerate: number;
  size: number;
  format: string;
}

interface VideoProcessingResult {
  metadata: VideoMetadata | null;
  thumbnail: string | null; // Base64 encoded image
  error?: string;
}

interface FFProbeStream {
  codec_type: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
}

interface FFProbeFormat {
  duration?: string;
  size?: string;
  format_name?: string;
}

interface FFProbeData {
  streams?: FFProbeStream[];
  format?: FFProbeFormat;
}

export class VideoIPCHandlers {
  private thumbnailCache = new Map<string, string>();
  private metadataCache = new Map<string, VideoMetadata>();

  constructor() {
    this.setupHandlers();
  }

  private setupHandlers(): void {
    console.log('✅ Video processing handlers initialized');

    // Get video metadata and thumbnail
    ipcMain.handle(
      'video:getMetadata',
      async (_, filePath: string): Promise<VideoProcessingResult> => {
        return this.processVideo(filePath);
      }
    );

    // Clear video cache
    ipcMain.handle('video:clearCache', async (): Promise<void> => {
      this.thumbnailCache.clear();
      this.metadataCache.clear();
    });

    // Get video as data URL for playback
    ipcMain.handle('video:getDataUrl', async (_, filePath: string): Promise<string | null> => {
      try {
        const videoBuffer = await readFile(filePath);
        const base64Video = videoBuffer.toString('base64');
        
        // Determine MIME type based on file extension
        const ext = filePath.split('.').pop()?.toLowerCase();
        const mimeType = this.getMimeType(ext || '');
        
        return `data:${mimeType};base64,${base64Video}`;
      } catch (error) {
        console.error('Error creating video data URL:', error);
        return null;
      }
    });
  }

  private async processVideo(filePath: string): Promise<VideoProcessingResult> {
    try {
      // Generate cache key based on file path and modification time
      const cacheKey = this.generateCacheKey(filePath);

      // Check cache first
      const cachedMetadata = this.metadataCache.get(cacheKey);
      const cachedThumbnail = this.thumbnailCache.get(cacheKey);

      if (cachedMetadata && cachedThumbnail) {
        return {
          metadata: cachedMetadata,
          thumbnail: cachedThumbnail,
        };
      }

      // Process video using FFmpeg
      const [metadata, thumbnail] = await Promise.all([
        this.extractMetadata(filePath),
        this.generateThumbnail(filePath),
      ]);

      // Cache the results
      if (metadata) {
        this.metadataCache.set(cacheKey, metadata);
      }
      if (thumbnail) {
        this.thumbnailCache.set(cacheKey, thumbnail);
      }

      return {
        metadata,
        thumbnail,
      };
    } catch (error) {
      console.error('Error processing video:', error);
      return {
        metadata: null,
        thumbnail: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async extractMetadata(filePath: string): Promise<VideoMetadata | null> {
    return new Promise((resolve) => {
      const ffprobe = spawn('ffprobe', [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        filePath,
      ]);

      let output = '';
      let errorOutput = '';

      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          console.error('ffprobe failed:', errorOutput);
          resolve(null);
          return;
        }

        try {
          const data: FFProbeData = JSON.parse(output);
          const videoStream = data.streams?.find(
            (stream: FFProbeStream) => stream.codec_type === 'video'
          );

          if (!videoStream) {
            resolve(null);
            return;
          }

          const metadata: VideoMetadata = {
            duration: parseFloat(data.format?.duration || '0'),
            width: videoStream.width || 0,
            height: videoStream.height || 0,
            framerate: this.parseFramerate(videoStream.r_frame_rate || '0/1'),
            size: parseInt(data.format?.size || '0'),
            format: data.format?.format_name || 'unknown',
          };

          resolve(metadata);
        } catch (error) {
          console.error('Error parsing ffprobe output:', error);
          resolve(null);
        }
      });

      ffprobe.on('error', (error) => {
        console.error('ffprobe spawn error:', error);
        resolve(null);
      });
    });
  }

  private async generateThumbnail(filePath: string): Promise<string | null> {
    return new Promise((resolve) => {
      // Create temporary directory for thumbnails
      const tempDir = join(tmpdir(), 'cantocap-thumbnails');
      if (!existsSync(tempDir)) {
        mkdirSync(tempDir, { recursive: true });
      }

      const thumbnailPath = join(tempDir, `thumb_${Date.now()}.jpg`);

      const ffmpeg = spawn('ffmpeg', [
        '-i',
        filePath,
        '-ss',
        '00:00:05', // Seek to 5 seconds
        '-vframes',
        '1', // Extract 1 frame
        '-vf',
        'scale=320:240:force_original_aspect_ratio=decrease,pad=320:240:(ow-iw)/2:(oh-ih)/2',
        '-q:v',
        '5', // High quality
        '-y', // Overwrite output file
        thumbnailPath,
      ]);

      let errorOutput = '';

      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on('close', async (code) => {
        if (code !== 0) {
          console.error('ffmpeg thumbnail generation failed:', errorOutput);
          resolve(null);
          return;
        }

        try {
          // Read the generated thumbnail and convert to base64
          const thumbnailBuffer = await readFile(thumbnailPath);
          const base64Thumbnail = `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`;

          // Clean up temporary file
          try {
            await import('fs').then((fs) => fs.promises.unlink(thumbnailPath));
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (error) {
            // Ignore cleanup errors
          }

          resolve(base64Thumbnail);
        } catch (error) {
          console.error('Error reading thumbnail:', error);
          resolve(null);
        }
      });

      ffmpeg.on('error', (error) => {
        console.error('ffmpeg spawn error:', error);
        resolve(null);
      });
    });
  }

  private generateCacheKey(filePath: string): string {
    // Simple cache key based on file path - in production, you might want to include file modification time
    return createHash('md5').update(filePath).digest('hex');
  }

  private parseFramerate(framerateStr: string): number {
    try {
      const [numerator, denominator] = framerateStr.split('/').map(Number);
      return denominator ? numerator / denominator : 0;
    } catch {
      return 0;
    }
  }

  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'ogg': 'video/ogg',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      'mkv': 'video/x-matroska',
      'flv': 'video/x-flv',
    };
    return mimeTypes[extension] || 'video/mp4';
  }

  public cleanup(): void {
    ipcMain.removeAllListeners('video:getMetadata');
    ipcMain.removeAllListeners('video:clearCache');
    ipcMain.removeAllListeners('video:getDataUrl');
  }
}
