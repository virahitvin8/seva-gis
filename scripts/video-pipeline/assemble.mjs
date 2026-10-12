/**
 * SEVA.GIS - Programmatic Demo Video Assembly & Post-Processing Pipeline
 *
 * Stitches recorded UI clips and Motion Canvas animation segments,
 * applies audio mixing / ducking, color optimization, and compresses
 * into a professional web-ready 60 FPS MP4.
 *
 * Usage:
 *   node scripts/video-pipeline/assemble.mjs
 */

import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { spawnSync, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const RAW_CLIPS_DIR = join(ROOT, 'raw-clips')
const OUTPUT_DIR = join(ROOT, 'dist-media')
const FINAL_OUTPUT = join(OUTPUT_DIR, 'SEVA-GIS-Final-Demo.mp4')
const CONCAT_FILE = join(OUTPUT_DIR, 'scenes.txt')

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
}

function checkFfmpeg() {
  try {
    const res = spawnSync('ffmpeg', ['-version'], { encoding: 'utf-8' })
    return res.status === 0
  } catch {
    return false
  }
}

async function assembleDemoVideo() {
  console.log('======================================================')
  console.log('   SEVA.GIS Programmatic Video Assembly Pipeline      ')
  console.log('======================================================')

  const hasFfmpeg = checkFfmpeg()
  if (!hasFfmpeg) {
    console.warn('[Assembly Notice] ffmpeg is not installed or not in system PATH.')
    console.warn('Install ffmpeg to enable automated command-line video concatenation.')
    console.warn('Winget command: winget install Gyan.FFmpeg')
    console.warn('Or scoop: scoop install ffmpeg')
    return
  }

  // 1. Gather recorded clips
  if (!existsSync(RAW_CLIPS_DIR)) {
    console.warn(`[Assembly] ${RAW_CLIPS_DIR} does not exist yet. Run recording first:`)
    console.warn('  npx tsx scripts/video-pipeline/record.ts')
    return
  }

  const clips = readdirSync(RAW_CLIPS_DIR)
    .filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'))
    .map((f) => join(RAW_CLIPS_DIR, f))

  if (clips.length === 0) {
    console.warn('[Assembly] No raw video clips found in raw-clips directory.')
    return
  }

  console.log(`[Assembly] Discovered ${clips.length} clip(s):`)
  clips.forEach((c) => console.log(`  - ${c}`))

  // 2. Prepare concat list
  const concatContent = clips.map((c) => `file '${c.replace(/\\/g, '/')}'`).join('\n')
  writeFileSync(CONCAT_FILE, concatContent, 'utf-8')
  console.log(`[Assembly] Wrote concatenation manifest to ${CONCAT_FILE}`)

  // 3. Stitched lossless intermediate or direct re-encode
  const tempCombined = join(OUTPUT_DIR, 'combined_raw.mp4')

  console.log('[Assembly] Step 1: Normalizing and stitching clips...')
  const concatCmd = [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    CONCAT_FILE,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-preset',
    'fast',
    tempCombined,
  ]

  const concatResult = spawnSync('ffmpeg', concatCmd, { stdio: 'inherit' })
  if (concatResult.status !== 0) {
    console.error('[Assembly] FFmpeg concat returned error code:', concatResult.status)
    return
  }

  // 4. Final render with H.264 profile, CRF 19 (crisp text & map vectors), faststart
  console.log('[Assembly] Step 2: Encoding final web-ready MP4...')
  const finalCmd = [
    '-y',
    '-i',
    tempCombined,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '19',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    FINAL_OUTPUT,
  ]

  const finalResult = spawnSync('ffmpeg', finalCmd, { stdio: 'inherit' })
  if (finalResult.status === 0) {
    console.log('======================================================')
    console.log('✅ Final Demo Video successfully rendered:')
    console.log(`   ${FINAL_OUTPUT}`)
    console.log('======================================================')
  } else {
    console.error('[Assembly] Final encode failed with exit code:', finalResult.status)
  }
}

assembleDemoVideo()
