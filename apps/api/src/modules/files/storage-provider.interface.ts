export interface UploadInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  kind: string;
}

export interface StoredFile {
  storagePath: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  checksum: string;
}

export interface StorageProvider {
  readonly name: 'local' | 's3';
  save(input: UploadInput): Promise<StoredFile>;
  read(storagePath: string): Promise<Buffer>;
  remove(storagePath: string): Promise<void>;
}
