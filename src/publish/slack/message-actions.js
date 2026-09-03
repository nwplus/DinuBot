// slack.js — Slack API operations for publish messages
const { buildDisabledPublishPromptBlocks } = require("./blocks");

async function disablePublishButtonsInDM(
	dmChannelId,
	slackClient,
	existingRecord,
) {
	const disabledBlocks = buildDisabledPublishPromptBlocks(existingRecord);
	const history = await slackClient.conversations.history({
		channel: dmChannelId,
		limit: 50,
	});
	if (!history.ok)
		throw new Error(
			`Could not read publish prompts: ${
				history.error || "unknown error"
			}`,
		);
	for (const msg of history.messages || []) {
		if (!msg.blocks) continue;
		const serializedBlocks = JSON.stringify(msg.blocks);
		const hasPublish =
			serializedBlocks.includes("publishDonut") ||
			serializedBlocks.includes("approve_publish");
		if (!hasPublish) continue;
		await slackClient.chat.update({
			channel: dmChannelId,
			ts: msg.ts,
			blocks: disabledBlocks,
			text:
				msg.text || `Published to <#${existingRecord.publicChannelId}>`,
			unfurl_links: false,
			unfurl_media: false,
		});
	}
}

module.exports = { disablePublishButtonsInDM };
