import { useNodes } from './hooks/useNodes'
import { useExecutions } from './hooks/useExecutions'
import Layout from './components/Layout'

export default function App() {
  const { nodes, error, add, update, remove, selectedNode, selectNode } = useNodes()
  const { activeRun, loading: runLoading, runError, execute, clearActiveRun } = useExecutions()

  return (
    <Layout
      nodes={nodes}
      error={error}
      onAdd={add}
      onUpdate={update}
      onDelete={remove}
      selectedNode={selectedNode}
      selectNode={selectNode}
      activeRun={activeRun}
      onRun={execute}
      onClearRun={clearActiveRun}
      runLoading={runLoading}
      runError={runError}
    />
  )
}
