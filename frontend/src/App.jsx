import { useNodes } from './hooks/useNodes'
import Layout from './components/Layout'

export default function App() {
  const { nodes, error, add, update, remove } = useNodes()

  return (
    <Layout
      nodes={nodes}
      error={error}
      onAdd={add}
      onUpdate={update}
      onDelete={remove}
    />
  )
}
