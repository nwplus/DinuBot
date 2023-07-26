const { App } = require("@slack/bolt");
const { WebClient } = require("@slack/web-api");
const { getUserMatchings } = require("./src/matching");
const { formatUserIds } = require("./src/utils");
const { getMembersInChannel } = require("./src/dev_utils");

// Import the functions you need from the SDKs you need
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore"); // Import Firestore related functions
// const { getAnalytics } = require("firebase/analytics");
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

require("dotenv").config();


// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.apiKey,
  authDomain: process.env.authDomain,
  databaseURL: process.env.databaseURL,
  projectId: process.env.projectId,
  storageBucket: process.env.storageBucket,
  messagingSenderId: process.env.messagingSenderId,
  appId: process.env.appId,
  measurementId: process.env.measurementId
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(); // Initialize Firestore

const botToken = process.env.token;
const botSigningSecret = process.env.signingSecret;
const botAppToken = process.env.appToken;

const slackClient = new WebClient(botToken);

const slackBot = new App({
	token: botToken, //Find in the Oauth  & Permissions tab
	signingSecret: botSigningSecret, // Find in Basic Information Tab
	socketMode: true,
	appToken: botAppToken, // Token from the App-level Token that we created
});

// Commands (for dev)

slackBot.command("/test", async ({ command, event, say }) => {
	try {
		console.log(event);
		say(`<@${event}> hello!`);
	} catch (error) {
		console.error("Error running test command:", error);
	}
});

slackBot.message("getMembersInChannel", async ({ channel, command, say }) => {
	try {
		say("Printing members in channel to console...");
		getMembersInChannel(slackClient, "C05A02Q37FC"); // dinubot-test channel
	} catch (error) {
		console.error("Error getting members in channel:", error);
	}
});

slackBot.message("createGroupChat", async ({ command, say }) => {
	const userIds = "U03EJU7AVFD,U02HGHR0W3F"; // Donald and Yan's user ids for dev purposes
	createGroupChatAndSendMessage(userIds, "Hello World!");
});

slackBot.message("donutCheckin", async ({ command, say }) => {
	donutCheckin(
		"C05A02Q37FC",
		"Time for a midpoint check-in! The next round of donuts go out on...",
		"button_clicked",
	);
});

slackBot.message("createMatching", async ({ command, say }) => {
	// Temporarily multiple channel ids for dev
	const dinubotTestChannelID = "C05A02Q37FC";
	const dinubotAlphaTestChannelID = "C05FLQKBEA0";

	const channelID = dinubotAlphaTestChannelID;
	try {
		const membersInfo = await slackClient.conversations.members({
			channel: channelID,
		});

		memberIDs = membersInfo.members;

		// Remove DinuBot from the list of members in a channel so no one gets paired up with it
		const dinubotUserID = "U05A02QR4BU";
		const botIndex = memberIDs.indexOf(dinubotUserID);

		if (botIndex !== -1) {
			memberIDs.splice(botIndex, 1);
		}
		const matchings = getUserMatchings(memberIDs);
		console.log(matchings);
		for (matching of matchings) {
			const displayNames = [];
			for (userId of matching) {
				const userInfo = await slackClient.users.info({
					user: userId,
				});
				const displayName = userInfo.user["profile"]["real_name"];
				displayNames.push(displayName);
			}
			const messageText = `New donut!! ${displayNames.join(", ")}`;
			console.log(channelID);
			await slackClient.chat.postMessage({
				channel: channelID,
				text: messageText,
			});
			const matchingString = formatUserIds(matching);
			console.log(matchingString);

			// createGroupChatAndSendMessage(
			// 	matchingString,
			// 	"Hello you're on a donut ( ͡° ͜ʖ ͡°)!",
			// );
		}
	} catch (error) {
		console.error("Error creating matching:", error);
	}
});

// Functionality

const createGroupChatAndSendMessage = async (userIds, messageText) => {
	try {
		const conversation = await slackClient.conversations.open({
			users: userIds,
			return_im: true,
		});

		const date = new Date();
		date.setDate(date.getDate());

		if (conversation.ok) {
			await slackClient.chat.postMessage({
				channel: conversation.channel.id,
				text: messageText,
			});

			try {
				const threeDaysFromNow = new Date();
				threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
				// const oneMinuteFromNow = new Date();
				// oneMinuteFromNow.setTime(oneMinuteFromNow.getDate() + 1 * 60 * 1000); // Adding 1 minute in milliseconds

				const checkinMessage = await slackClient.chat.scheduleMessage({
					channel: conversation.channel.id,
					text: "Did you meet yet?",
					post_at: Math.floor(threeDaysFromNow.getTime() / 1000),
				});
			} catch (error) {
				console.error(error);
			}
		}
	} catch (error) {
		console.error("Error creating group chat and sending message:", error);
	}
};

// Button

slackBot.action({ callback_id: "button_clicked" }, async ({ ack, body, say }) => {
	try {
		await ack(); // Acknowledge the action request

		const buttonValue = body.actions[0].value;

		if (buttonValue === "didDonut") {
			// Handle the "Yes" button click
			say("You clicked 'Yes'.");
			// Perform the desired action for the "Yes" button
			// ...
		} else if (buttonValue === "scheduled") {
			// Handle the "It's scheduled" button click
			say("You clicked 'It's scheduled'.");
			// Perform the desired action for the "It's scheduled" button
			// ...
		} else if (buttonValue === "notScheduled") {
			// Handle the "Not yet" button click
			say("You clicked 'Not yet'.");
			// Perform the desired action for the "Not yet" button
			// ...
		} else {
			say("Unknown button action.");
		}
	} catch (error) {
		console.error("Error handling action:", error);
	}
});

const donutCheckin = async (channel, message, buttonAction) => {
	try {
		const response = await slackClient.chat.postMessage({
			channel: channel,
			text: message,
			attachments: [
				{
					text: "Click the button below:",
					fallback: "You are unable to interact with this button.",
					callback_id: buttonAction,
					actions: [
						{
							name: "button",
							text: "Yes",
							type: "button",
							value: "didDonut",
						},
						{
							name: "button",
							text: "It's scheduled",
							type: "button",
							value: "scheduled",
						},
						{
							name: "button",
							text: "Not yet",
							type: "button",
							value: "notScheduled",
						},
					],
				},
			],
		});

		console.log("Message sent successfully:", response.ts);
	} catch (error) {
		console.error("Error sending message:", error);
	}
};

slackBot.message("getFirebaseData", async ({command, say}) => {
	const dinuBotCollection = collection(db, "InternalProjects");
    // Do something with the collection, like querying or adding documents
    const querySnapshot = await getDocs(dinuBotCollection);
    // querySnapshot.forEach((doc) => {
    //   console.log(doc.id, " => ", doc.data());
    // });

	await slackClient.chat.postMessage({
		channel: "C05A02Q37FC",
		text: "oK",
	});
})

async function test() {
	const dinuBotCollection = collection(db, "InternalProjects");
    // Do something with the collection, like querying or adding documents
    const querySnapshot = await getDocs(dinuBotCollection);
	// console.log(querySnapshot)
}

test()

slackBot.start(3000);
