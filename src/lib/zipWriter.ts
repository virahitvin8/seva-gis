/**
 * Zero-dependency client-side ZIP archive builder for SEVA·GIS
 * Compliant with standard PKZIP 2.0 (Store mode 0)
 */

function makeCrc32Table(): Uint32Array {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c >>> 0
  }
  return table
}

const CRC32_TABLE = makeCrc32Table()

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  name: string
  content: string | Uint8Array
}

export function createZipArchive(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder()
  const localHeaders: Uint8Array[] = []
  const centralHeaders: Uint8Array[] = []
  let offset = 0

  const now = new Date()
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff

  for (const entry of entries) {
    const data = typeof entry.content === 'string' ? encoder.encode(entry.content) : entry.content
    const nameBytes = encoder.encode(entry.name)
    const checksum = crc32(data)
    const size = data.length

    // Local File Header (30 bytes + name)
    const localHeader = new Uint8Array(30 + nameBytes.length + size)
    const localView = new DataView(localHeader.buffer)

    localView.setUint32(0, 0x04034b50, true) // Signature
    localView.setUint16(4, 20, true)         // Version needed
    localView.setUint16(6, 0, true)          // Flags
    localView.setUint16(8, 0, true)          // Compression (0 = Store)
    localView.setUint16(10, dosTime, true)   // Time
    localView.setUint16(12, dosDate, true)   // Date
    localView.setUint32(14, checksum, true)  // CRC-32
    localView.setUint32(18, size, true)      // Compressed size
    localView.setUint32(22, size, true)      // Uncompressed size
    localView.setUint16(26, nameBytes.length, true) // Name length
    localView.setUint16(28, 0, true)         // Extra length

    localHeader.set(nameBytes, 30)
    localHeader.set(data, 30 + nameBytes.length)
    localHeaders.push(localHeader)

    // Central Directory Header (46 bytes + name)
    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(centralHeader.buffer)

    centralView.setUint32(0, 0x02014b50, true) // Signature
    centralView.setUint16(4, 20, true)         // Version made by
    centralView.setUint16(6, 20, true)         // Version needed
    centralView.setUint16(8, 0, true)          // Flags
    centralView.setUint16(10, 0, true)         // Compression
    centralView.setUint16(12, dosTime, true)   // Time
    centralView.setUint16(14, dosDate, true)   // Date
    centralView.setUint32(16, checksum, true)  // CRC-32
    centralView.setUint32(20, size, true)      // Compressed size
    centralView.setUint32(24, size, true)      // Uncompressed size
    centralView.setUint16(28, nameBytes.length, true) // Name length
    centralView.setUint16(30, 0, true)         // Extra length
    centralView.setUint16(32, 0, true)         // Comment length
    centralView.setUint16(34, 0, true)         // Disk start
    centralView.setUint16(36, 0, true)         // Internal attrs
    centralView.setUint32(38, 0, true)         // External attrs
    centralView.setUint32(42, offset, true)    // Local header offset

    centralHeader.set(nameBytes, 46)
    centralHeaders.push(centralHeader)

    offset += localHeader.length
  }

  const centralDirOffset = offset
  let centralDirSize = 0
  for (const h of centralHeaders) centralDirSize += h.length

  // End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)

  eocdView.setUint32(0, 0x06054b50, true)  // Signature
  eocdView.setUint16(4, 0, true)           // Disk number
  eocdView.setUint16(6, 0, true)           // Disk start
  eocdView.setUint16(8, entries.length, true)  // Records this disk
  eocdView.setUint16(10, entries.length, true) // Total records
  eocdView.setUint32(12, centralDirSize, true) // Central dir size
  eocdView.setUint32(16, centralDirOffset, true) // Central dir offset
  eocdView.setUint16(20, 0, true)          // Comment length

  const allParts: Uint8Array[] = [...localHeaders, ...centralHeaders, eocd]
  // Each part owns a full ArrayBuffer; the cast narrows ArrayBufferLike for TS 5.7's BlobPart typing.
  return new Blob(allParts.map((part) => part.buffer as ArrayBuffer), { type: 'application/zip' })
}
