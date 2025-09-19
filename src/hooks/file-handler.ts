import { AzuriteStorageHook } from './azurite-storage'
import crypto from 'crypto'
import path from 'path'

export interface FileUploadResult {
  success: boolean
  fileId?: string
  fileName?: string
  url?: string
  size?: number
  contentType?: string
  error?: string
}

export interface FileMetadata {
  id: string
  originalName: string
  fileName: string
  size: number
  contentType: string
  uploadDate: Date
  url: string
}

export class FileHandler {
  private storageHook: AzuriteStorageHook
  private allowedTypes: string[]
  private maxFileSize: number

  constructor(options: {
    allowedTypes?: string[]
    maxFileSize?: number
    storageConfig?: any
  } = {}) {
    this.storageHook = new AzuriteStorageHook(options.storageConfig)
    this.allowedTypes = options.allowedTypes || [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024 // 10MB default
  }

  async initialize(): Promise<void> {
    await this.storageHook.initialize()
  }

  private generateFileId(): string {
    return crypto.randomUUID()
  }

  private sanitizeFileName(originalName: string): string {
    const ext = path.extname(originalName)
    const nameWithoutExt = path.basename(originalName, ext)
    const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_')
    return `${sanitized}${ext}`.toLowerCase()
  }

  private generateUniqueFileName(originalName: string, fileId: string): string {
    const ext = path.extname(originalName)
    const timestamp = Date.now()
    return `${timestamp}_${fileId}${ext}`
  }

  validateFile(buffer: Buffer, originalName: string, contentType: string): { valid: boolean; error?: string } {
    if (buffer.length > this.maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${this.maxFileSize / (1024 * 1024)}MB`
      }
    }

    if (!this.allowedTypes.includes(contentType)) {
      return {
        valid: false,
        error: `File type ${contentType} is not allowed. Allowed types: ${this.allowedTypes.join(', ')}`
      }
    }

    return { valid: true }
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    contentType: string
  ): Promise<FileUploadResult> {
    try {
      const validation = this.validateFile(buffer, originalName, contentType)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        }
      }

      const fileId = this.generateFileId()
      const fileName = this.generateUniqueFileName(originalName, fileId)

      const url = await this.storageHook.uploadFile(fileName, buffer, contentType)

      return {
        success: true,
        fileId,
        fileName,
        url,
        size: buffer.length,
        contentType
      }
    } catch (error) {
      console.error('Error in FileHandler.uploadFile:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  async downloadFile(fileName: string): Promise<{ buffer: Buffer; error?: string }> {
    try {
      const buffer = await this.storageHook.downloadFile(fileName)
      return { buffer }
    } catch (error) {
      console.error('Error in FileHandler.downloadFile:', error)
      return {
        buffer: Buffer.alloc(0),
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  async deleteFile(fileName: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.storageHook.deleteFile(fileName)
      return { success: true }
    } catch (error) {
      console.error('Error in FileHandler.deleteFile:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  async fileExists(fileName: string): Promise<boolean> {
    return await this.storageHook.fileExists(fileName)
  }

  async listFiles(prefix?: string): Promise<{ files: string[]; error?: string }> {
    try {
      const files = await this.storageHook.listFiles(prefix)
      return { files }
    } catch (error) {
      console.error('Error in FileHandler.listFiles:', error)
      return {
        files: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  getFileUrl(fileName: string): string {
    return this.storageHook.getFileUrl(fileName)
  }

  // Utility method to handle multipart form data
  static extractFileFromFormData(formData: FormData): {
    buffer: Buffer | null
    originalName: string | null
    contentType: string | null
    error?: string
  } {
    try {
      const file = formData.get('file') as File
      if (!file) {
        return {
          buffer: null,
          originalName: null,
          contentType: null,
          error: 'No file found in form data'
        }
      }

      if (file.size === 0) {
        return {
          buffer: null,
          originalName: null,
          contentType: null,
          error: 'File is empty'
        }
      }

      // Convert File to Buffer (for Node.js environments)
      const arrayBuffer = file.arrayBuffer()
      return arrayBuffer.then(ab => ({
        buffer: Buffer.from(ab),
        originalName: file.name,
        contentType: file.type,
      })) as any // This would need to be async in real usage

    } catch (error) {
      return {
        buffer: null,
        originalName: null,
        contentType: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
}