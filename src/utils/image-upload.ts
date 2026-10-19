import { ElMessage } from 'element-plus'

const MAX_BYTES = 800 * 1024
const ACCEPT = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

export async function pickImageAsDataUrl(file: File): Promise<string | null> {
  if (!ACCEPT.includes(file.type) && !file.name.match(/\.(png|jpe?g|webp|svg|ico)$/i)) {
    ElMessage.warning('请上传 PNG / JPG / WebP / SVG / ICO 图片')
    return null
  }
  if (file.size > MAX_BYTES) {
    ElMessage.warning('图片请小于 800KB')
    return null
  }
  try {
    return await fileToDataUrl(file)
  } catch {
    ElMessage.error('图片读取失败')
    return null
  }
}
