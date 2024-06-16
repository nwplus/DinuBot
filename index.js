const { App } = require("@slack/bolt");
const { WebClient } = require("@slack/web-api");
const { getUserMatchings, createMatchings } = require("./src/matching");
const { formatUserIds, convertTimeStamp } = require("./src/utils");

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore"); // Import Firestore related functions
const { endAt } = require("@firebase/firestore");

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

// Define a command handler for "/dinubot"
slackBot.command("/dinustatus", async ({ command, ack, say }) => {
	// Acknowledge the command
	await ack();

	// Respond with a message
	// await say(`DinuBot is running\nDate: ` + new Date());

	const blocks = [
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: "*Status update:* DinuBot is up and running :fire:",
			},
			accessory: {
				type: "image",
				image_url:
					"https://raw.githubusercontent.com/nwplus/DinuBot/dev/images/logo.png",
				alt_text: "DinuBot Logo",
			},
		},
		{
			type: "section",
			fields: [
				{
					type: "mrkdwn",
					text: "*Timestamp:* " + new Date(),
				},
			],
		},
	];

	await say({
		blocks: blocks,
	});
});

slackBot.action({ callback_id: "donutCheckin" }, async ({ ack, body, say }) => {
	try {
		await ack(); // Acknowledge the action request

		// Reminder: body contains info about the button, message, etc
		const buttonValue = body.actions[0].value;

		if (buttonValue === "didDonut") {
			say("Good job! :saluting_face:");
		} else if (buttonValue === "scheduled") {
			say("Enjoy your donut! :doughnut:");
		} else {
			say("Schedule it soon :neutral_face: ");
		}

		// Update firebase
		let dinuBotData = db.doc("InternalProjects/DinuBot");
		dinuBotData.get().then((documentSnapshot) => {
			let pairingsData = documentSnapshot.data()["Pairs"];
			for (const pairings of pairingsData["pairs"]) {
				if (pairings["groupChatID"] == body["channel"]["id"]) {
					pairings["status"] = buttonValue;
				}
			}
			dinuBotData.firestore
				.doc("InternalProjects/DinuBot")
				.update({ Pairs: pairingsData });
		});
	} catch (error) {
		console.error("Error handling action:", error);
	}
});

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
				// 7 days
				// sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

				// 3 mins - TESTING PURPOSES
				// sevenDaysFromNow.setTime(sevenDaysFromNow.getTime() + 3 * 60 * 1000); // Adding 3 minutes in milliseconds

				// schedules message
				const checkinMessage = await slackClient.chat.scheduleMessage({
					channel: conversation.channel.id,
					text: "Time for a midpoint check-in! The next round of donuts go out next Monday! Did you meet yet? :eyes:",
					attachments: [
						{
							text: "Click the button below:",
							fallback:
								"You are unable to interact with this button.",
							callback_id: "donutCheckin",
							actions: [
								{
									name: "button",
									text: "Yes :white_check_mark:",
									type: "button",
									value: "didDonut",
								},
								{
									name: "button",
									text: "It's scheduled :spiral_calendar_pad:",
									type: "button",
									value: "scheduled",
								},
								{
									name: "button",
									text: "Not yet :x:",
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
					groupChatID: conversation.channel.id,
					members: userIds.split(","),
					status: "Not yet",
				});

				dinuBotData.firestore
					.doc("InternalProjects/DinuBot")
					.update({ Pairs: pairingsData });
			});
		}
	} catch (error) {
		console.error("Error creating group chat and sending message:", error);
	}
};

const pairMembers = async (staticArray, dynamicArray) => {
	const channelID = process.env.channelID;
	try {
		const membersInfo = await slackClient.conversations.members({
			channel: channelID,
		});

		// -------------- If member is not in either static or dynamic array, add them

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

			const matchingString = formatUserIds(matching);

			createGroupChatAndSendMessage(
				matchingString,
				"Hello :wave: you're on a donut ( ͡° ͜ʖ ͡°)!",
			);
		}
		return [staticArray, updatedDynamicArray];
	} catch (error) {
		console.error("Error creating matching:", error);
	}
};

const updateMemberArrays = async (staticArray, dynamicArray) => {
	// Temporarily multiple channel ids for dev
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

	// Populate members in Firebase
	let dinuBotData = db.doc("InternalProjects/DinuBot");
	let documentSnapshot = await dinuBotData.get();
	let membersData = documentSnapshot.data()["Members"] || { members: [] };

	// TO DO -> figure out how to keep attributes updated and correctly update members firebase when new user is added or removed from channel
	// Initialize members in Firebase if empty
	if (membersData.members.length === 0) {
		memberIDs.forEach((memberID) => {
			membersData.members.push({
				dontPair: [],
				id: memberID,
				optIn: true,
			});
		});
	} else {
		// Add new members
		memberIDs.forEach((memberID) => {
			if (!membersData.members.some((member) => member.id === memberID)) {
				membersData.members.push({
					dontPair: [],
					id: memberID,
					optIn: true,
				});
			}
		});

		// Remove members who left
		membersData.members = membersData.members.filter((member) =>
			memberIDs.includes(member.id),
		);
	}

	await dinuBotData.update({ Members: membersData });

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

	// Grab data from Firebase to get members who opted out
	documentSnapshot = await dinuBotData.get();
	membersData = documentSnapshot.data()["Members"].members;

	const optOut = membersData
		.filter((member) => !member.optIn)
		.map((member) => member.id);

	// Remove opted-out members from dynamic and static arrays
	dynamicArray = dynamicArray.filter((member) => !optOut.includes(member));
	staticArray = staticArray.filter((member) => !optOut.includes(member));

	// Rebalance static and dynamic arrays
	while (true) {
		const lengthDifference = dynamicArray.length - staticArray.length;
		if (lengthDifference === 0 || lengthDifference === 1) {
			break;
		}

		if (dynamicArray.length > staticArray.length) {
			staticArray.push(dynamicArray.pop());
		} else {
			dynamicArray.push(staticArray.pop());
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

					let pairingsMetPercent = (
						(pairingsMet / pairingsData["pairs"].length) *
						100
					).toFixed(0);

					slackClient.chat.postMessage({
						channel: channelID,
						text:
							":bar_chart: Weekly Summary: " +
							pairingsMetPercent +
							"%" +
							" of the groups met, let's get that to 100% this week!",
					});

					// Clear Pairings on firebase
					pairingsData["pairs"] = [];
					dinuBotData.firestore
						.doc("InternalProjects/DinuBot")
						.update({ Pairs: pairingsData });
				});

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

// runs interval to schedule donuts and update variables
// change this to 30 later, only need to run this every 30mins, not 0.2mins
const minutes = 30,
	the_interval = minutes * 60 * 1000;
setInterval(function () {
	// Check if donuts should be sent
	timeForDonutScheduler();
}, the_interval);

// ------------------------------------------------------ ^^^

// for testing purposes
// timeForDonutScheduler();

// testing purposes for ticket 1
test1 = [];
test2 = [];
// updateMemberArrays(test1, test2);

slackBot.start(3000);
