import { useState } from 'react'

const TYPE_OPTIONS = ['input', 'process', 'output']

const TYPE_BADGE = {
  input:   'bg-blue-900 text-blue-200',
  process: 'bg-amber-900 text-amber-200',
  output:  'bg-green-900 text-green-200',
}

function TypeBadge({ type }) {
  if (!type) return <span className="text-gray-500 text-xs">—</span>
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[type] ?? 'bg-gray-700 text-gray-300'}`}>
      {type}
    </span>
  )
}

function NodeRow({ node, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(String(node.value))
  const [editName, setEditName] = useState(node.name ?? '')
  const [editType, setEditType] = useState(node.type ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    const n = parseInt(editValue, 10)
    if (isNaN(n)) {
      setError('Value must be an integer')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onUpdate(node.id, {
        value: n,
        name: editName.trim() || null,
        type: editType || null,
      })
      setEditing(false)
    } catch (err) {
      setError(err.message || 'Update failed')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditing(false)
    setEditValue(String(node.value))
    setEditName(node.name ?? '')
    setEditType(node.type ?? '')
    setError('')
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      await onDelete(node.id)
    } catch (err) {
      setError(err.message || 'Delete failed')
      setLoading(false)
    }
  }

  if (editing) {
    return (
      <tr className="border-b border-gray-700 bg-gray-800">
        <td className="px-3 py-2 text-gray-400 text-sm w-10">#{node.id}</td>
        <td className="px-3 py-2 text-sm" colSpan={3}>
          <div className="flex gap-2 flex-wrap">
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Value"
              autoFocus
              className="w-24 bg-gray-700 border border-indigo-500 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none"
            />
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Name"
              className="flex-1 min-w-[100px] bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            />
            <select
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">— type —</option>
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="flex gap-1">
              <button
                onClick={handleSave}
                disabled={loading}
                className="text-xs bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-2 py-1 rounded"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="text-xs bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white px-2 py-1 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-700 hover:bg-gray-800/50">
      <td className="px-3 py-2 text-gray-400 text-sm w-10">#{node.id}</td>
      <td className="px-3 py-2 text-sm font-mono text-gray-100">{node.value}</td>
      <td className="px-3 py-2 text-sm">
        {node.name
          ? <span className="text-gray-200">{node.name}</span>
          : <span className="text-gray-600">—</span>
        }
      </td>
      <td className="px-3 py-2 text-sm">
        <TypeBadge type={node.type} />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <div className="flex gap-1 justify-end">
          <button
            onClick={() => setEditing(true)}
            disabled={loading}
            className="text-xs bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white px-2 py-1 rounded"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="text-xs bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white px-2 py-1 rounded"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function NodeList({ nodes, onUpdate, onDelete }) {
  if (!nodes.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        No nodes yet — add one above.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full">
        <thead className="bg-gray-800 sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase w-10">ID</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase">Val</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase">Name</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => (
            <NodeRow
              key={node.id}
              node={node}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
