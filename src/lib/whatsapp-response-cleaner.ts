
export class WhatsAppResponseCleaner {
  static cleanAsterisks(response: string): string {
    if (!response) {
      return response || ''
    }
    
    return response.replace(/\*\*/g, '*')
  }

  static cleanResponse(response: string): string {
    if (!response) {
      return response || ''
    }

    let cleanedResponse = response

    cleanedResponse = this.cleanAsterisks(cleanedResponse)

    return cleanedResponse
  }
}
