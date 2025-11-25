import React, { useEffect, useState } from 'react'
import api from '../lib/api'

export default function CreatorStats() {
  const [stats, setStats] = useState<any>({ viewers:0, tips:0, earnings:0 })

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/creator/stats')
        setStats(res.data || stats)
      } catch (err) {
        // fall back to dummy values
        setStats({ viewers: 12, tips: 3, earnings: 1.24 })
      }
    })()
  }, [])

  return (
    <div className="bg-white rounded-2xl p-4 shadow">
      <h4 className="font-semibold mb-3">Creator Stats</h4>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold">{stats.viewers ?? 0}</div>
          <div className="text-xs text-slate-500">Viewers</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{stats.tips ?? 0}</div>
          <div className="text-xs text-slate-500">Tips</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{Number(stats.earnings ?? 0).toFixed(3)}</div>
          <div className="text-xs text-slate-500">Earnings (ETH)</div>
        </div>
      </div>
    </div>
  )
}
