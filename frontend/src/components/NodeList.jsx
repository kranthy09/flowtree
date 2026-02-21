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

/**
 * Returns nodes that can be assigned as a left or right child of currentNodeId.
 * Excludes: self, excludeId (the other child slot), and nodes already owned
 * as a child by any node other than currentNodeId.
 */
function availableAsChild(nodes, currentNodeId, excludeId) {
  return nodes.filter(
    (n) =>
      n.id !== currentNodeId &&
      n.id !== excludeId &&
      !nodes.some(
        (other) =>
          other.id !== currentNodeId &&
          (other.left_child_id === n.id || other.right_child_id === n.id),
      ),
  )
}

function nodeLabel(n) {
  return `#${n.id}: ${n.name ?? `node ${n.id}`} (${n.value})`
}

function RelBadge({ label, node }) {
  if (!node) return <span className="text-gray-600 text-xs">—</span>
  return (
    <span className="text-xs text-indigo-300 bg-indigo-900/40 px-1.5 py-0.5 rounded mr-1 inline-block">
      {label} #{node.id}
    </span>
  )
}

function NodeRow({ node, allNodes, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(String(node.value))
  const [editName, setEditName] = useState(node.name ?? '')
  const [editType, setEditType] = useState(node.type ?? '')
  const [editParentId, setEditParentId] = useState(
    node.parent_id != null ? String(node.parent_id) : '',
  )
  const [editLeftChildId, setEditLeftChildId] = useState(
    node.left_child_id != null ? String(node.left_child_id) : '',
  )
  const [editRightChildId, setEditRightChildId] = useState(
    node.right_child_id != null ? String(node.right_child_id) : '',
  )
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
        parent_id: editParentId ? parseInt(editParentId, 10) : null,
        left_child_id: editLeftChildId ? parseInt(editLeftChildId, 10) : null,
        right_child_id: editRightChildId ? parseInt(editRightChildId, 10) : null,
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
    setEditParentId(node.parent_id != null ? String(node.parent_id) : '')
    setEditLeftChildId(node.left_child_id != null ? String(node.left_child_id) : '')
    setEditRightChildId(node.right_child_id != null ? String(node.right_child_id) : '')
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

  const otherNodes = allNodes.filter((n) => n.id !== node.id)
  const parentNode = allNodes.find((n) => n.id === node.parent_id) ?? null
  const leftNode = allNodes.find((n) => n.id === node.left_child_id) ?? null
  const rightNode = allNodes.find((n) => n.id === node.right_child_id) ?? null

  const leftOptions = availableAsChild(
    allNodes,
    node.id,
    editRightChildId ? parseInt(editRightChildId, 10) : null,
  )
  const rightOptions = availableAsChild(
    allNodes,
    node.id,
    editLeftChildId ? parseInt(editLeftChildId, 10) : null,
  )

  if (editing) {
    return (
      <tr className="border-b border-gray-700 bg-gray-800">
        <td className="px-3 py-2 text-gray-400 text-sm w-10 align-top">#{node.id}</td>
        <td className="px-3 py-2 text-sm" colSpan={5}>
          <div className="flex gap-2 flex-wrap items-start">
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Value"
              autoFocus
              className="w-20 bg-gray-700 border border-indigo-500 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none"
            />
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Name"
              className="flex-1 min-w-[90px] bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
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
          </div>
          <div className="flex gap-2 flex-wrap items-center mt-1">
            <span className="text-xs text-gray-500 w-12 shrink-0">Parent:</span>
            <select
              value={editParentId}
              onChange={(e) => setEditParentId(e.target.value)}
              className="flex-1 min-w-[110px] bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">(none)</option>
              {otherNodes.map((n) => (
                <option key={n.id} value={n.id}>{nodeLabel(n)}</option>
              ))}
            </select>
            <span className="text-xs text-gray-500 w-4 shrink-0">L:</span>
            <select
              value={editLeftChildId}
              onChange={(e) => setEditLeftChildId(e.target.value)}
              className="flex-1 min-w-[110px] bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">(none)</option>
              {/* Always include the currently-assigned left child even if filtered */}
              {node.left_child_id != null &&
                !leftOptions.some((n) => n.id === node.left_child_id) && (
                  <option value={node.left_child_id}>
                    {nodeLabel(allNodes.find((n) => n.id === node.left_child_id) ?? { id: node.left_child_id, name: null, value: '?' })}
                  </option>
                )}
              {leftOptions.map((n) => (
                <option key={n.id} value={n.id}>{nodeLabel(n)}</option>
              ))}
            </select>
            <span className="text-xs text-gray-500 w-4 shrink-0">R:</span>
            <select
              value={editRightChildId}
              onChange={(e) => setEditRightChildId(e.target.value)}
              className="flex-1 min-w-[110px] bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">(none)</option>
              {/* Always include the currently-assigned right child even if filtered */}
              {node.right_child_id != null &&
                !rightOptions.some((n) => n.id === node.right_child_id) && (
                  <option value={node.right_child_id}>
                    {nodeLabel(allNodes.find((n) => n.id === node.right_child_id) ?? { id: node.right_child_id, name: null, value: '?' })}
                  </option>
                )}
              {rightOptions.map((n) => (
                <option key={n.id} value={n.id}>{nodeLabel(n)}</option>
              ))}
            </select>
            <div className="flex gap-1 ml-auto shrink-0">
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
      <td className="px-3 py-2 text-sm">
        {parentNode && (
          <span className="text-xs text-gray-400 bg-gray-700/50 px-1.5 py-0.5 rounded mr-1 inline-block">
            ↑ #{parentNode.id}
          </span>
        )}
        <RelBadge label="L→" node={leftNode} />
        <RelBadge label="R→" node={rightNode} />
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
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase">Rels</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => (
            <NodeRow
              key={node.id}
              node={node}
              allNodes={nodes}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
