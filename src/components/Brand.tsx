import React from 'react'

export function Brand({ size = 56 }: { size?: number }) {
  const baseUrl = import.meta.env.BASE_URL || '/'
  const logoSrc = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}logo.svg`

  return (
    <div className="brand" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <img
        src={logoSrc}
        alt="SEVA·GIS logo"
        width={size}
        height={size}
        onError={(e) => {
          e.currentTarget.src = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}logo.png`
        }}
        style={{ willChange: 'transform' }}
      />
      <h1 style={{ color: '#38f2d0', fontSize: size >= 48 ? 24 : 18, fontWeight: 800, margin: 0, letterSpacing: '0.04em' }}>
        SEVA·GIS
      </h1>
    </div>
  )
}

export default Brand
