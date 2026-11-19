import { z } from 'zod'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_IMAGE_COUNT = 5
const MAX_AUDIO_COUNT = 1
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a']
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_AUDIO_TYPES]

export const reportSchema = z
  .object({
    title: z.string().min(3, 'Title must be at least 3 characters.').max(200, 'Title must be 200 characters or fewer.'),
    description: z.string().min(10, 'Description must be at least 10 characters.').max(5000, 'Description must be 5000 characters or fewer.'),
    category: z.enum(
      ['Fire', 'MedicalEmergency', 'RoadAccident', 'Security', 'Flood', 'Infrastructure', 'Other'],
      { error: 'Please select a category.' },
    ),
    locationText: z.string().min(3, 'Location must be at least 3 characters.').max(500, 'Location must be 500 characters or fewer.'),
    latitude: z
      .string()
      .optional()
      .refine(
        (v) => v === undefined || v === '' || (Number.isFinite(Number(v)) && Number(v) >= -90 && Number(v) <= 90),
        'Latitude must be between -90 and 90.',
      ),
    longitude: z
      .string()
      .optional()
      .refine(
        (v) => v === undefined || v === '' || (Number.isFinite(Number(v)) && Number(v) >= -180 && Number(v) <= 180),
        'Longitude must be between -180 and 180.',
      ),
    reporterName: z.string().max(200, 'Name must be 200 characters or fewer.').optional(),
    reporterPhone: z.string().max(50, 'Phone must be 50 characters or fewer.').optional(),
    reporterEmail: z.string().email('Enter a valid email address.').max(254).optional().or(z.literal('')),
    files: z
      .custom<FileList | undefined>()
      .optional()
      .refine((files) => {
        if (!files) return true
        return files.length <= MAX_IMAGE_COUNT + MAX_AUDIO_COUNT
      }, `You can attach at most ${MAX_IMAGE_COUNT} images and ${MAX_AUDIO_COUNT} audio file.`)
      .refine((files) => {
        if (!files) return true
        return Array.from(files).every((f) => f.size <= MAX_FILE_SIZE)
      }, 'Each file must be 10 MB or smaller.')
      .refine((files) => {
        if (!files) return true
        return Array.from(files).every((f) => ALLOWED_TYPES.includes(f.type))
      }, 'Only JPEG, PNG, WebP images and WebM, OGG, MP3, WAV, M4A audio are accepted.')
      .refine((files) => {
        if (!files) return true
        const audioCount = Array.from(files).filter((f) => ALLOWED_AUDIO_TYPES.includes(f.type)).length
        return audioCount <= MAX_AUDIO_COUNT
      }, `You can attach at most ${MAX_AUDIO_COUNT} audio file.`)
      .refine((files) => {
        if (!files) return true
        const imageCount = Array.from(files).filter((f) => ALLOWED_IMAGE_TYPES.includes(f.type)).length
        return imageCount <= MAX_IMAGE_COUNT
      }, `You can attach at most ${MAX_IMAGE_COUNT} images.`),
  })
  .refine(
    (data) => {
      const hasLat = data.latitude !== undefined && data.latitude !== ''
      const hasLon = data.longitude !== undefined && data.longitude !== ''
      // Either both are provided, or neither
      return hasLat === hasLon
    },
    { message: 'Provide both latitude and longitude, or neither.', path: ['latitude'] },
  )

export type ReportFormValues = z.infer<typeof reportSchema>
