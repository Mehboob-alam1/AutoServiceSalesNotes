import React from 'react';
import { useHistory } from 'react-router-dom';

const SuccessPage = () => {
  const history = useHistory();

  const handleBackToForm = () => {
    // Navigate back to the form page
    history.push('/form');
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>Submission Successful!</h2>
      <p>Your report has been successfully submitted.</p>
      <button onClick={handleBackToForm} style={{ padding: '10px 20px', marginTop: '20px' }}>
        Back to Form
      </button>
    </div>
  );
};

export default SuccessPage;
