import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../lib/api'
import socket from '../lib/socket'
import TipModal from '../components/TipModal'

export default function StreamPage() {
  const { id } = useParams<{ id: string }>()
  const [stream, setStream] = useState<any>(null)
  const [tips, setTips] = useState<any[]>([])
  const [openTip, setOpenTip] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/api/streams/${id}`)
        setStream(res.data)
      } catch (err) { console.error(err) }
    })()

    socket.connect()
    socket.emit('join', `stream:${id}`)
    socket.on('tip', (payload:any) => {
      if (payload.to?.toLowerCase() === id?.toLowerCase()) {
        setTips(prev => [payload, ...prev])
      }
    })

    return () => {
      socket.off('tip')
      socket.disconnect()
    }
  }, [id])

  async function refreshTips() {
    try {
      const res = await api.get(`/api/streams/${id}/tips`)
      setTips(res.data || [])
    } catch (err) { console.error(err) }
  }

  useEffect(()=>{ refreshTips() }, [id])

  if (!stream) return <div className="text-slate-600">Loading stream...</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 bg-white rounded-xl shadow p-4">
        <div className="aspect-video bg-black rounded-md mb-4 flex items-center justify-center text-white">
          <div>
            <div className="text-2xl font-bold">{stream.title}</div>
            <div className="text-sm text-slate-400 mt-1">Live • {stream.viewerCount || 0} viewers</div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">Streamer: <span className="font-mono">{stream.streamer}</span></div>
          <div className="flex gap-3">
            <button onClick={()=>setOpenTip(true)} className="px-4 py-2 bg-petra-500 text-white rounded-md">Tip</button>
          </div>
        </div>

        <section className="mt-6">
          <h4 className="font-semibold mb-2">Chat & Activity</h4>
          <div className="space-y-3">
            {tips.map((t,i)=>(
              <div key={i} className="p-3 bg-slate-50 rounded">
                <div className="text-xs text-slate-500">{t.txHash ?? 'onchain'}</div>
                <div className="text-sm">{t.from} tipped {t.amount ?? t.tokenId ?? '—'}</div>
              </div>
            ))}
            {tips.length === 0 && <div className="text-slate-400">No tips yet.</div>}
          </div>
        </section>
      </div>

      <aside className="bg-white rounded-xl shadow p-4">
        <h4 className="font-semibold">About</h4>
        <p className="text-sm text-slate-600 mt-2">{stream.description}</p>
        <div className="mt-4">
          <h5 className="text-xs text-slate-500">Stream Address</h5>
          <div className="font-mono text-sm mt-1">{stream.streamer}</div>
        </div>
      </aside>

      {openTip && <TipModal streamer={String(id)} onClose={()=>setOpenTip(false)} onTipped={()=>refreshTips()} />}
    </div>
  )
}
