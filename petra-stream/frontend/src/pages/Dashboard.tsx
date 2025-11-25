import React, { useEffect, useState } from 'react'
import api from '../lib/api'
import socket from '../lib/socket'
import CreatorStats from '../components/CreatorStats'
import StreamControls from '../components/StreamControls'

export default function Dashboard() {
  const [streams, setStreams] = useState<any[]>([])
  const [active, setActive] = useState<any | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/streams/active')
        setStreams(res.data || [])
        setActive(res.data?.[0] ?? null)
      } catch (err) {
        console.error(err)
      }
    })()

    socket.connect()
    socket.on('stream-update', (payload:any) => {
      // quick merge/replace
      setStreams((s) => {
        const idx = s.findIndex(x => x.streamer === payload.streamer)
        if (idx === -1) return [payload, ...s]
        const copy = [...s]
        copy[idx] = payload
        return copy
      })
    })

    return () => {
      socket.off('stream-update')
      socket.disconnect()
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Creator Dashboard</h1>
        <div className="text-sm text-slate-500">Manage your streams, tips, and settings</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow">
            <StreamControls currentStream={active} onUpdated={(s)=>setActive(s)} />
          </div>

          <div className="bg-white rounded-2xl p-4 shadow">
            <h3 className="font-semibold mb-2">Recent Streams</h3>
            <div className="space-y-2">
              {streams.map((s)=>(
                <div key={s.streamer} className="flex items-center justify-between p-3 rounded border">
                  <div>
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-slate-500">{s.streamer}</div>
                  </div>
                  <div className="text-sm text-slate-600">{s.viewerCount ?? 0} viewers</div>
                </div>
              ))}
              {streams.length === 0 && <div className="text-slate-500">No recent streams</div>}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <CreatorStats />
          <div className="bg-white rounded-2xl p-4 shadow">
            <h4 className="font-semibold mb-2">Quick Links</h4>
            <div className="flex flex-col gap-2">
              <a className="text-sm text-petra-500" href="/dashboard">Stream Settings</a>
              <a className="text-sm text-petra-500" href="/dashboard">Withdraw Funds</a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
