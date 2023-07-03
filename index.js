const { App, LogLevel } = require("@slack/bolt");
const { WebClient } = require("@slack/web-api");
const { getUserMatchings } = require("./src/matching");

require("dotenv").config();

const botToken = process.env.token;
const botSigningSecret = process.env.signingSecret;
const botAppToken = process.env.appToken;

const slackClient = new WebClient(botToken);

const app = new App({
	token: botToken, //Find in the Oauth  & Permissions tab
	signingSecret: botSigningSecret, // Find in Basic Information Tab
	socketMode: true,
	appToken: botAppToken, // Token from the App-level Token that we created
	logLevel: LogLevel.DEBUG, // Enable debug logging
});

app.command("/test", async ({ command, event, say }) => {
	try {
		console.log(event);
		say(`<@${event}> hello!`);
	} catch (error) {
		console.error("Error running test command:", error);
	}
});

app.message("getMembersInChannel", async ({ command, say }) => {
	console.log("Ran hello");
	try {
		say("AHAHAHAHAHHAH");
	} catch (error) {
		console.error("Error getting members in channel:", error);
	}

	getMembersInChannel("C05A02Q37FC");
});

app.message("createGroupChat", async ({ command, say }) => {
	const userIds = "U03EJU7AVFD,U02HGHR0W3F"; // Donald and Yan's user ids for dev purposes
	createGroupChatAndSendMessage(userIds, "Hello World!");
});

app.message("donutCheckin", async ({ command, say }) => {
	donutCheckin(
		"C05A02Q37FC",
		"Time for a midpoint check-in! The next round of donuts go out on...",
		"button_clicked",
	);
});

app.message("createMatching", async ({ command, say }) => {
	const channelID = "C05A02Q37FC";
	try {
		const result = await slackClient.conversations.members({
			channel: channelID,
		});

		memberIDs = result.members;
		const matchings = getUserMatchings(memberIDs);
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
			await slackClient.chat.postMessage({
				channel: channelID,
				text: messageText,
			});
		}
	} catch (error) {
		console.error("Error creating matching:", error);
	}
});

const createGroupChatAndSendMessage = async (userIds, messageText) => {
	try {
		const conversation = await slackClient.conversations.open({
			users: userIds,
			return_im: true,
		});

		if (conversation.ok) {
			await slackClient.chat.postMessage({
				channel: conversation.channel.id,
				text: messageText,
			});
		}
	} catch (error) {
		console.error("Error creating group chat and sending message:", error);
	}
};

async function getMembersInChannel(channelID) {
	const membersInChannel = [];
	try {
		const result = await slackClient.conversations.members({
			channel: channelID,
		});

		memberIDs = result.members;
		for (memberID of memberIDs) {
			const userInfo = await slackClient.users.info({
				user: memberID,
			});

			// Log dev info
			console.log(userInfo.user["real_name"]);
			console.log(memberID);

			membersInChannel.push(userInfo.user["real_name"]);
			// console.log(userInfo.user)
			// console.log(userInfo.user["real_name"])
			const response = await slackClient.chat.postMessage({
				channel: channelID,
				text: userInfo.user["profile"]["display_name"],
			});
		}

		console.log("Message sent successfully:", response.ts);
	} catch (error) {
		console.error("Error sending message:", error);
	}
}

// getMembersInChannel("C05A02Q37FC")

app.action("button_clicked", async ({ ack, say }) => {
	console.log("before ack");
	try {
		await ack(); // Acknowledge the action request
		console.log("after ack");

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

async function donutCheckin(channel, message, buttonAction) {
	try {
		const response = await slackClient.chat.postMessage({
			channel: channel,
			text: message,
			attachments: [
				{
					// type: "interactive_message",
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
}

/*
donutCheckin(
  "C05A02Q37FC",
  "Time for a midpoint check-in! The next round of donuts go out on...",
  "button_clicked",
);
*/

app.error((error) => {
	// Check the details of the error
	console.error(error);
});

app.start(3000);
