import { useState } from 'react'

const TYPE_OPTIONS = ['input', 'process', 'output']

export default function NodeForm({ onAdd }) {
  const [value, setValue] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const n = parseInt(value, 10)
    if (isNaN(n)) {
      setError('Value must be an integer')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onAdd({
        value: n,
        name: name.trim() || null,
        type: type || null,
      })
      setValue('')
      setName('')
      setType('')
    } catch (err) {
      setError(err.message || 'Failed to add node')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border-b border-gray-700 space-y-2">
      <div className="flex gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value *"
          className="w-24 shrink-0 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:border-indigo-500"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="flex-1 min-w-0 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:border-indigo-500"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded px-2 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
        >
          <option value="">— type —</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium whitespace-nowrap"
        >
          + Add
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </form>
  )
}
