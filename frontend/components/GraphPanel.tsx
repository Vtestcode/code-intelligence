'use client'

import dynamic from 'next/dynamic'

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

export default function GraphPanel({
  graph,
  heightClass = 'h-[360px]',
}: {
  graph: { nodes: any[]; links: any[] }
  heightClass?: string
}) {
  if (!graph.nodes.length) {
    return (
      <div
        className={`relative flex w-full items-end overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)] p-6 ${heightClass}`}
      >
        <div className="absolute inset-0 opacity-80">
          <div className="absolute left-[14%] top-[34%] h-5 w-5 rounded-full border border-[var(--border)] bg-[#334155]" />
          <div className="absolute left-[28%] top-[52%] h-4 w-4 rounded-full border border-[var(--border)] bg-[#334155]" />
          <div className="absolute left-[42%] top-[28%] h-4 w-4 rounded-full border border-[var(--border)] bg-[#334155]" />
          <div className="absolute left-[58%] top-[48%] h-6 w-6 rounded-full border border-[var(--border)] bg-[#334155]" />
          <div className="absolute left-[70%] top-[36%] h-4 w-4 rounded-full border border-[var(--border)] bg-[#334155]" />
          <div className="absolute left-[76%] top-[58%] h-5 w-5 rounded-full border border-[var(--border)] bg-[#334155]" />
          <div className="absolute left-[50%] top-[66%] h-4 w-4 rounded-full border border-[var(--border)] bg-[#334155]" />
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M14 35 L28 53 L42 29 L58 49 L70 37 L76 60 L50 68 L28 53" stroke="rgba(148,163,184,0.52)" strokeWidth="0.45" fill="none" />
            <path d="M42 29 L70 37 L58 49 L50 68" stroke="rgba(148,163,184,0.36)" strokeWidth="0.35" fill="none" strokeDasharray="1.5 2" />
            <circle cx="58" cy="49" r="18" stroke="rgba(148,163,184,0.16)" strokeWidth="0.4" fill="none" strokeDasharray="1.2 1.6" />
          </svg>
        </div>
        <p className="relative z-10 text-lg font-medium text-white/78">Awaiting query to visualize graph</p>
      </div>
    )
  }

  return (
    <div className={`w-full overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--bg-base)] ${heightClass}`}>
      <ForceGraph2D
        graphData={graph}
        nodeLabel={(node: any) => `${node.kind}: ${node.name}`}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const label = String(node.name)
          const fontSize = 12 / globalScale
          ctx.font = `600 ${fontSize}px Inter, sans-serif`
          ctx.beginPath()
          ctx.arc(node.x, node.y, 5.5, 0, 2 * Math.PI, false)
          ctx.fillStyle = '#60a5fa'
          ctx.fill()
          ctx.fillStyle = '#f8fafc'
          ctx.fillText(label, node.x + 8, node.y + 4)
        }}
        linkLabel={(link: any) => link.label}
        linkColor={() => 'rgba(148, 163, 184, 0.34)'}
        linkWidth={() => 1.1}
        backgroundColor="rgba(0,0,0,0)"
      />
    </div>
  )
}
