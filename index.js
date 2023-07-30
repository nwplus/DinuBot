const { App } = require("@slack/bolt");
const { WebClient } = require("@slack/web-api");
const { getUserMatchings, createMatchings } = require("./src/matching");
const { formatUserIds } = require("./src/utils");
const { getMembersInChannel } = require("./src/dev_utils");

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore"); // Import Firestore related functions
const { endAt } = require("@firebase/firestore");

// const { getAnalytics } = require("firebase/analytics");
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

require("dotenv").config();

initializeApp({
	credential: applicationDefault(),
	databaseURL: "https://nwplus-ubc-dev.firebaseio.com",
});

// Initialize Firebase
const db = getFirestore();

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

// slackBot.command("/test", async ({ command, event, say }) => {
// 	try {
// 		console.log(event);
// 		say(`<@${event}> hello!`);
// 	} catch (error) {
// 		console.error("Error running test command:", error);
// 	}
// });

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

// slackBot.message("createMatching", async ({ command, say }) => {
// 	// Temporarily multiple channel ids for dev
// 	const dinubotTestChannelID = "C05A02Q37FC";
// 	const dinubotAlphaTestChannelID = "C05FLQKBEA0";

// 	const channelID = dinubotAlphaTestChannelID;
// 	try {
// 		const membersInfo = await slackClient.conversations.members({
// 			channel: channelID,
// 		});

// 		memberIDs = membersInfo.members;

// 		// Remove DinuBot from the list of members in a channel so no one gets paired up with it
// 		const dinubotUserID = "U05A02QR4BU";
// 		const botIndex = memberIDs.indexOf(dinubotUserID);

// 		if (botIndex !== -1) {
// 			memberIDs.splice(botIndex, 1);
// 		}
// 		const matchings = getUserMatchings(memberIDs);
// 		console.log(matchings);
// 		for (matching of matchings) {
// 			const displayNames = [];
// 			for (userId of matching) {
// 				const userInfo = await slackClient.users.info({
// 					user: userId,
// 				});
// 				const displayName = userInfo.user["profile"]["real_name"];
// 				displayNames.push(displayName);
// 			}
// 			const messageText = `New donut!! ${displayNames.join(", ")}`;
// 			console.log(channelID);
// 			await slackClient.chat.postMessage({
// 				channel: channelID,
// 				text: messageText,
// 			});
// 			const matchingString = formatUserIds(matching);
// 			console.log(matchingString);

// 			// createGroupChatAndSendMessage(
// 			// 	matchingString,
// 			// 	"Hello you're on a donut ( ͡° ͜ʖ ͡°)!",
// 			// );
// 		}
// 	} catch (error) {
// 		console.error("Error creating matching:", error);
// 	}
// });

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
				const sevenDaysFromNow = new Date();
				sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

				const checkinMessage = await slackClient.chat.scheduleMessage({
					channel: conversation.channel.id,
					text: "Time for a midpoint check-in! The next round of donuts go out next Monday! Did you meet yet? (buttons coming soon)",
					post_at: Math.floor(sevenDaysFromNow.getTime() / 1000)
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

slackBot.action(
	{ callback_id: "button_clicked" },
	async ({ ack, body, say }) => {
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
	},
);

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

// slackBot.message("getFirebaseData", async ({ command, say }) => {
// 	let documentRef = db.doc("InternalProjects/DinuBot");
// 	console.log(documentRef);
// 	documentRef.get().then((documentSnapshot) => {
// 		let data = documentSnapshot.data();
// 		console.log(`Retrieved data: ${JSON.stringify(data)}`);
// 	});

// 	await slackClient.chat.postMessage({
// 		channel: "C05A02Q37FC",
// 		text: "oK",
// 	});
// });

async function convertTimeStamp(unix_timestamp) {
	// Create a new JavaScript Date object based on the timestamp
	// multiplied by 1000 so that the argument is in milliseconds, not seconds.
	const date = new Date(unix_timestamp["_seconds"] * 1000);
	// Minutes part from the timestamp
	const day = date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
	return [day, date.getHours()];
}

// duplicate of previous algo
async function pairMembers(staticArray, dynamicArray) {
	// console.log(staticArray)
	// console.log(dynamicArray)
	// Temporarily multiple channel ids for dev
	// const channelID = "C05A02Q37FC"; // dinutest
	const channelID = process.env.channelID
	try {
		const membersInfo = await slackClient.conversations.members({
			channel: channelID,
		});

		// Get members in channel + Remove DinuBot from the list of members in a channel so no one gets paired up with it
		// memberIDs = membersInfo.members;
		// const dinubotUserID = "U05A02QR4BU";
		// const botIndex = memberIDs.indexOf(dinubotUserID);
		// if (botIndex !== -1) {
		// 	memberIDs.splice(botIndex, 1);
		// }

		// -------------- If member is not in either static or dynamic array, add them
		
		// const matchings = getUserMatchings(memberIDs);
		const [matchings, updatedDynamicArray] = createMatchings(staticArray, dynamicArray);

		for (matching of matchings) {
			const displayNames = [];
			for (userId of matching) {
				const userInfo = await slackClient.users.info({
					user: userId,
				});
				const displayName = userInfo.user["profile"]["real_name"];
				displayNames.push(displayName);
			}
			// const messageText = `New donut!! ${displayNames.join(", ")}`;
			// // console.log(channelID);
			// await slackClient.chat.postMessage({
			// 	channel: channelID,
			// 	text: messageText,
			// });
			const matchingString = formatUserIds(matching);
			// console.log(matchingString);

			createGroupChatAndSendMessage(
				matchingString,
				"Hello you're on a donut ( ͡° ͜ʖ ͡°)!",
			);
		}
		return [staticArray, updatedDynamicArray];
	} catch (error) {
		console.error("Error creating matching:", error);
	}
};

// ---------------------------------------------------------- GOOD FOR ACTUAL PROD


async function updateMemberArrays(staticArray, dynamicArray) {
	// Temporarily multiple channel ids for dev
	// const channelID = "C05A02Q37FC"; // dinutest
	const channelID = process.env.channelID

	const membersInfo = await slackClient.conversations.members({
		channel: channelID,
	});

	// Get members in channel + Remove DinuBot from the list of members in a channel so no one gets paired up with it
	memberIDs = membersInfo.members;
	const dinubotUserID = "U05A02QR4BU";
	const botIndex = memberIDs.indexOf(dinubotUserID);
	if (botIndex !== -1) {
		memberIDs.splice(botIndex, 1);
	}

	// checks to see if anyone has left the channel, if so, reset both arrays
	for (const staticMember of staticArray) {
		if (!(memberIDs.includes(staticMember))) {
			staticArray = [];
			dynamicArray = [];
		}
	}
	for (const dynamicMember of dynamicArray) {
		if (!(memberIDs.includes(dynamicMember))) {
			staticArray = [];
			dynamicArray = [];
		}
	}

	// shuffle memberIDs (incase members in channel changes)
	const shuffledMemberIDs = memberIDs.sort((a, b) => 0.5 - Math.random());

	for (const memberID of shuffledMemberIDs) {
		// if memberID is not in either arrays
		if (!(staticArray.includes(memberID) || dynamicArray.includes(memberID))) {
			// dynamicArray should > or = to staticArray
			if (staticArray.length == dynamicArray.length) {
				dynamicArray.push(memberID);
			}
			else {
				staticArray.push(memberID);
			}
		}
	}
	return [staticArray, dynamicArray];
}

// Determines if it's time to send out new donuts (runs on interval) 
async function timeForDonutScheduler() {
	let dinuBotData = db.doc("InternalProjects/DinuBot");
	dinuBotData.get().then((documentSnapshot) => {
		let statusData = documentSnapshot.data()["Status"];
		convertTimeStamp(statusData["schedule"]["nextDonut"]["dateToPairMembers"]).then(function(nextDonutDay) {
		const nextDonutDate = nextDonutDay[0];
		const nextDonutHour = nextDonutDay[1];
		// Today
		const today = new Date();
		const currentDate = today.getFullYear() + '-' + today.getMonth() + '-' + today.getDate();
		const currentHour = today.getHours();
		// Determine if we should pair members up now
		if (currentDate == nextDonutDate && currentHour == nextDonutHour) {

			// get current member arrays
			let currentStaticArray = statusData["groupOfMembers"]["groupOfMembersStatic"];
			let currentDynamicArray = statusData["groupOfMembers"]["groupOfMembersDynamic"];
			updateMemberArrays(currentStaticArray, currentDynamicArray).then(function (updatedArrays) {
				pairMembers(updatedArrays[0], updatedArrays[1]).then(function (updatedArrays) { // pair people up
					statusData["groupOfMembers"]["groupOfMemberStatic"] = updatedArrays[0] // even if it's static, update it in case members join/leave
					statusData["groupOfMembers"]["groupOfMemberDynamic"] = updatedArrays[1]
					const nextDonutDate = new Date();
					nextDonutDate.setDate(nextDonutDate.getDate() + 14);
					statusData["schedule"]["nextDonut"]["sent"] = true; // set sent to True (is this necessary?)
					statusData["schedule"]["nextDonut"]["dateToPairMembers"] = nextDonutDate; // set next donut date
					statusData["schedule"]["nextDonut"]["sent"] = false; // set sent to False (is this necessary?)
					// update data
					dinuBotData.firestore.doc("InternalProjects/DinuBot").update({Status: statusData})
				});
			});
		}
		else {
			console.log("Not time for donut yet")
		}
	});});
}

// runs interval to schedule donuts and update variables
// change this to 30 later, only need to run this every 30mins, not 0.2mins
const minutes = 30, the_interval = minutes * 60 * 1000;
setInterval(function() {
  // Check if donuts should be sent
  timeForDonutScheduler()
  // check if new members have been added (maybe a member join or leave event?)
}, the_interval);

// ------------------------------------------------------ ^^^

// for testing purposes

// timeForDonutScheduler()

// put this into scheduler later
// let dinuBotData = db.doc("InternalProjects/DinuBot");
// dinuBotData.get().then((documentSnapshot) => {
// 	let statusData = documentSnapshot.data()["Status"];
	
// 	let currentStaticArray = statusData["groupOfMembers"]["groupOfMembersStatic"];
// 	let currentDynamicArray = statusData["groupOfMembers"]["groupOfMembersDynamic"];
// 	updateMemberArrays(currentStaticArray, currentDynamicArray).then(function (updatedArrays) {
// 		pairMembers(updatedArrays[0], updatedArrays[1]).then(function (newArrays) {
// 			console.log(newArrays[0]);
// 			console.log(newArrays[1]);
// 		}) // pair people up
// 	})
// });

slackBot.start(3000);
