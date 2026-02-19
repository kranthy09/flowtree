import { useState, useEffect, useCallback } from 'react'
import {
  fetchNodes,
  createNode,
  updateNode,
  deleteNode,
} from '../api/nodes'

export function useNodes() {
  const [nodes, setNodes] = useState([])
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const data = await fetchNodes()
      setNodes(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const add = useCallback(async (data) => {
    await createNode(data)
    await refresh()
  }, [refresh])

  const update = useCallback(async (id, data) => {
    await updateNode(id, data)
    await refresh()
  }, [refresh])

  const remove = useCallback(async (id) => {
    await deleteNode(id)
    await refresh()
  }, [refresh])

  return { nodes, error, add, update, remove, refresh }
}
