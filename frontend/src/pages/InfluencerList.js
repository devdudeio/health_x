import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const InfluencerList = () => {
  const [influencers, setInfluencers] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:5001/influencers')
      .then(res => {
        setInfluencers(res.data);
      })
      .catch(err => console.error(err));
  }, []);

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Influencer Leaderboard</h2>
      <table border="1" cellPadding="6" style={{ marginTop: '1rem' }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Handle</th>
            <th>Followers</th>
            <th>Trust Score</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {influencers.map((inf) => (
            <tr key={inf.influencer_id}>
              <td>{inf.name}</td>
              <td>@{inf.handle}</td>
              <td>{inf.follower_count}</td>
              <td>{inf.trust_score.toFixed(2)}</td>
              <td>
                <Link to={`/influencer/${inf.influencer_id}`}>View Details</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InfluencerList;
