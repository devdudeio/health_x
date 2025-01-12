import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const InfluencerDetail = () => {
  const { id } = useParams();
  const [influencer, setInfluencer] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  useEffect(() => {
    axios.get(`http://localhost:5001/influencers/${id}`)
      .then(res => setInfluencer(res.data))
      .catch(err => console.error(err));
  }, [id]);

  const handleAnalyze = () => {
    axios.post(`http://localhost:5001/analyze/${id}`)
      .then(res => {
        setAnalysisResult(res.data);
        // Refresh influencer data
        return axios.get(`http://localhost:5001/influencers/${id}`);
      })
      .then(res => setInfluencer(res.data))
      .catch(err => console.error(err));
  };

  if (!influencer) return <div>Loading...</div>;

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Influencer Detail</h2>
      <p>Name: {influencer.name}</p>
      <p>Handle: @{influencer.handle}</p>
      <p>Follower Count: {influencer.follower_count}</p>
      <p>Trust Score: {influencer.trust_score?.toFixed(2)}</p>

      <button onClick={handleAnalyze}>Analyze Influencer</button>

      {analysisResult && (
        <div style={{ marginTop: '1rem' }}>
          <h4>Analysis Summary</h4>
          <pre>{JSON.stringify(analysisResult, null, 2)}</pre>
        </div>
      )}

      <h3>Claims</h3>
      <table border="1" cellPadding="6" style={{ marginTop: '1rem' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Claim Text</th>
            <th>Category</th>
            <th>Verification Status</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {influencer.claims.map((claim) => (
            <tr key={claim.claim_id}>
              <td>{claim.claim_id}</td>
              <td>{claim.claim_text}</td>
              <td>{claim.category}</td>
              <td>{claim.verification_status}</td>
              <td>{claim.confidence_score?.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InfluencerDetail;
