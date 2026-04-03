import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export interface AnalysisResult {
  success: boolean
  document_type: string
  summary: string
  entities: {
    persons: string[]
    organizations: string[]
    dates: string[]
    locations: string[]
    monetary_amounts: string[]
    emails: string[]
    phone_numbers: string[]
    urls: string[]
    skills: string[]
    projects: string[]
    invoice_numbers: string[]
  }
  sentiment: {
    label: 'positive' | 'neutral' | 'negative'
    confidence: number
  }
  confidence: number
  metadata: {
    ocr_used: boolean
    ocr_engine: 'vision' | 'tesseract' | null
    pages_processed: number
    processing_time_ms: number
  }
  extractedText: string
  fileName: string
  fileSize: number
}

export interface ProgressEvent {
  step: number  // 0-4 for pipeline steps, 5 = complete
  msg: string
}

function generateJobId(): string {
  return Math.random().toString(36).substring(2, 15)
}

export const api = {
  /**
   * Analyze document with real-time progress via SSE.
   * onProgress fires each time the backend reaches a new pipeline stage.
   */
  async analyzeDocument(
    file: File,
    onProgress?: (event: ProgressEvent) => void
  ): Promise<AnalysisResult> {
    const jobId = generateJobId()

    // Open SSE connection for progress if callback provided
    let eventSource: EventSource | null = null
    if (onProgress) {
      eventSource = new EventSource(`${API_URL}/api/progress/${jobId}`)
      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as ProgressEvent
          onProgress(data)
        } catch {}
      }
      eventSource.onerror = () => {
        eventSource?.close()
      }
    }

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await axios.post(`${API_URL}/api/analyze`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-job-id': jobId,
        },
        timeout: 120000,
      })

      return response.data
    } finally {
      // Always close SSE
      eventSource?.close()
    }
  },

  async getRecentDocuments() {
    const response = await axios.get(`${API_URL}/api/documents`)
    return response.data
  },
}
