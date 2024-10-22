/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const axios = require('axios');

// const {onRequest} = require("firebase-functions/v2/https");
// const logger = require("firebase-functions/logger");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = functions.https.onRequest((request, response) => {
//   response.send("Hello from Firebase!");
// });


exports.sendDailyReport = functions.pubsub.schedule('0 16 * * *') // Runs at 4:00 PM UTC
    .timeZone('America/New_York') // Replace with your desired timezone
    .onRun(async (context) => {
        const currentDate = new Date();
        const formattedDate = currentDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD

        // Reference to the path where usernames are stored
        const usersRef = admin.database().ref('formData'); // Adjust this path as necessary

        try {
            // Fetch all usernames
            const usersSnapshot = await usersRef.once('value');
            const usernames = usersSnapshot.val();

            // Iterate over usernames to send reports for each user
            for (const username in usernames) {
                const notesRef = admin.database().ref(`formData/${username}/${formattedDate}`); // Reference to today's date

                const snapshot = await notesRef.once('value');
                if (snapshot.exists()) {
                    const notesCount = snapshot.numChildren(); // Get the number of notes for today

                    const message = `Daily Report for ${username}: Visits: ${notesCount}`;
                    const slackUrl = `https://eu-west-1.aws.data.mongodb-api.com/app/application-2-febnp/endpoint/sendSlackNotification?channel=sales&message=${encodeURIComponent(message)}`;

                    await axios.get(slackUrl);
                    console.log(`Daily report sent to Slack for user: ${username}`);
                } else {
                    console.log(`No notes added today for user: ${username}.`);
                }
            }
        } catch (error) {
            console.error("Error sending daily report:", error);
        }
    });
