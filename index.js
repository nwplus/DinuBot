const { App } = require("@slack/bolt");
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
});

app.command("/test", async ({ command, event, say }) => {
	try {
		console.log(event);
		say(`<@${event}> hello!`);
	} catch (error) {
		console.error("Error running test command:", error);
	}
});

app.message("getMembersInChannel", async ({ channel, command, say }) => {
	console.log("Ran hello");
	try {
		say("AHAHAHAHAHHAH");
	} catch (error) {
		console.error("Error getting members in channel:", error);
	}

	getMembersInChannel("C05A02Q37FC");
});

// testing purposes
app.message("createGroupChat", async ({ command, say }) => {
	const userIds = "U03EJU7AVFD,U02HGHR0W3F"; // Donald and Yan's user ids for dev purposes
	createGroupChatAndSendMessage(userIds, "Hello World!");
});


app.message("createMatching", async ({ command, say }) => {
	// const channelID = "C05A02Q37FC";
	const channelID = "C05FLQKBEA0";
	try {
		const result = await slackClient.conversations.members({
			channel: channelID,
		});

		memberIDs = result.members;
    // Removes DinuBot from the list of members in a channel so no one gets paired up with it
    // const botUserID = context.botUserId;
	const botUserID = "U05A02QR4BU";
    const botIndex = memberIDs.indexOf(botUserID);
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
			createGroupChatAndSendMessage(
				matchingString,
				"Hello you're on a donut ( ͡° ͜ʖ ͡°)!",
			);

		}
	} catch (error) {
		console.error("Error creating matching:", error);
	}
});

function formatUserIds(ids) {
	return ids.join(",");
}

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
				  post_at: Math.floor(threeDaysFromNow.getTime() / 1000)
				});
			  }
			  catch (error) {
				console.error(error);
			  }
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
