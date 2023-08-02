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

module.exports = { getMembersInChannel, donutCheckin };
