'use client'

// Last-resort boundary: replaces the root layout, so it must render its own <html> and use no app styles.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf9', color: '#1c1917', textAlign: 'center', padding: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ margin: '0 0 20px', color: '#57534e' }}>Please try again. Your pins and settings are safe.</p>
          <button onClick={reset} style={{ background: '#e60023', color: '#fff', border: 0, borderRadius: 8, padding: '10px 18px', fontSize: 15, cursor: 'pointer' }}>Try again</button>
        </div>
      </body>
    </html>
  )
}
