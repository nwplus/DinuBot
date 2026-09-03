// conversations.js — Slack conversation readers used by publish workflows

async function fetchChannelHistory(channelId, slackClient, limit = 100) {
	const response = await slackClient.conversations.history({
		channel: channelId,
		limit,
	});

	if (!response.ok)
		throw new Error(
			`Failed to fetch Slack channel history: ${
				response.error || "unknown error"
			}`,
		);

	return (response.messages || []).reverse().map((message) => ({
		text: message.text || "",
		user: message.user || null,
		ts: message.ts,
		bot_id: message.bot_id || null,
	}));
}

async function fetchDMParticipants(channelId, slackClient) {
	const response = await slackClient.conversations.members({
		channel: channelId,
	});

	if (!response.ok)
		throw new Error(
			`Failed to fetch Slack conversation members: ${
				response.error || "unknown error"
			}`,
		);

	const members = response.members || [];
	if (!members.length)
		throw new Error("Slack returned no members for the DM");

	return members;
}

module.exports = { fetchChannelHistory, fetchDMParticipants };
