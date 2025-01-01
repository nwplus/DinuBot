const { App } = require("@slack/bolt");
const { WebClient } = require("@slack/web-api");
const { createMatchings } = require("./src/matching");
const { formatUserIds, convertTimeStamp } = require("./src/utils");

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const crypto = require("crypto");

require("dotenv").config();

initializeApp({
	credential: applicationDefault(),
	databaseURL: process.env.databaseURL,
});

// Initialize Firebase
const db = getFirestore();

const botToken = process.env.token;
const botSigningSecret = process.env.signingSecret;
const botAppToken = process.env.appToken;
const channelID = process.env.channelID;

const slackClient = new WebClient(botToken);

const slackBot = new App({
	token: botToken,
	signingSecret: botSigningSecret,
	socketMode: true,
	appToken: botAppToken,
});

let userSelections = {}; // To store user selections

const secretKey = Buffer.from(process.env.SECRET_KEY, "hex");
const iv = Buffer.from(process.env.IV, "hex");

console.log("Secret key: ");
console.log(secretKey);
console.log("IV: ");
console.log(iv);

// Encryption function
function encrypt(userID) {
	try {
		let cipher = crypto.createCipheriv("aes-256-cbc", secretKey, iv);
		let encrypted = cipher.update(userID, "utf8", "hex");
		encrypted += cipher.final("hex");
		return encrypted;
	} catch (error) {
		console.error("Encryption error:", error);
		return null;
	}
}

// Decryption function
function decrypt(encryptedUserID) {
	try {
		let decipher = crypto.createDecipheriv("aes-256-cbc", secretKey, iv);
		let decrypted = decipher.update(encryptedUserID, "hex", "utf8");
		decrypted += decipher.final("utf8");

		return decrypted;
	} catch (error) {
		console.error("Decryption error:", error);
		return null;
	}
}

// Helper function to get user full name by Slack user ID
async function getUserFullName(userId) {
	try {
		const response = await slackClient.users.info({ user: userId });
		if (response.ok) {
			const profile = response.user.profile;
			const firstName = profile.first_name || "";
			const lastName = profile.last_name || "";
			return `${firstName} ${lastName}`.trim();
		} else {
			throw new Error(`Error fetching user info: ${response.error}`);
		}
	} catch (error) {
		console.error(
			`Failed to retrieve user info for user ID ${userId}:`,
			error,
		);
		return userId; // Fallback to user ID if API call fails
	}
}

// Function to publish the home view
async function publishHomeView(user_id, client) {
	try {
		// Fetch user data from Firebase
		const dinuBotData = db.doc("InternalProjects/DinuBot");
		const documentSnapshot = await dinuBotData.get();
		const membersData = documentSnapshot.data()["Members"];
		let optInStatus = null;

		// Looks for the user who pressed home to fetch their user preferences
		let user;
		membersData.members.forEach((member) => {
			if (member.id === user_id) {
				// Assuming user_id contains the user ID
				optInStatus = member.optIn;
				user = member;
			}
		});

		// Fetch display names for blocked users
		let blockedUserNames = ["...", "..."];
		if (user) {
			const blockedUsersPromises = user.dontPair.map(
				async (blockedMember) => {
					console.log(blockedMember);
					console.log(decrypt(blockedMember));
					return await getUserFullName(decrypt(blockedMember));
				},
			);
			blockedUserNames = await Promise.all(blockedUsersPromises);
			console.log(blockedUserNames);
		}

		// Create text to display blocked users
		const blockedUsersText =
			blockedUserNames.length > 0
				? `Don't pair me with: ${blockedUserNames.join(", ")}`
				: 'You have not selected any users for "don\'t pair me with".';

		// Determine button text based on optInStatus
		const buttonText = optInStatus
			? ":red_circle: Opt-out"
			: ":large_green_circle: Opt-in";

		// Publish updated view to Slack
		await client.views.publish({
			user_id: user_id,
			view: {
				type: "home",
				blocks: [
					{
						type: "header",
						text: {
							type: "plain_text",
							text: ":gear: Settings",
							emoji: true,
						},
					},
					{
						type: "section",
						text: {
							type: "plain_text",
							text: "Set your preferences with Dinubot. Opt-out of the next rotation until you manually opt-in again. If 2 cycles have passed, you will automatically be opted in.",
							emoji: true,
						},
					},
					{
						type: "actions",
						elements: [
							{
								type: "button",
								text: {
									type: "plain_text",
									text: buttonText,
									emoji: true,
								},
								value: user_id,
								action_id: "opt_out",
							},
						],
					},
					{
						type: "divider",
					},
					{
						type: "header",
						text: {
							type: "plain_text",
							text: ":x: Don't Pair Me With",
							emoji: true,
						},
					},
					{
						type: "section",
						text: {
							type: "plain_text",
							text: "You can set your preference to prevent being matched with someone—maximum 2 users at a time.",
							emoji: true,
						},
					},
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: "Don't pair me with...",
						},
						accessory: {
							type: "users_select",
							placeholder: {
								type: "plain_text",
								text: "Select a user",
								emoji: true,
							},
							action_id: "users_select_1",
						},
					},
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: "Don't pair me with...",
						},
						accessory: {
							type: "users_select",
							placeholder: {
								type: "plain_text",
								text: "Select a user",
								emoji: true,
							},
							action_id: "users_select_2",
						},
					},
					{
						type: "section",
						text: {
							type: "plain_text",
							text: blockedUsersText,
							emoji: true,
						},
					},
					{
						type: "actions",
						elements: [
							{
								type: "button",
								text: {
									type: "plain_text",
									text: "Save don't pair me with",
									emoji: true,
								},
								action_id: "save_preferences",
							},
							{
								type: "button",
								text: {
									type: "plain_text",
									text: "Reset don't pair me with",
									emoji: true,
								},
								action_id: "reset_preferences",
							},
						],
					},
				],
			},
		});
	} catch (error) {
		console.log("Error publishing view:", error);
	}
}

// Home tab event listener
slackBot.event("app_home_opened", async ({ event, client }) => {
	await publishHomeView(event.user, client);
});

// Opt-out button action handler
slackBot.action("opt_out", async ({ body, ack, client }) => {
	await ack();

	const userId = body.user.id;

	await client.views.update({
		view_id: body.view.id,
		view: {
			type: "home",
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: "Processing your request... :hourglass_flowing_sand:",
					},
				},
			],
		},
	});

	// Update Firebase to set the opt-out status for the user
	try {
		let dinuBotData = db.doc("InternalProjects/DinuBot");
		let documentSnapshot = await dinuBotData.get();
		let membersData = documentSnapshot.data()["Members"];

		// Find the member and update the opt-out status
		let updatedOptInStatus;
		membersData.members = membersData.members.map((member) => {
			if (member.id === userId) {
				member.optIn = !member.optIn;
				updatedOptInStatus = member.optIn;
			}
			return member;
		});

		// Update Firestore with the new members data
		await dinuBotData.update({ Members: membersData });

		const successMessage = updatedOptInStatus
			? "You have successfully opted in! :white_check_mark:"
			: "You have successfully opted out! :white_check_mark:";

		// Refresh the Home tab view
		await client.views.publish({
			user_id: userId,
			view: {
				type: "home",
				callback_id: "home_view",
				blocks: [
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: successMessage,
						},
					},
					{
						type: "actions",
						elements: [
							{
								type: "button",
								text: {
									type: "plain_text",
									text: "Back Home",
									emoji: true,
								},
								action_id: "back_home",
							},
						],
					},
				],
			},
		});
	} catch (error) {
		console.error("Error updating Firebase:", error);
	}
});

// Back home button action handler
slackBot.action("back_home", async ({ body, ack, client }) => {
	await ack();
	await publishHomeView(body.user.id, client);
});

// Users select action handlers
slackBot.action("users_select_1", async ({ body, ack }) => {
	await ack();
	const userId = body.user.id;
	const selectedUser = body.actions[0].selected_user;

	// Initialize userSelections if it doesn't exist
	if (!userSelections[userId]) {
		userSelections[userId] = { dontPair: [] };
	}

	// Encrypt and store selectedUser
	userSelections[userId].dontPair[0] = encrypt(selectedUser);
});

slackBot.action("users_select_2", async ({ body, ack }) => {
	await ack();
	const userId = body.user.id;
	const selectedUser = body.actions[0].selected_user;

	// Initialize userSelections if it doesn't exist
	if (!userSelections[userId]) {
		userSelections[userId] = { dontPair: [] };
	}

	// Encrypt and store selectedUser
	userSelections[userId].dontPair[1] = encrypt(selectedUser);
});

// Save button action handler
slackBot.action("save_preferences", async ({ body, ack, client }) => {
	await ack();
	const userId = body.user.id;

	try {
		let dinuBotData = db.doc("InternalProjects/DinuBot");
		let documentSnapshot = await dinuBotData.get();
		let membersData = documentSnapshot.data()["Members"];
		let user = membersData.members.find((member) => member.id === userId);

		let selectedUsers = [];
		if (userSelections[userId] && userSelections[userId].dontPair) {
			if (userSelections[userId].dontPair[0]) {
				selectedUsers.push(userSelections[userId].dontPair[0]);
			}
			if (userSelections[userId].dontPair[1]) {
				selectedUsers.push(userSelections[userId].dontPair[1]);
			}
		}

		if (user.dontPair.length >= 2) {
			// User already has 2 blocked users
			await client.views.publish({
				user_id: userId,
				view: {
					type: "home",
					callback_id: "home_view",
					blocks: [
						{
							type: "section",
							text: {
								type: "mrkdwn",
								text: "You already have too many people blocked! Please hit reset. :warning:",
							},
						},
						{
							type: "actions",
							elements: [
								{
									type: "button",
									text: {
										type: "plain_text",
										text: "Back Home",
										emoji: true,
									},
									action_id: "back_home",
								},
							],
						},
					],
				},
			});
		} else {
			// Update the user's dontPair array
			membersData.members = membersData.members.map((member) => {
				if (member.id === userId) {
					member.dontPair = userSelections[userId]?.dontPair || [];
				}
				return member;
			});

			userSelections = {}; // Clear user selections after save
			await dinuBotData.update({ Members: membersData });

			// Refresh the Home tab view
			await client.views.publish({
				user_id: userId,
				view: {
					type: "home",
					callback_id: "home_view",
					blocks: [
						{
							type: "section",
							text: {
								type: "mrkdwn",
								text: "Your Don't Pair List has been saved successfully! :white_check_mark:",
							},
						},
						{
							type: "actions",
							elements: [
								{
									type: "button",
									text: {
										type: "plain_text",
										text: "Back Home",
										emoji: true,
									},
									action_id: "back_home",
								},
							],
						},
					],
				},
			});
		}
	} catch (error) {
		console.error("Error saving preferences:", error);
	}
});

// Reset button action handler

slackBot.action("reset_preferences", async ({ body, ack, client }) => {
	await ack();

	const userId = body.user.id;

	// Update Firebase to set the opt-out status for the user
	try {
		let dinuBotData = db.doc("InternalProjects/DinuBot");
		let documentSnapshot = await dinuBotData.get();
		let membersData = documentSnapshot.data()["Members"];

		// Find the member and update the opt-out status
		let updatedOptInStatus;
		membersData.members = membersData.members.map((member) => {
			if (member.id === userId) {
				member.dontPair = [];
			}
			return member;
		});

		// Update Firestore with the new members data
		await dinuBotData.update({ Members: membersData });

		// Refresh the Home tab view
		await client.views.publish({
			user_id: userId,
			view: {
				type: "home",
				callback_id: "home_view",
				blocks: [
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: "You have successfully reset your Dont Pair list! It is now empty :white_check_mark:",
						},
					},
					{
						type: "actions",
						elements: [
							{
								type: "button",
								text: {
									type: "plain_text",
									text: "Back Home",
									emoji: true,
								},
								action_id: "back_home",
							},
						],
					},
				],
			},
		});
	} catch (error) {
		console.error("Error updating Firebase:", error);
	}
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
				text: "*Status update:* DinuBot is up and running :fire::fire:",
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
				const twelveDaysFromNow = new Date();
				// 7 days
				sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
				// 12 days
				twelveDaysFromNow.setDate(twelveDaysFromNow.getDate() + 12);

				// 3 mins - TESTING PURPOSES
				// sevenDaysFromNow.setTime(sevenDaysFromNow.getTime() + 3 * 60 * 1000); // Adding 3 minutes in milliseconds
				// twelveDaysFromNow.setTime(twelveDaysFromNow.getTime() + 4 * 60 * 1000); // Adding 4 minutes in milliseconds

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

				// schedules message
				const checkinMessageTwo =
					await slackClient.chat.scheduleMessage({
						channel: conversation.channel.id,
						text: "Just checking in again incase the above has changed! The next round of donuts go out on Monday! Did you meet yet? :eyes:",
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
						post_at: Math.floor(twelveDaysFromNow.getTime() / 1000),
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

		let dinuBotData = db.doc("InternalProjects/DinuBot");
		let documentSnapshot = await dinuBotData.get();
		let membersData = documentSnapshot.data()["Members"] || { members: [] };

		let matched = false;
		let matchings = [];
		let counter = 0;

		while (!matched) {
			console.log(counter);
			counter += 1;

			if (counter > 500) {
				slackClient.chat.postMessage({
					channel: channelID,
					text: "No donuts possible, too many members are opted-out or blocked!",
				});
				break;
			}

			[matchings, updatedDynamicArray] = createMatchings(
				staticArray,
				dynamicArray,
				4, // Specify group size
			);

			console.log(matchings);

			matched = matchings.every((group) => {
				return group.every((userA, _, arr) => {
					return arr.every((userB) => {
						if (userA === userB) return true;

						const memberA = membersData.members.find(
							(member) => member.id === userA,
						);
						const memberB = membersData.members.find(
							(member) => member.id === userB,
						);

						// Decrypt all dontPairs
						let memberAdontPair =
							memberA?.dontPair?.map(decrypt) || [];
						let memberBdontPair =
							memberB?.dontPair?.map(decrypt) || [];

						return (
							!memberAdontPair.includes(userB) &&
							!memberBdontPair.includes(userA)
						);
					});
				});
			});
		}

		for (const matching of matchings) {
			const displayNames = [];
			for (const userId of matching) {
				const userInfo = await slackClient.users.info({
					user: userId,
				});
				const displayName = userInfo.user["profile"]["real_name"];
				displayNames.push(displayName);
			}

			const matchingString = formatUserIds(matching);

			createGroupChatAndSendMessage(
				matchingString,
				"Hello :wave: you're on a group donut ( ͡° ͜ʖ ͡°)!",
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

	// Initialize members in Firebase if empty
	if (membersData.members.length === 0) {
		memberIDs.forEach((memberID) => {
			membersData.members.push({
				dontPair: [],
				id: memberID,
				optIn: true,
				optOutCycles: 0,
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
					optOutCycles: 0,
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

	membersData = membersData.map((member) => {
		if (!member.optIn) {
			member.optOutCycles += 1;
			if (member.optOutCycles >= 2) {
				member.optIn = true;
				member.optOutCycles = 0;
			}
		}
		return member;
	});

	await dinuBotData.update({ Members: { members: membersData } });

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
						if (
							pairings["status"] == "didDonut" ||
							pairings["status"] == "scheduled"
						) {
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
const minutes = 0.2,
	the_interval = minutes * 60 * 1000;
setInterval(function () {
	// Check if donuts should be sent
	timeForDonutScheduler();
}, the_interval);

// ------------------------------------------------------ ^^^

// for testing purposes
timeForDonutScheduler();

// testing purposes for ticket 1
test1 = [];
test2 = [];
// updateMemberArrays(test1, test2);

slackBot.start(3000);
