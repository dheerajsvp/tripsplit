import { Route, Routes } from 'react-router-dom'
import AddExpensePage from './pages/AddExpensePage'
import CreateTripPage from './pages/CreateTripPage'
import SettleUpPage from './pages/SettleUpPage'
import TripDashboardPage from './pages/TripDashboardPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<CreateTripPage />} />
      <Route path="/t/:code" element={<TripDashboardPage />} />
      <Route path="/t/:code/add" element={<AddExpensePage />} />
      <Route path="/t/:code/settle" element={<SettleUpPage />} />
    </Routes>
  )
}

export default App
