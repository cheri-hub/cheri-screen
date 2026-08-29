import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { Sala } from './pages/Sala'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sala/:id" element={<Sala />} />
      </Routes>
    </BrowserRouter>
  )
}
