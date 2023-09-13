const { App } = require("@slack/bolt");
const { WebClient } = require("@slack/web-api");
const { getUserMatchings, createMatchings } = require("./src/matching");
const { formatUserIds, convertTimeStamp } = require("./src/utils");
const {
	getMembersInChannel,
	donutCheckin,
	scheduleMessage,
} = require("./src/dev_utils");

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
const channelID = process.env.channelID;

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
		getMembersInChannel(slackClient, channelID); // dinubot-test channel
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
		slackClient,
		channelID,
		"Time for a midpoint check-in! The next round of donuts go out on...",
		"button_clicked",
	);
});

slackBot.message("scheduleMessage", async ({ command, say }) => {
	scheduleMessage(slackClient, channelID);
});

slackBot.message("Running", async ({ command, say }) => {
	say("Running");
})

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

slackBot.action(
	{ callback_id: "donutCheckin" },
	async ({ ack, body, say }) => {
		try {
			await ack(); // Acknowledge the action request

			// Reminder: body contains info about the button, message, etc
			const buttonValue = body.actions[0].value;
			// console.log(body["channel"]["id"]);
			
			if (buttonValue === "didDonut") {
				say("Good job!");
			} else if (buttonValue === "scheduled") {
				say("Enjoy your donut!");
			} else {
				say("Smh... schedule it soon!");
			}

			// Update firebase
			let dinuBotData = db.doc("InternalProjects/DinuBot");
			dinuBotData.get().then((documentSnapshot) => {
				let pairingsData = documentSnapshot.data()["Pairs"];
				for (const pairings of pairingsData["pairs"]) {
					if (pairings["groupChatID"] == body["channel"]["id"]) {
						pairings["status"] = buttonValue;
						// console.log(pairingsData);
					}
				}
				dinuBotData.firestore.doc("InternalProjects/DinuBot")
				.update({ Pairs: pairingsData})
			})

		} catch (error) {
			console.error("Error handling action:", error);
		}
	},
);

const createGroupChatAndSendMessage = async (userIds, messageText) => {
	try {
		const conversation = await slackClient.conversations.open({
			users: userIds,
			return_im: true,
		});

		const date = new Date();
		date.setDate(date.getDate());

		if (conversation.ok) {

			// SENDS MESSAGE - SEPT 12TH, UNCOMMENT AFTER WEEKLY SUMMARY FEATURE IS DONE

			await slackClient.chat.postMessage({
				channel: conversation.channel.id,
				text: messageText,
			});

			try {
				const sevenDaysFromNow = new Date();
				// 7 days
				// sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

				// 3 mins
				sevenDaysFromNow.setTime(sevenDaysFromNow.getTime() + 3 * 60 * 1000); // Adding 3 minutes in milliseconds

			// MESSAGE SCHEDULER - SEPT 12TH, UNCOMMENT AFTER WEEKLY SUMMARY FEATURE IS DONE

				const checkinMessage = await slackClient.chat.scheduleMessage({
					channel: conversation.channel.id,
					text: "Time for a midpoint check-in! The next round of donuts go out next Monday! Did you meet yet? (buttons coming soon)",
					attachments: [
						{
							text: "Click the button below:",
							fallback: "You are unable to interact with this button.",
							callback_id: "donutCheckin",
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
					post_at: Math.floor(sevenDaysFromNow.getTime() / 1000),
				});

			} catch (error) {
				console.error(error);
			}

			// Add groups to firebase
			let dinuBotData = db.doc("InternalProjects/DinuBot");
			dinuBotData.get().then((documentSnapshot) => {
				let pairingsData = documentSnapshot.data()["Pairs"];
			
				pairingsData["pairs"].push({
					"groupChatID": conversation.channel.id,
					"members": userIds.split(","),
					"status": "Not yet"
				})

				dinuBotData.firestore.doc("InternalProjects/DinuBot")
				.update({ Pairs: pairingsData})
			})
		}
	} catch (error) {
		console.error("Error creating group chat and sending message:", error);
	}
};

// Button actions
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

// TESTING PURPOSES
slackBot.action(
	{ callback_id: "message_scheduling_button_action" },
	async ({ ack, body, say }) => {
		try {
			await ack(); // Acknowledge the action request

			const buttonValue = body.actions[0].value;

			if (buttonValue === "cat") {
				say("ayy cat");
			} else if (buttonValue === "dog") {
				say("eh");
			} else {
				say("Unknown button action.");
			}
		} catch (error) {
			console.error("Error handling action:", error);
		}
	},
);

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

// duplicate of previous algo
const pairMembers = async (staticArray, dynamicArray) => {
	// console.log(staticArray)
	// console.log(dynamicArray)
	// Temporarily multiple channel ids for dev
	// const channelID = "C05A02Q37FC"; // dinutest
	const channelID = process.env.channelID;
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
		const [matchings, updatedDynamicArray] = createMatchings(
			staticArray,
			dynamicArray,
		);

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

const updateMemberArrays = async (staticArray, dynamicArray) => {
	// Temporarily multiple channel ids for dev
	// const channelID = "C05A02Q37FC"; // dinutest
	const channelID = process.env.channelID;

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
		if (!memberIDs.includes(staticMember)) {
			staticArray = [];
			dynamicArray = [];
		}
	}
	for (const dynamicMember of dynamicArray) {
		if (!memberIDs.includes(dynamicMember)) {
			staticArray = [];
			dynamicArray = [];
		}
	}

	// shuffle memberIDs (incase members in channel changes)
	const shuffledMemberIDs = memberIDs.sort((a, b) => 0.5 - Math.random());

	for (const memberID of shuffledMemberIDs) {
		// if memberID is not in either arrays
		if (
			!(staticArray.includes(memberID) || dynamicArray.includes(memberID))
		) {
			// dynamicArray should > or = to staticArray
			if (staticArray.length == dynamicArray.length) {
				dynamicArray.push(memberID);
			} else {
				staticArray.push(memberID);
			}
		}
	}
	return [staticArray, dynamicArray];
};

// Determines if it's time to send out new donuts (runs on interval)
const timeForDonutScheduler = async () => {
	let dinuBotData = db.doc("InternalProjects/DinuBot");
	dinuBotData.get().then((documentSnapshot) => {
		let statusData = documentSnapshot.data()["Status"];
		convertTimeStamp(
			statusData["schedule"]["nextDonut"]["dateToPairMembers"],
		).then(function (nextDonutDay) {
			const nextDonutDate = nextDonutDay[0];
			const nextDonutHour = nextDonutDay[1];
			// Today
			const today = new Date();
			const currentDate =
				today.getFullYear() +
				"-" +
				today.getMonth() +
				"-" +
				today.getDate();
			const currentHour = today.getHours();
			// Determine if we should pair members up now
			if (currentDate == nextDonutDate && currentHour == nextDonutHour) {

				// Send weekly summary message
				let dinuBotData = db.doc("InternalProjects/DinuBot");
				dinuBotData.get().then((documentSnapshot) => {
					let pairingsMet = 0;
					
					let pairingsData = documentSnapshot.data()["Pairs"];
					for (const pairings of pairingsData["pairs"]) {
						if (pairings["status"] == "didDonut") {
							pairingsMet += 1;
						}
					}
				
					let pairingsMetPercent = ((pairingsMet/pairingsData["pairs"].length) * 100).toFixed(0);
					
					slackClient.chat.postMessage({
						channel: channelID,
						text: pairingsMetPercent + "%" + " of the groups met, let's get that to 100% this week!",
					});

					// Clear Pairings on firebase
					pairingsData["pairs"] = []
					dinuBotData.firestore.doc("InternalProjects/DinuBot")
					.update({ Pairs: pairingsData})
				})

			

				// get current member arrays
				let currentStaticArray =
					statusData["groupOfMembers"]["groupOfMembersStatic"];
				let currentDynamicArray =
					statusData["groupOfMembers"]["groupOfMembersDynamic"];
				updateMemberArrays(
					currentStaticArray,
					currentDynamicArray,
				).then(function (updatedArrays) {
					pairMembers(updatedArrays[0], updatedArrays[1]).then(
						function (updatedArrays) {
							// pair people up
							statusData["groupOfMembers"][
								"groupOfMembersStatic"
							] = updatedArrays[0]; // even if it's static, update it in case members join/leave
							statusData["groupOfMembers"][
								"groupOfMembersDynamic"
							] = updatedArrays[1];
							const nextDonutDate = new Date();
							nextDonutDate.setDate(nextDonutDate.getDate() + 14);
							statusData["schedule"]["nextDonut"]["sent"] = true; // set sent to True (is this necessary?)
							statusData["schedule"]["nextDonut"][
								"dateToPairMembers"
							] = nextDonutDate; // set next donut date
							statusData["schedule"]["nextDonut"]["sent"] = false; // set sent to False (is this necessary?)
							// update data
							dinuBotData.firestore
								.doc("InternalProjects/DinuBot")
								.update({ Status: statusData });
						},
					);
				});
			} else {
				console.log("Not time for donut yet");
			}
		});
	});
};

// Production

// // runs interval to schedule donuts and update variables
// // change this to 30 later, only need to run this every 30mins, not 0.2mins
// const minutes = 30, the_interval = minutes * 60 * 1000;
// setInterval(function() {
//   // Check if donuts should be sent
//   timeForDonutScheduler()
//   // check if new members have been added (maybe a member join or leave event?)
// }, the_interval);

// ------------------------------------------------------ ^^^

// for testing purposes
timeForDonutScheduler()

slackBot.start(3000);
