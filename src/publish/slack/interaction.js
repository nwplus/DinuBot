// payload.js — Slack interaction payload parsing

function getInteractionChannelId(body) {
	const channelId = body?.channel?.id || body?.container?.channel_id;
	if (typeof channelId !== "string" || !channelId.trim())
		throw new Error("Slack interaction is missing its channel ID");
	return channelId.trim();
}

function getActionValue(body) {
	const value = body?.actions?.[0]?.value;
	if (typeof value !== "string" || !value.trim())
		throw new Error("Slack interaction is missing its action value");
	return value.trim();
}

function getPendingReference(body) {
	const rawValue = getActionValue(body);
	const separator = rawValue.indexOf(":");
	if (separator <= 0 || separator === rawValue.length - 1)
		throw new Error("Publish action is missing its preview reference");
	return {
		dmChannelId: rawValue.substring(0, separator),
		previewTs: rawValue.substring(separator + 1),
	};
}

module.exports = {
	getInteractionChannelId,
	getActionValue,
	getPendingReference,
};
