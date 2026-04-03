import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Processing from './pages/Processing'
import ApiDocs from './pages/ApiDocs'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/processing" element={<Processing />} />
      <Route path="/api-docs" element={<ApiDocs />} />
    </Routes>
  )
}

export default App
