import { BlobServiceClient } from '@azure/storage-blob'

interface AzuriteConfig {
  connectionString?: string
  accountName?: string
  accountKey?: string
  containerName?: string
}

export class AzuriteStorageHook {
  private blobServiceClient: BlobServiceClient
  private containerName: string

  constructor(config: AzuriteConfig = {}) {
    const connectionString = config.connectionString ||
      process.env.AZURE_STORAGE_CONNECTION_STRING ||
      'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://localhost:10000/devstoreaccount1;'

    this.containerName = config.containerName || process.env.AZURE_CONTAINER_NAME || 'paws-files'
    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
  }

  async initialize(): Promise<void> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName)
      await containerClient.createIfNotExists({ access: 'blob' })
      console.log(`✅ Azurite container '${this.containerName}' initialized`)
    } catch (error) {
      console.error('❌ Error initializing Azurite container:', error)
      throw error
    }
  }

  async uploadFile(fileName: string, fileBuffer: Buffer, contentType?: string): Promise<string> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName)
      const blockBlobClient = containerClient.getBlockBlobClient(fileName)

      const uploadOptions: any = {}
      if (contentType) {
        uploadOptions.blobHTTPHeaders = { blobContentType: contentType }
      }

      await blockBlobClient.upload(fileBuffer, fileBuffer.length, uploadOptions)

      const publicUrl = this.getPublicUrl(fileName)
      const originalUrl = blockBlobClient.url

      console.log(`✅ File uploaded successfully:`)
      console.log(`   - File name: ${fileName}`)
      console.log(`   - Original Azure URL: ${originalUrl}`)
      console.log(`   - Public URL returned: ${publicUrl}`)

      return publicUrl
    } catch (error) {
      console.error('❌ Error uploading file to Azurite:', error)
      throw error
    }
  }

  async downloadFile(fileName: string): Promise<Buffer> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName)
      const blockBlobClient = containerClient.getBlockBlobClient(fileName)

      const downloadResponse = await blockBlobClient.download()
      if (!downloadResponse.readableStreamBody) {
        throw new Error('No file content received')
      }

      const chunks: Buffer[] = []
      const stream = downloadResponse.readableStreamBody

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk))
        stream.on('end', () => resolve(Buffer.concat(chunks)))
        stream.on('error', reject)
      })
    } catch (error) {
      console.error('❌ Error downloading file from Azurite:', error)
      throw error
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName)
      const blockBlobClient = containerClient.getBlockBlobClient(fileName)

      await blockBlobClient.delete()
    } catch (error) {
      console.error('❌ Error deleting file from Azurite:', error)
      throw error
    }
  }

  async listFiles(prefix?: string): Promise<string[]> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName)
      const files: string[] = []

      const options: any = {}
      if (prefix) {
        options.prefix = prefix
      }

      for await (const blob of containerClient.listBlobsFlat(options)) {
        files.push(blob.name)
      }

      return files
    } catch (error) {
      console.error('❌ Error listing files from Azurite:', error)
      throw error
    }
  }

  async fileExists(fileName: string): Promise<boolean> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName)
      const blockBlobClient = containerClient.getBlockBlobClient(fileName)

      return await blockBlobClient.exists()
    } catch (error) {
      console.error('❌ Error checking file existence in Azurite:', error)
      return false
    }
  }

  getFileUrl(fileName: string): string {
    return this.getPublicUrl(fileName)
  }

  private getPublicUrl(fileName: string): string {
    const publicStorageUrl = process.env.PUBLIC_STORAGE_URL
    if (publicStorageUrl) {
      return `${publicStorageUrl}/${fileName}`
    }

    // Fallback to the original Azure blob URL if PUBLIC_STORAGE_URL is not set
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(fileName)
    return blockBlobClient.url
  }
}