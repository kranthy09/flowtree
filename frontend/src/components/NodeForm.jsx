import { useState } from 'react'

const TYPE_OPTIONS = ['input', 'process', 'output']

function availableAsChild(nodes, excludeId) {
  return nodes.filter(
    (n) =>
      n.id !== excludeId &&
      !nodes.some(
        (other) =>
          other.left_child_id === n.id || other.right_child_id === n.id,
      ),
  )
}

function nodeLabel(n) {
  return `#${n.id}: ${n.name ?? `node ${n.id}`} (${n.value})`
}

export default function NodeForm({ nodes, onAdd }) {
  const [value, setValue] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [parentId, setParentId] = useState('')
  const [leftChildId, setLeftChildId] = useState('')
  const [rightChildId, setRightChildId] = useState('')
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
        parent_id: parentId ? parseInt(parentId, 10) : null,
        left_child_id: leftChildId ? parseInt(leftChildId, 10) : null,
        right_child_id: rightChildId ? parseInt(rightChildId, 10) : null,
      })
      setValue('')
      setName('')
      setType('')
      setParentId('')
      setLeftChildId('')
      setRightChildId('')
    } catch (err) {
      setError(err.message || 'Failed to add node')
    } finally {
      setLoading(false)
    }
  }

  const leftOptions = availableAsChild(
    nodes,
    rightChildId ? parseInt(rightChildId, 10) : null,
  )
  const rightOptions = availableAsChild(
    nodes,
    leftChildId ? parseInt(leftChildId, 10) : null,
  )

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
      <div className="flex gap-2 items-center flex-wrap">
        <label className="text-xs text-gray-400 w-12 shrink-0">Parent:</label>
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="flex-1 min-w-[110px] bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
        >
          <option value="">(none)</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>{nodeLabel(n)}</option>
          ))}
        </select>
        <label className="text-xs text-gray-400 shrink-0">L child:</label>
        <select
          value={leftChildId}
          onChange={(e) => setLeftChildId(e.target.value)}
          className="flex-1 min-w-[110px] bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
        >
          <option value="">(none)</option>
          {leftOptions.map((n) => (
            <option key={n.id} value={n.id}>{nodeLabel(n)}</option>
          ))}
        </select>
        <label className="text-xs text-gray-400 shrink-0">R child:</label>
        <select
          value={rightChildId}
          onChange={(e) => setRightChildId(e.target.value)}
          className="flex-1 min-w-[110px] bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
        >
          <option value="">(none)</option>
          {rightOptions.map((n) => (
            <option key={n.id} value={n.id}>{nodeLabel(n)}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </form>
  )
}
