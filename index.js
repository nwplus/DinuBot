const { App } = require("@slack/bolt");
const { WebClient } = require("@slack/web-api");

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

app.action("button_clicked", async ({ ack, body, say }) => {
	console.log("sshshsh");
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

async function donutCheckin(channel, message, buttonAction) {
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
}

// donutCheckin(
//   "C05A02Q37FC",
//   "Time for a midpoint check-in! The next round of donuts go out on...",
//   "button_clicked",
// );

app.start(3000);
