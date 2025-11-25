import React, { useEffect, useState } from 'react'
import api from '../lib/api'

export default function ViewerList({ streamId }:{ streamId:string }) {
  const [viewers, setViewers] = useState<string[]>([])
  useEffect(()=>{
    (async ()=>{
      try {
        const res = await api.get(`/api/streams/${streamId}/viewers`)
        setViewers(res.data || [])
      } catch(err){}
    })()
  },[streamId])

  return (
    <div className="space-y-2">
      {viewers.length === 0 && <div className="text-slate-500 text-sm">No viewers yet</div>}
      {viewers.map((v,i)=>(
        <div key={i} className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-200 rounded-full" />
          <div className="text-sm font-mono">{v}</div>
        </div>
      ))}
    </div>
  )
}
