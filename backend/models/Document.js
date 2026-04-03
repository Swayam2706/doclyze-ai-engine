import mongoose from 'mongoose'

const documentSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, required: true },
  uploadDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
  result: { type: mongoose.Schema.Types.Mixed },
})

export default mongoose.model('Document', documentSchema)
