const getMembersInChannel = async (client, channelID) => {
	const membersInChannel = [];
	try {
		const result = await client.conversations.members({
			channel: channelID,
		});

		memberIDs = result.members;
		for (memberID of memberIDs) {
			const userInfo = await client.users.info({
				user: memberID,
			});

			// Log dev info
			console.log(userInfo.user["real_name"]);
			console.log(memberID);

			membersInChannel.push(userInfo.user["real_name"]);
		}
	} catch (error) {
		console.error("Error sending message:", error);
	}
};

const donutCheckin = async (slackClient, channel, message, buttonAction) => {
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


// A function to schedule messages
const scheduleMessage = async (slackClient, channel) => {
	try {
		const response = await slackClient.chat.scheduleMessage({
			channel: channel,
			text: "Message scheduling test",
			post_at: Math.floor(Date.now() / 1000) + 10,
			attachments: [
				{
					text: "Choose your weapon:",
					fallback: "You are unable to interact with this button.",
					callback_id: "message_scheduling_button_action",
					actions: [
						{
							name: "button",
							text: "cat",
							type: "button",
							value: "cat",
						},
						{
							name: "button",
							text: "dog",
							type: "button",
							value: "dog",
						},
					],
				},
			],
		});

		console.log("Message scheduled successfully:", response);
	} catch (error) {
		console.error("Error scheduling message:", error);
	}
};

module.exports = { getMembersInChannel, donutCheckin, scheduleMessage };
