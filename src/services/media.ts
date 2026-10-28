import { limits } from '../utils'

export function inspectImage(bytes: Uint8Array): { mime: string; width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (a: number, n: number) => String.fromCharCode(...bytes.slice(a, a + n))
  if (bytes.length >= 24 && bytes[0] === 137 && tag(1, 3) === 'PNG' && tag(12, 4) === 'IHDR')
    return { mime: 'image/png', width: view.getUint32(16), height: view.getUint32(20) }
  if (bytes[0] === 255 && bytes[1] === 216) {
    let i = 2
    while (i + 8 < bytes.length) {
      if (bytes[i++] !== 255) break
      while (bytes[i] === 255) i++
      const marker = bytes[i++]!
      if (marker === 217 || marker === 218) break
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue
      const size = view.getUint16(i)
      if (size < 2 || i + size > bytes.length) break
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker))
        return { mime: 'image/jpeg', height: view.getUint16(i + 3), width: view.getUint16(i + 5) }
      i += size
    }
  }
  if (bytes.length >= 30 && tag(0, 4) === 'RIFF' && tag(8, 4) === 'WEBP') {
    const u24 = (offset: number) =>
      bytes[offset]! + (bytes[offset + 1]! << 8) + (bytes[offset + 2]! << 16)
    const format = tag(12, 4)
    if (format === 'VP8X') return { mime: 'image/webp', width: u24(24) + 1, height: u24(27) + 1 }
    if (format === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42)
      return {
        mime: 'image/webp',
        width: view.getUint16(26, true) & 16383,
        height: view.getUint16(28, true) & 16383,
      }
    if (format === 'VP8L' && bytes[20] === 47)
      return {
        mime: 'image/webp',
        width: 1 + bytes[21]! + ((bytes[22]! & 63) << 8),
        height: 1 + (bytes[22]! >> 6) + (bytes[23]! << 2) + ((bytes[24]! & 15) << 10),
      }
  }
  throw new Error('This image could not be read. Choose a valid PNG, JPG, or WebP image.')
}

export async function validateImage(blob: Blob, decode = true): Promise<string> {
  if (!blob.size || blob.size > limits.imageBytes)
    throw new Error('Choose an image smaller than 10 MB.')
  const info = inspectImage(new Uint8Array(await blob.arrayBuffer()))
  if (!info.width || !info.height || info.width * info.height > limits.imagePixels)
    throw new Error(
      'This image is too large to display safely. Resize it to fewer than 40 million pixels.',
    )
  if (decode && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob)
      bitmap.close()
    } catch {
      throw new Error(
        'This image is damaged or cannot be displayed. Try exporting a fresh PNG, JPG, or WebP.',
      )
    }
  }
  return info.mime
}
