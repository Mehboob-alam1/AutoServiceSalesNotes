
// Switch.js
import React from 'react';
import './Switch.css'; // Create this CSS file for styling

const Switch = ({ checked, onChange }) => {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="slider" />
    </label>
  );
};

export default Switch;
