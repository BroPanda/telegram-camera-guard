import React from 'react';

function WaitingScreen({ group, onCancel }) {
  return (
    <div className="screen">
      <div className="card glass center" style={{ marginTop: '20%' }}>
        <div className="loader"></div>
        <h3>Очікування підтвердження</h3>
        <p>Власник групи повинен схвалити ваш вступ</p>
        <p style={{ opacity: 0.6 }}>Група: {group?.name || group?.id}</p>
        <button onClick={onCancel} className="text-btn">Відмінити</button>
      </div>
    </div>
  );
}

export default WaitingScreen;
