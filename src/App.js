import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'; // Correct import for Firebase storage reference
import { ref as databaseRef, set, get } from 'firebase/database'; 
import { storage, database } from './firebase';
import axios from 'axios';
import Cookies from 'js-cookie';

// import { ref, get } from "firebase/database";

import './App.css';

function App() {
  const [formData, setFormData] = useState({
    username: '',
    phoneNumber: '',
    retailName: '',
    visitSummary: '',
    nextAction: '',
    metGM: '',
    metSD: '',
    interestLevel: '',
    liveDemoDelivered: '', // Reset new field

  });

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

  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  useEffect(() => {
    const storedUsername = Cookies.get('username');
    const storedPhoneNumber = Cookies.get('phoneNumber');

    setFormData({
      username: storedUsername || '',
      phoneNumber: storedPhoneNumber || '',
      retailName: '',
      visitSummary: '',
      nextAction: '',
      metGM: '',
      metSD: '',
      interestLevel: '',
      liveDemoDelivered: '', // Reset new field

    });

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

    // Set video constraints based on device type
    const userAgent = navigator.userAgent;
    if (/Android/i.test(userAgent) || /iPhone|iPad|iPod/i.test(userAgent)) {
      setVideoConstraints({ facingMode: { exact: 'environment' } }); // Back camera for mobile
    } else {
      setVideoConstraints({ facingMode: 'user' }); // Front camera for desktop
    }
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
        showAlertDialog("Please contact AutoService AI Support");
      });
    } else {
      showAlertDialog("Please contact AutoService AI Support");
    }
  };

  const sendNotification = async (data) => {
    const { phone, retailName, linkToBusCard, audioFile } = data;
    const channel = 'dealervisit';
    const time = new Date().toISOString();
    const gps = `${location.latitude}, ${location.longitude}`;
    const liveDemoMessage = formData.liveDemoDelivered ? ` - Live Demo Delivered: ${formData.liveDemoDelivered}` : '';


    const message = `User: ${phone} - RetailName: ${retailName} - Time: ${time} - LinkToBusCard: ${linkToBusCard} - GPS: ${gps}${liveDemoMessage}`;
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

    const isAllFieldsFilled = formData.username && formData.phoneNumber && formData.retailName && formData.visitSummary && formData.nextAction && formData.interestLevel && formData.metGM && formData.metSD && formData.liveDemoDelivered;

    if (!isAllFieldsFilled) {
      alert('Please fill all fields .');
      return;
    }

    Cookies.set('username', formData.username, { expires: 365 * 10 }); // Lasts for 10 years
    Cookies.set('phoneNumber', formData.phoneNumber, { expires: 365 * 10 });

    setShowProgress(true);

    const audioDownloadUrl = await handleAudioUpload();
    const imageDownloadUrl = await handleImageUpload();

    const dataRef = databaseRef(database, `formData/${formData.phoneNumber}/${Date.now()}`);
    await set(dataRef, {
      voiceUrl: audioDownloadUrl || null,
      businessCardUrl: imageDownloadUrl,
      gpsCoordinates: `${location.latitude}, ${location.longitude}` || null,
      interestLevel: formData.interestLevel,
      ...formData,
    });

    await sendNotification({
      phone: formData.phoneNumber,
      retailName: formData.retailName,
      linkToBusCard: imageDownloadUrl,
      audioFile: audioDownloadUrl,
    });


    callToTrello({
      ...formData,
      businessCardUrl: imageDownloadUrl // Add the image download URL here
    });

    setShowProgress(false);
    alert('Submitted successfully!');
  };

  const showAlertDialog = (message) => {
    alert(message);
  };

  //

 
  const callToTrello = async (data) => {
    const { username, retailName, visitSummary, metGM, metSD, liveDemoDelivered, interestLevel, nextAction,businessCardUrl} = data;
    const today = new Date();

    
    const MM = String(today.getMonth() + 1).padStart(2, '0');
    const DD = String(today.getDate()).padStart(2, '0');

    const board= await getBoardValue(formData.phoneNumber);
    
    //const board = "10-Sales"; // Default value if not found
    
    const formatDescription = (mm, dd, retailName, visitSummary, metGM, metSD, liveDemoDelivered, businessCardUrl) => {

      const encodedBusinessCardUrl = encodeURIComponent(businessCardUrl);

      return `${dd}/${mm} ${retailName} - ${visitSummary} NOTES// ${visitSummary} NEXT ACTIONS// ${nextAction} MET GM// ${metGM} MET SD// ${metSD} Business Card// ${encodedBusinessCardUrl} Live demo delivered// ${liveDemoDelivered}`;

  
      
   };

   const titleDesc=(mm,dd,retailName,visitSummary) =>{

    return `${dd}/${mm} ${retailName} - ${visitSummary}`
   };
   
   
    
    const determineListValue = (interestLevel) => {
      switch (interestLevel) {
        case "High":
          return "Hot";
        case "Medium":
          return "Warm";
        case "Low":
          return "Cold";
        default:
          return "Cold";
      }
    };
  
    const description = formatDescription(MM, DD, retailName, visitSummary, metGM, metSD, liveDemoDelivered,businessCardUrl);
    const listValue = determineListValue(interestLevel);

  const title=titleDesc(MM,DD,retailName,visitSummary);
    const trelloApi = `https://eu-west-1.aws.data.mongodb-api.com/app/application-2-febnp/endpoint/trelloAddTask?name=${title}&desc=${encodeURIComponent(description)}&board=${board}&list=${listValue}`;

    try {
        const apiResponse = await axios.get(trelloApi);
        if (apiResponse.status === 200) {
            console.log("Trello task added successfully");
        } else {
            console.log("Failed to add task to Trello");
        }
    } catch (error) {
        console.error('Error:', error);
        if (error.response) {
            console.log("Error status", error.response.status);
            console.log("Error details", error.response.data);
        }
    }
};

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
          console.log("Board value doesn't exist, assigning default '10-Sales'");
          const defaultBoardValue = "10-Sales";
          
          // Set the default value in Firebase
          await set(dbRef, defaultBoardValue);
          
          return defaultBoardValue; // Return the default value
      }
  } catch (error) {
      console.error("Error reading board value: ", error);
      return "10-Sales"; // Return default value if there's an error
  }
}

  
  //
  
  

  return (
    <div className="App">
      {isLoading && <div className="loading">Loading...</div>}
      {showProgress && <div className="progress-dialog">Please wait while uploading...</div>}
      {showDialog && (
        <div className="custom-dialog">
          <p>Please contact AutoService AI Support</p>
          <button onClick={() => setShowDialog(false)}>Close</button>
        </div>
      )}

      <h1>AutoService AI Notes</h1>
      <form onSubmit={handleSubmit}>
        <label>Name</label>
        <input type="text" name="username" value={formData.username} onChange={handleChange} />

        <label>Phone Number</label>
        <input type="text" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} />

        <label>Dealer Name</label>
        <input type="text" name="retailName" value={formData.retailName} onChange={handleChange} />

        <label>Live Demo Delivered?</label>
        <select name="liveDemoDelivered" value={formData.liveDemoDelivered} onChange={handleChange}>
          <option value="">Select</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>

        <label>Met GM?</label>
        <select name="metGM" value={formData.metGM} onChange={handleChange}>
          <option value="">Select</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>

        <label>Met SD?</label>
        <select name="metSD" value={formData.metSD} onChange={handleChange}>
          <option value="">Select</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
        
        <label>Interest Level</label>
        <select name="interestLevel" value={formData.interestLevel} onChange={handleInterestChange}>
          <option value="">Select Interest Level</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <label>Visit Summary</label>
        <textarea name="visitSummary" value={formData.visitSummary} onChange={handleChange} />

        <label>Next Action</label>
        <textarea name="nextAction" value={formData.nextAction} onChange={handleChange} />


        {isCameraVisible && (
          <>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints} // Use dynamic constraints based on device
            />
            <button type="button" onClick={captureImage}>Capture business cards</button>
          </>
        )}

        {capturedImageUrl && <img src={capturedImageUrl} alt="Captured" className="captured-image" />}

        <div className="recording-controls">
          <button
            type="button"
            className={`record-button ${isRecording ? 'recording' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? 'Stop Record Session / Training' : 'Record Session / Training'}
          </button>
        </div>

        <button type="submit">Submit</button>
      </form>
    </div>
  );
}

export default App;
