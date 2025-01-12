import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import InfluencerList from './pages/InfluencerList';
import InfluencerDetail from './pages/InfluencerDetail';

function App() {
  return (
    <Router>
      <div>
        <nav style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
          <Link to="/">Leaderboard</Link>
        </nav>
        <Routes>
          <Route path="/" element={<InfluencerList />} />
          <Route path="/influencer/:id" element={<InfluencerDetail />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
