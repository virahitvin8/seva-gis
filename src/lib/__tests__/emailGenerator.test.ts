import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReportEmailHtml,
  buildReportEmailPlainText,
  generateEmlPackage,
  executeEmailPackageDelivery,
} from '../emailGenerator'

test('buildReportEmailHtml generates valid HTML with key telemetry and links', () => {
  const html = buildReportEmailHtml({
    recipientEmail: 'farmer@example.com',
    farmName: 'Krishna Valley Field',
    reportId: 'SEVA-2026-TEST',
    areaHa: 8.45,
    ndvi: 0.74,
    ndmi: 0.38,
    filename: 'Krishna_Valley_Report.html',
    htmlContent: '<html><body>Full Report Content</body></html>',
  })

  assert.ok(html.includes('Krishna Valley Field'))
  assert.ok(html.includes('0.74'))
  assert.ok(html.includes('0.38'))
  assert.ok(html.includes('SEVA-2026-TEST'))
  assert.ok(html.includes('Krishna_Valley_Report.html'))
  assert.ok(html.includes('farmer@example.com'))
})

test('buildReportEmailPlainText generates clean plain text executive summary', () => {
  const plain = buildReportEmailPlainText({
    recipientEmail: 'farmer@example.com',
    farmName: 'Krishna Valley Field',
    reportId: 'SEVA-2026-TEST',
    areaHa: 8.45,
    ndvi: 0.74,
    ndmi: 0.38,
    filename: 'Krishna_Valley_Report.html',
    htmlContent: '<html><body>Full Report Content</body></html>',
  })

  assert.ok(plain.includes('Krishna Valley Field'))
  assert.ok(plain.includes('8.45 ha'))
  assert.ok(plain.includes('0.74'))
  assert.ok(plain.includes('https://sevagis.dpdns.org'))
})

test('generateEmlPackage compiles RFC 822 MIME package with Gmail web and mailto links', async () => {
  const result = generateEmlPackage({
    recipientEmail: 'analyst@farmcorp.com',
    farmName: 'North Ridge Watershed',
    reportId: 'SEVA-9901',
    areaHa: 22.1,
    ndvi: 0.68,
    ndmi: 0.29,
    filename: 'North_Ridge_Report.html',
    htmlContent: '<h1>Academic Cartography Report</h1>',
  })

  assert.ok(result.emlFilename.endsWith('.eml'))
  assert.ok(result.emlBlob instanceof Blob)
  assert.ok(result.gmailWebUrl.startsWith('https://mail.google.com/mail/?view=cm'))
  assert.ok(result.gmailWebUrl.includes(encodeURIComponent('analyst@farmcorp.com')))
  assert.ok(result.mailtoUrl.startsWith('mailto:analyst%40farmcorp.com'))

  const emlText = await result.emlBlob.text()
  assert.ok(emlText.includes('From: "SEVA.GIS Report Sentinel"'))
  assert.ok(emlText.includes('To: <analyst@farmcorp.com>'))
  assert.ok(emlText.includes('MIME-Version: 1.0'))
  assert.ok(emlText.includes('Content-Type: multipart/mixed'))
  assert.ok(emlText.includes('North_Ridge_Report.html'))
})

test('executeEmailPackageDelivery completes zero-error fallback and returns action data', async () => {
  const res = await executeEmailPackageDelivery({
    recipientEmail: 'field@telangana.gov.in',
    farmName: 'Gajwel Demo',
    reportId: 'SEVA-GAJWEL-01',
    areaHa: 12.0,
    ndvi: 0.72,
    ndmi: 0.35,
    filename: 'Gajwel_Report.html',
    htmlContent: '<html><body>Gajwel Parcel Analysis</body></html>',
  })

  assert.equal(res.success, true)
  assert.ok(res.message.length > 0)
  assert.ok(res.packageData.emlFilename.includes('Gajwel'))
})
