import React, { useState } from 'react'
import api from '../lib/api'

export default function StreamControls({ currentStream, onUpdated }:{ currentStream?:any, onUpdated:(s:any)=>void }) {
  const [title, setTitle] = useState(currentStream?.title ?? '')
  const [desc, setDesc] = useState(currentStream?.description ?? '')
  const [live, setLive] = useState(Boolean(currentStream?.isLive))

  async function startStop() {
    try {
      // call backend to mark live / not live
      const res = await api.post(`/api/streams/${currentStream?.streamer ?? 'me'}/toggle`, { live: !live }).catch(()=>null)
      setLive(!live)
      if (res?.data) onUpdated(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  async function saveMeta() {
    try {
      const res = await api.post(`/api/streams/${currentStream?.streamer ?? 'me'}/update`, { title, description: desc }).catch(()=>null)
      if (res?.data) onUpdated(res.data)
      alert('Saved')
    } catch (err) {
      console.error(err)
      alert('Save failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">{currentStream?.title ?? 'Untitled stream'}</div>
          <div className="text-sm text-slate-500">{currentStream?.streamer ?? 'You'}</div>
        </div>
        <div className="flex gap-3">
          <button onClick={startStop} className={`px-4 py-2 rounded ${live ? 'bg-red-500 text-white' : 'bg-petra-500 text-white'}`}>
            {live ? 'Stop Stream' : 'Go Live'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <input className="p-3 border rounded" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Stream title" />
        <textarea className="p-3 border rounded" value={desc} onChange={(e)=>setDesc(e.target.value)} placeholder="Short description" />
        <div className="flex justify-end gap-2">
          <button onClick={saveMeta} className="px-4 py-2 bg-slate-800 text-white rounded">Save</button>
        </div>
      </div>
    </div>
  )
}
