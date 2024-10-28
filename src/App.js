import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { BrowserRouter as Router, Route, useNavigate, Routes } from 'react-router-dom'; // Import Router components
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'; // Correct import for Firebase storage reference
import { ref as databaseRef, set, get } from 'firebase/database'; 
import { storage, database } from './firebase';
import { WebcamCapture} from './Webcam'

import axios from 'axios';
// Import the Material-UI switch component
import Switch from './Switch'; // Import your Switch component


import Cookies from 'js-cookie';

// import { ref, get } from "firebase/database";

import './App.css';

function App() {
  const navigate = useNavigate(); 
  const [dialogMessage, setDialogMessage] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    phoneNumber: '',
    retailName: '',
    visitSummary: '',
    nextAction: '',
    board:'',
    metGM: false,
    metSD: false,
    interestLevel: '',
    revisit:false,
    liveDemoDelivered: false, // Reset new field

  });



  const [dailyReportCount, setDailyReportCount] = useState(0);

  const [location, setLocation] = useState({ latitude: null, longitude: null });
  const [imageUrl, setImageUrl] = useState('');
  const [capturedImageUrl, setCapturedImageUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [isCameraVisible, setIsCameraVisible] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [audioChunks, setAudioChunks] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [videoConstraints, setVideoConstraints] = useState({});
  const [isWebcamActive, setIsWebcamActive] = useState(true); // State to control webcam display

  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  const [isUsernamePhoneHidden, setIsUsernamePhoneHidden] = useState(false); // State to manage hiding fields
  const [boardExists, setBoardExists] = useState(true); // New state to track if board value exists
  const [newBoardValue, setNewBoardValue] = useState(''); // New state to store new board value input



  useEffect(() => {
    const storedUsername = Cookies.get('username');
    const storedPhoneNumber = Cookies.get('phoneNumber');

    const checkBoardValue = async () => {
      try {
        console.log("checkBoardValue() called");
        console.log("Fetching board value for username:", formData.username);
    
        const boardRef = databaseRef(database, `formData/${formData.username}/board`);
        console.log("Board reference:", boardRef);
    
        const boardSnapshot = await get(boardRef);
        console.log("Board snapshot fetched:", boardSnapshot);
    
        if (boardSnapshot.exists()) {
          console.log("Board value exists:", boardSnapshot.val());
    
          setFormData(prevData => ({
            ...prevData,
            board: boardSnapshot.val(),
          }));
    
          setBoardExists(true); // Board value exists, no need to show input field
          console.log("Board exists. Input field will not be shown.");
        } else {
          console.log("Board value does not exist for the user.");
    
          setBoardExists(false); // Board value does not exist, show input field
          console.log("Board does not exist. Input field will be shown.");
        }
      } catch (error) {
        console.error("Error in checkBoardValue():", error);
      }
    };
    
    if (storedUsername && storedPhoneNumber) {
      setIsUsernamePhoneHidden(true); // Hide fields if both values exist
      setFormData((prevData) => ({
        ...prevData,
        username: storedUsername,
        phoneNumber: storedPhoneNumber,
      }));
    }

    setShowDialog(false); // Hide the dialog
   
    const checkLocationPermission = async () => {
      const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
  
      if (permissionStatus.state === 'granted') {
        fetchLocation();
      } else if (permissionStatus.state === 'denied') {
        console.log('Location permission denied.');
      } else {
        if (!localStorage.getItem('locationPermissionAsked')) {
          const confirmRequest = window.confirm('This app requires access to your location. Would you like to allow it?');
          if (confirmRequest) {
            fetchLocation();
          }
          localStorage.setItem('locationPermissionAsked', 'true');
        }
      }
    };
  
    checkLocationPermission();
    fetchLocation();

      // Detect if the device is mobile or desktop
      const userAgent = navigator.userAgent;
      if (/Android/i.test(userAgent) || /iPhone|iPad|iPod/i.test(userAgent)) {
        setVideoConstraints({ facingMode: { exact: 'environment' } }); // Back camera for mobile
      } else {
        setVideoConstraints({ facingMode: 'user' }); // Front camera for desktop
      }

      if (formData.username==null || storedUsername==null) {
        setBoardExists(false); 
      }else{
        checkBoardValue();
      }

  
  }, [formData.username]);   ///

  // const handleChange = (e) => {
  //   setFormData({ ...formData, [e.target.name]: e.target.value });
  // };
 
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  };
 
  const handlePermissionRequest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('Camera and audio permissions granted');
    } catch (error) {
      console.log('Camera and audio permissions denied:', error);
      alert('Please enable camera and audio permissions in your browser settings to use this feature.');
    }
  };

  const handleBoardValueSubmit = async () => {
    const boardRef = databaseRef(database, `users/${formData.username}/board`);
    await set(boardRef, newBoardValue);

    setFormData(prevData => ({
      ...prevData,
      boardValue: newBoardValue,
    }));

    setBoardExists(true); // After setting the board value, hide the input field
  };

  const handleInterestChange = (e) => {
    setFormData({ ...formData, interestLevel: e.target.value });
  };

  

  const captureImage = () => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setImageUrl(imageSrc);
      setCapturedImageUrl(imageSrc);
      setIsCameraVisible(false);
    }
  };
  
  const handleSwitchChange = (name) => {
    setFormData((prevData) => ({
      ...prevData,
      [name]: !prevData[name], // Toggle the value
    }));
  };

  const getYesNoValue = (value) => {
    return value ? "yes" : "no";
  };

  const startRecording = () => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        mediaRecorderRef.current = new MediaRecorder(stream);
        mediaRecorderRef.current.ondataavailable = (e) => {
          setAudioChunks((prev) => [...prev, e.data]);
        };
        mediaRecorderRef.current.start();
        setIsRecording(true);
      })
      .catch(() => {
        showAlertDialog("Please contact AutoService AI Support");
      });
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.onstop = async () => {
      const audioDownloadUrl = await handleAudioUpload();
      setAudioUrl(audioDownloadUrl);
    };
    setIsRecording(false);
  };

  const handleAudioUpload = async () => {
    if (audioChunks.length > 0) {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const file = new File([audioBlob], `${timestamp}.wav`);
      const audioStorageRef = storageRef(storage, `audio/${file.name}`);

      try {
        const snapshot = await uploadBytes(audioStorageRef, file);
        const audioDownloadUrl = await getDownloadURL(snapshot.ref);
        return audioDownloadUrl;
      } catch (error) {
        console.error('Audio upload failed:', error);
        return null;
      }
    }
    return null;
  };

  const handleImageUpload = async () => {
    if (imageUrl) {
      const byteString = atob(imageUrl.split(',')[1]);
      const mimeString = imageUrl.split(',')[0].split(':')[1].split(';')[0];
      const arrayBuffer = new ArrayBuffer(byteString.length);
      const intArray = new Uint8Array(arrayBuffer);
      for (let i = 0; i < byteString.length; i++) {
        intArray[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([intArray], { type: mimeString });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const file = new File([blob], `${timestamp}.jpg`);
      const imageStorageRef = storageRef(storage, `images/${file.name}`);

      try {
        await uploadBytes(imageStorageRef, file);
        const imageDownloadUrl = await getDownloadURL(imageStorageRef);
        return imageDownloadUrl;
      } catch (error) {
        console.error('Image upload failed:', error);
        return null;
      }
    }
    return null;
  };

  const fetchLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      }, () => {
       //showAlertDialog("Please go to your settings menu and update permissions or user another browser");
      });
    } else {
      showAlertDialog("Please go to your settings menu and update location permissions or user another browser");
    }
  };

  const sendNotification = async (data) => {
    const {username, phone, retailName, linkToBusCard, audioFile,revisit} = data;
    const channel = 'dealervisit';
    const time = new Date().toISOString();
    const gps = `${location.latitude}, ${location.longitude}`;
    const liveDemoMessage = formData.liveDemoDelivered ? ` - Live Demo Delivered: ${getYesNoValue(formData.liveDemoDelivered)}` : '';


    const message = `Username: ${username} - Phone: ${phone} - RetailName: ${retailName} - Time: ${time} - LinkToBusCard: ${linkToBusCard} - GPS: ${gps}${liveDemoMessage} - Re-Visit: ${getYesNoValue(revisit)}`;
    const slackUrl = `https://eu-west-1.aws.data.mongodb-api.com/app/application-2-febnp/endpoint/sendSlackNotification?channel=${channel}&message=${encodeURIComponent(message)}`;

    try {
      setIsLoading(true);
      const slackResponse = await axios.get(slackUrl);

      if (slackResponse.status === 200) {
        console.log('Notification sent successfully');
      }

      const apiMessage = `User: ${phone}, Retail Name: ${retailName}, Time: ${time}, GPS: ${gps}, Bus Card: ${linkToBusCard}, Audio: ${audioFile}${liveDemoMessage}`;
      const apiUrl = `https://common.autoservice.ai/app?phone=${phone}&message=${encodeURIComponent(apiMessage)}`;

      //


      //
      const apiResponse = await axios.get(apiUrl);

      if (apiResponse.status === 200) {
        console.log('API request sent successfully');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

  


    if (!formData.username) {
      alert('Please fill in the Username.');
      return;
    }
    
    if (!formData.phoneNumber) {
      alert('Please fill in the Phone Number.');
      return;

    }

    if(!formData.board){
      alert('Please add board value.');
      return;
    }

    if (!formData.retailName) {
      alert('Please fill in the Retail Name.');
      return;

    }
    
    if (!formData.visitSummary) {
      alert('Please fill in the Visit Summary.');
      return;

    }
    
    if (!formData.nextAction) {
      alert('Please fill in the Next Action.');
      return;

    }
    
    if (!formData.interestLevel) {
      alert('Please select the Interest Level.');
      return;

    }


    handleBoardValueSubmit();

    setShowProgress(true);

    const audioDownloadUrl = await handleAudioUpload();
    const imageDownloadUrl = await handleImageUpload();

    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().split('T')[0]

    const dataRef = databaseRef(database, `formData/${formData.username}/${formattedDate}/${Date.now()}`);

    const submissionData = {
      ...formData,
      metGM: getYesNoValue(formData.metGM),
      metSD: getYesNoValue(formData.metSD),
      revisit:getYesNoValue(formData.revisit),
      liveDemoDelivered: getYesNoValue(formData.liveDemoDelivered), // Assuming liveDemoDelivered is also a switch
    };


    await set(dataRef, {
      voiceUrl: audioDownloadUrl || null,
      businessCardUrl: imageDownloadUrl,
      gpsCoordinates: `${location.latitude}, ${location.longitude}` || null,
      interestLevel: formData.interestLevel,
      phoneNumber: formData.phoneNumber,
      username: formData.username,
      retailName:formData.retailName,
      nextAction:formData.nextAction,
      visitSummary:formData.visitSummary,
      ...submissionData,
    });

    await sendNotification({
      username: formData.username,
      phone: formData.phoneNumber,
      retailName: formData.retailName,
      linkToBusCard: imageDownloadUrl,
      audioFile: audioDownloadUrl,
      revisit: formData.revisit
    });


    callToTrello({
      ...formData,
      businessCardUrl: imageDownloadUrl // Add the image download URL here
    });

    setShowProgress(false);
   
    Cookies.set('username', formData.username, { expires: 365 * 10 }); // Lasts for 10 years
    Cookies.set('phoneNumber', formData.phoneNumber, { expires: 365 * 10 });

    setIsUsernamePhoneHidden(true); // Hide the fields after successful submission


    // Navigate to success page
    navigate('/success');
  };

  const showAlertDialog = (message) => {
    alert(message);
  };

  //

 
  const callToTrello = async (data) => {

    var gm= getYesNoValue(formData.metGM);
    var sd= getYesNoValue(formData.metSD);
    var revisit= getYesNoValue(formData.revisit);

    var ldd= getYesNoValue(formData.liveDemoDelivered);

    const { username, retailName, visitSummary, metGM, metSD, liveDemoDelivered, interestLevel, nextAction,businessCardUrl} = data;
    const today = new Date();

    
    const MM = String(today.getMonth() + 1).padStart(2, '0');
    const DD = String(today.getDate()).padStart(2, '0');

    const board= await getBoardValue(formData.username);
    
    //const board = "00-MyBoard"; // Default value if not found
    
    const formatDescription = (mm, dd, retailName, visitSummary, metGM, metSD, liveDemoDelivered, businessCardUrl,revisit) => {

      const encodedBusinessCardUrl = encodeURIComponent(businessCardUrl);

      return `${dd}/${mm} ${retailName} - ${visitSummary} NOTES// ${visitSummary} NEXT ACTIONS// ${nextAction} MET GM// ${gm} MET SD// ${sd} Business Card// ${encodedBusinessCardUrl} Live demo delivered// ${ldd} Re-Visit// ${revisit}`;

  
      
   };

   const titleDesc=(mm,dd,retailName,nextAction) =>{

    return `${mm}/${dd} ${retailName} - ${nextAction}`
   };
   
   
    
    const determineListValue = (interestLevel) => {
      switch (interestLevel) {
        case "High":
          return "Hot";
        case "Medium":
          return "Warm";
        case "Low":
          return "Cold";
        case "Do Not Know":
          return "Cold";
        default:
          return "Cold";
      }
    };
  
    const description = formatDescription(MM, DD, retailName, visitSummary, metGM, metSD, liveDemoDelivered,businessCardUrl,revisit);
    const listValue = determineListValue(interestLevel);

  const title=titleDesc(MM,DD,retailName,nextAction);
    const trelloApi = `https://eu-west-1.aws.data.mongodb-api.com/app/application-2-febnp/endpoint/trelloAddTask?name=${title}&desc=${encodeURIComponent(description)}&board=${board}&list=${listValue}`;

    try {
        const apiResponse = await axios.get(trelloApi);
        if (apiResponse.status === 200) {
            console.log("Trello task added successfully");
        } else {
            console.log("Failed to add task to Trello");
        }
    } catch (error) {
      const trelloApiError = `https://eu-west-1.aws.data.mongodb-api.com/app/application-2-febnp/endpoint/trelloAddTask?name=${title}&desc=${encodeURIComponent(description)}&board=00-MyBoard&list=${listValue}`;

      const response = await axios.get(trelloApiError);
        console.error('Error:', error);
        if (error.response) {
            console.log("Error status", error.response.status);
            console.log("Error details", error.response.data);

        }
    }
};

//


//

async function getBoardValue(phoneNumber) {
  const dbRef = databaseRef(database, `formData/${phoneNumber}/board`);

  try {
      // Get the board value
      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
          const boardValue = snapshot.val();
          console.log(`Board value: ${boardValue}`);
          return boardValue; // Return the value if it exists
      } else {
          console.log("Board value doesn't exist, assigning default '00-MyBoard'");
          const defaultBoardValue = "00-MyBoard";
          
          // Set the default value in Firebase
          await set(dbRef, defaultBoardValue);
          
          return defaultBoardValue; // Return the default value
      }
  } catch (error) {
      console.error("Error reading board value: ", error);
      return "00-MyBoard"; // Return default value if there's an error
  }
}

    
return (
  <div className="App">
    {isLoading && <div className="loading">Loading...</div>}
    {showProgress && <div className="progress-dialog">Please wait while uploading...</div>}
    

   
       {isLoading && <div className="loading">Loading...</div>}
       {showProgress && <div className="progress-dialog">Please wait while uploading...</div>}
      

    


    <form className="responsive-form" onSubmit={handleSubmit}>
      {!isUsernamePhoneHidden && (
        <>
          <div className="form-group">

            <input type="text" name="username" value={formData.username} onChange={handleChange} placeholder="Your name" />
            <label>Your Name</label>

          </div>
          <div className="form-group">
            <input type="number" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="Your phone number" />
            <label>Your Phone</label>
          </div>
        </>
      )}

     

      {!boardExists && (
        <div className="form-group">
          <input type="text" name="board" value={formData.board} onChange={handleChange} placeholder="Board value" />
          <label>Sales Board</label>
        </div>
      )}

      <div className="form-group">
        <input type="text" name="retailName" value={formData.retailName} onChange={handleChange} placeholder="Client name" />
        <label>Client Name</label>
      </div>

      <div className="switch-container">
        <div className="switch-group">
          <Switch checked={formData.liveDemoDelivered} onChange={() => handleSwitchChange('liveDemoDelivered')} />
          <label>Live Demo</label>
        </div>
        <div className="switch-group">
          <Switch checked={formData.revisit} onChange={() => handleSwitchChange('revisit')} />
          <label>Re-Visit</label>
        </div>
        <div className="switch-group">
          <Switch checked={formData.metGM} onChange={() => handleSwitchChange('metGM')} />
          <label>Met GM</label>
        </div>
        <div className="switch-group">
          <Switch checked={formData.metSD} onChange={() => handleSwitchChange('metSD')} />
          <label>Met SD</label>
        </div>
      </div>

      <div className="form-group">
        <select name="interestLevel" value={formData.interestLevel} onChange={handleInterestChange} >
          <option value="">Select Interest Level</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
          <option value="Do Not Know">Do Not Know</option>
        </select>
        <label>Interest Level</label>
      </div>

      <div className="form-group">
        <textarea name="visitSummary" value={formData.visitSummary} onChange={handleChange} placeholder="Visit summary" />
        <label>Visit Summary</label>
      </div>

      <div className="form-group">
        <textarea name="nextAction" value={formData.nextAction} onChange={handleChange} placeholder="Next Action" />
        <label>Next Action</label>
      </div>

      <div style={{ width: '100%', height: '140px', overflow: 'hidden' }}>
        {capturedImageUrl === '' && (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
          />
        )}
        {capturedImageUrl && <img src={capturedImageUrl} alt="Captured" className="captured-image" />}
      </div>

      <div className="capture-container">
        <button type="button" onClick={captureImage}>Capture business cards</button>
        <button type="submit">Submit</button>
      </div>

      <div className="recording-controls">
        <button type="button" className={`record-button ${isRecording ? 'recording' : ''}`} onClick={isRecording ? stopRecording : startRecording}>
          {isRecording ? 'Stop Record Session / Training' : 'Record Session / Training'}
        </button>
      </div>
    </form>
  </div>
);

}


const SuccessPage = () => (
  <div className="success-container">
    <h2>Success!</h2>
    <p>Your data has been submitted successfully.</p>
    <a href="/" style={{ color: 'white', fontWeight: 'bold', textTransform: 'uppercase' }}>
  Go Back
</a>

  </div>
);
const Main = () => (
  <Router>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/success" element={<SuccessPage />} />
    </Routes>
  </Router>
);

export default Main;
