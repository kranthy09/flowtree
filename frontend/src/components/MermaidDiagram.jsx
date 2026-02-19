import { useEffect, useRef } from 'react'

let renderSeq = 0

const TYPE_STYLES = {
  input:   'fill:#1e40af,color:#dbeafe,stroke:#1e3a8a',
  process: 'fill:#92400e,color:#fef3c7,stroke:#78350f',
  output:  'fill:#166534,color:#dcfce7,stroke:#14532d',
}

function buildCode(nodes) {
  if (!nodes.length) {
    return 'graph TD\n  empty["No nodes yet"]'
  }

  const lines = []
  const styleLines = []

  for (const n of nodes) {
    const label = n.name ? `${n.name}\\n(${n.value})` : String(n.value)
    lines.push(`  n${n.id}["#35;${n.id}: ${label}"]`)
    if (n.type && TYPE_STYLES[n.type]) {
      styleLines.push(`  style n${n.id} ${TYPE_STYLES[n.type]}`)
    }
  }

  return (
    'graph TD\n' +
    lines.join('\n') +
    (styleLines.length ? '\n' + styleLines.join('\n') : '')
  )
}

export default function MermaidDiagram({ nodes }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || !window.mermaid) return

    const id = `mermaid-svg-${++renderSeq}`
    const code = buildCode(nodes)

    window.mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg
        }
      })
      .catch((err) => console.error('Mermaid render error:', err))
  }, [nodes])

  return (
    <div className="h-full flex items-start justify-center p-6 overflow-auto">
      <div ref={containerRef} className="mermaid-output" />
    </div>
  )
}
