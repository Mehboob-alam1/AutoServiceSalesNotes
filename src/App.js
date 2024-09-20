import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam'; // For camera capture
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as databaseRef, set } from 'firebase/database';
import { storage, database } from './firebase';
import axios from 'axios'; // Import axios for making HTTP requests
import './App.css'; // Importing the CSS file

function App() {
  const [formData, setFormData] = useState({
    phoneNumber: '',
    retailName: '',
    visitSummary: '',
    nextAction: '',
    metGM: '',
    metSD: '',
    interestLevel: '',
  });

  const [location, setLocation] = useState({ latitude: null, longitude: null });
  const [imageUrl, setImageUrl] = useState('');
  const [capturedImageUrl, setCapturedImageUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');

  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioChunks, setAudioChunks] = useState([]);

  useEffect(() => {
    fetchLocation(); // Automatically fetch location on component mount
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
      setCapturedImageUrl(imageSrc); // Set captured image URL for display
    } else {
      console.error('Image capture failed!');
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
      .catch((error) => {
        console.error("Microphone error:", error);
        alert("Microphone not found or permission denied.");
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
    } else {
      console.error('No audio data recorded!');
      return null;
    }
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
      }, (error) => {
        console.error("Location error:", error);
        alert("Unable to retrieve your location.");
      });
    }
  };

  // New function to send notification
  const sendNotification = async ({
    user,
    phone,
    retailName,
    time,
    gps,
    metGM,
    metSD,
    linkToBusCard,
    audioFile,
  }) => {
    const channel = 'dealervisit';

    // Construct the message for Slack notification
    const message = `User:${user} - RetailName:${retailName} - Time:${time} - LinkToBusCard:${linkToBusCard} - GPS:${gps} - MetGM:${metGM} - MetSD:${metSD} - AudioFile:${audioFile}`;

    // Construct the Slack notification URL
    const slackUrl = `https://eu-west-1.aws.data.mongodb-api.com/app/application-2-febnp/endpoint/sendSlackNotification?channel=${channel}&message=${encodeURIComponent(message)}`;

    console.log('Constructed Slack URL:', slackUrl); // Print URL for debugging

    try {
      // Send Slack notification
      const slackResponse = await axios.get(slackUrl);

      if (slackResponse.status === 200) {
        console.log('Notification sent successfully');
      } else {
        console.log('Failed to send Slack notification:', slackResponse.status);
      }

      // Construct the message for the API request by concatenating all fields
      const apiMessage = `User: ${user}, Retail Name: ${retailName}, Time: ${time}, GPS: ${gps}, Met GM: ${metGM}, Met SD: ${metSD}, Bus Card: ${linkToBusCard}, Audio: ${audioFile}`;

      // Construct the API URL
      const apiUrl = `https://common.autoservice.ai/app?phone=${phone}&message=${encodeURIComponent(apiMessage)}`;

      console.log('Constructed API URL:', apiUrl); // Print API URL for debugging

      // Send request to the external API
      const apiResponse = await axios.get(apiUrl);

      if (apiResponse.status === 200) {
        console.log('API request sent successfully');
      } else {
        console.log('Failed to send API request:', apiResponse.status);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all fields except audio
    if (!formData.phoneNumber || !formData.retailName || !formData.visitSummary || !formData.nextAction || !formData.interestLevel || !formData.metGM || !formData.metSD || !imageUrl) {
      alert('Please fill all fields and capture an image before submitting.');
      return;
    }

    const audioDownloadUrl = await handleAudioUpload();
    const imageDownloadUrl = await handleImageUpload();

    if (!audioDownloadUrl || !imageDownloadUrl) {
      alert('Failed to upload audio or image.');
      return;
    }

    const dataRef = databaseRef(database, `formData/${formData.phoneNumber}/${Date.now()}`);
    await set(dataRef, {
      voiceUrl: audioDownloadUrl,
      businessCardUrl: imageDownloadUrl,
      gpsCoordinates: `${location.latitude}, ${location.longitude}`,
      interestLevel: formData.interestLevel,
      ...formData,
    });

    // Send notification after successful data submission
    await sendNotification({
      user: "Your User Name", // replace with actual user
      phone: formData.phoneNumber,
      retailName: formData.retailName,
      time: new Date().toISOString(),
      gps: `${location.latitude}, ${location.longitude}`,
      metGM: formData.metGM,
      metSD: formData.metSD,
      linkToBusCard: imageDownloadUrl,
      audioFile: audioDownloadUrl,
    });

    alert('Data successfully submitted');
  };

  return (
    <div className="container">
      <h1>Auto Service AI Notes</h1>
      <form onSubmit={handleSubmit}>
        <label>Phone Number</label>
        <input type="text" name="phoneNumber" required onChange={handleChange} />

        <label>Retail Name</label>
        <input type="text" name="retailName" required onChange={handleChange} />

        <label>Met GM</label>
        <div className="radio-group">
          <input type="radio" name="metGM" value="yes" required onChange={handleChange} /> Yes
          <input type="radio" name="metGM" value="no" required onChange={handleChange} /> No
        </div>

        <label>Met SD</label>
        <div className="radio-group">
          <input type="radio" name="metSD" value="yes" required onChange={handleChange} /> Yes
          <input type="radio" name="metSD" value="no" required onChange={handleChange} /> No
        </div>

        <label>Interested</label>
        <select name="interestLevel" required onChange={handleInterestChange}>
          <option value="" disabled selected>Select interest level</option>
          <option value="Hot">1-30 days close</option>
          <option value="Warm">30-60 days</option>
          <option value="Cold">Cold</option>
        </select>

        <label>Visit Summary</label>
        <textarea name="visitSummary" required onChange={handleChange}></textarea>

        <label>Next Action</label>
        <textarea name="nextAction" required onChange={handleChange}></textarea>

        <div className="webcam-container">
          <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" />
          <button type="button" onClick={captureImage}>Capture Image</button>
          {capturedImageUrl && <img src={capturedImageUrl} alt="Captured" className="captured-image" />}
        </div>

        <button type="button" onClick={isRecording ? stopRecording : startRecording}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>

        <button type="submit">Save</button>
      </form>
    </div>
  );
}

export default App;
