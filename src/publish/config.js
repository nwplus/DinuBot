// config.js — publish configuration

function getPublishChannelId() {
	const channelId = process.env.PUBLISH_CHANNEL_ID;
	if (typeof channelId !== "string" || !channelId.trim())
		throw new Error("PUBLISH_CHANNEL_ID is required");
	return channelId.trim();
}

module.exports = { getPublishChannelId };
