#!/usr/bin/env node
/**
 * Automated Domain Switcher for SEVA·GIS
 * Usage: node scripts/set-domain.js <domain-name>
 * Examples:
 *   node scripts/set-domain.js sevagis.stusite.me
 *   node scripts/set-domain.js sevagis.is-a.bot
 *   node scripts/set-domain.js sevagis.is-a.dev
 *   node scripts/set-domain.js sevagis.dpdns.org
 */

import fs from 'node:fs'
import path from 'node:path'
import dns from 'node:dns'

const targetDomain = process.argv[2]?.trim().toLowerCase()

if (!targetDomain) {
  console.log('❌ Please provide a domain name.')
  console.log('Usage: node scripts/set-domain.js <domain-name>')
  console.log('Examples:')
  console.log('  node scripts/set-domain.js sevagis.stusite.me')
  console.log('  node scripts/set-domain.js sevagis.is-a.bot')
  console.log('  node scripts/set-domain.js sevagis.is-a.dev')
  console.log('  node scripts/set-domain.js sevagis.dpdns.org')
  process.exit(1)
}

const rootDir = process.cwd()
const publicCnamePath = path.join(rootDir, 'public', 'CNAME')
const rootCnamePath = path.join(rootDir, 'CNAME')

// Update CNAME files
fs.writeFileSync(publicCnamePath, targetDomain + '\n', 'utf8')
fs.writeFileSync(rootCnamePath, targetDomain + '\n', 'utf8')

console.log(`\n✅ Domain configuration updated in git!`)
console.log(`• public/CNAME -> ${targetDomain}`)
console.log(`• CNAME        -> ${targetDomain}`)
console.log(`\nNext steps for automatic deployment:`)
console.log(`1. git add public/CNAME CNAME`)
console.log(`2. git commit -m "chore: bind custom domain ${targetDomain}"`)
console.log(`3. git push origin main`)
console.log(`\nGitHub Actions (.github/workflows/pages.yml) will automatically build and publish to https://${targetDomain}\n`)

// Test DNS resolution
dns.resolveCname(targetDomain, (cnameErr, cnames) => {
  if (!cnameErr && cnames?.length) {
    console.log(`🌐 DNS Status: CNAME points to ${cnames.join(', ')}`)
  } else {
    dns.resolve4(targetDomain, (aErr, ips) => {
      if (!aErr && ips?.length) {
        console.log(`🌐 DNS Status: A record points to ${ips.join(', ')}`)
      } else {
        console.log(`⚠️ DNS Notice: ${targetDomain} has not resolved yet or is awaiting DNS record setup in your registrar.`)
      }
    })
  }
})
