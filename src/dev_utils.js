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

module.exports = { getMembersInChannel };
