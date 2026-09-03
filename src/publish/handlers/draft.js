// draft.js — Slack handlers for consent, drafting, and publishing
const {
	buildPreviewBlocks,
	buildInsufficientDetailsBlocks,
} = require("../slack/blocks");
const {
	getPendingPublish,
	setPendingPublish,
	deletePendingPublish,
} = require("../repository");
const { generateRevisedDraft } = require("../llm");
const { getMissingDetails, hasRequiredDetails } = require("../drafts");

const { getActionValue, getPendingReference } = require("../slack/interaction");

async function isRelevantThreadReply(event, client) {
	if (!event.thread_ts || event.thread_ts === event.ts) return false;
	if (event.subtype === "bot_message" || event.bot_id || event.bot_profile)
		return false;
	if (!event.text || !event.text.trim()) return false;
	if (event.channel_type && !["im", "mpim"].includes(event.channel_type))
		return false;
	const auth = await client.auth.test();
	if (!auth?.user_id)
		throw new Error("Slack auth did not return the bot user ID");
	const botUserId = auth.user_id;
	if (event.user === botUserId) return false;
	return event.text.includes(`<@${botUserId}>`);
}

async function handleThreadReply(event, client, { db }) {
	if (!(await isRelevantThreadReply(event, client))) return;

	const dmChannelId = event.channel;
	const pending = await getPendingPublish(dmChannelId, db, event.thread_ts);
	if (!pending?.previewTs || pending.previewTs !== event.thread_ts) return;

	const feedback = event.text.trim();
	try {
		await client.reactions.add({
			channel: dmChannelId,
			timestamp: event.ts,
			name: "eyes",
		});
	} catch (error) {
		console.error("eyes reaction failed", error);
	}

	let statusTs = null;
	try {
		const status = await client.chat.postMessage({
			channel: dmChannelId,
			thread_ts: event.thread_ts,
			text: "Got feedback, revising draft... :hourglass_flowing_sand:",
		});
		statusTs = status.ts || status.message?.ts;
	} catch (error) {
		console.error("thread status post failed", error);
	}

	const revised = await generateRevisedDraft(
		pending.details,
		pending.draftText,
		feedback,
		pending.roster,
		db,
	);
	const { details: newDetails, draftText: newDraftText } = revised;
	const newRoster = pending.roster;

	if (!hasRequiredDetails(newDetails)) {
		const missing = getMissingDetails(newDetails);
		const text = `I couldn't revise the draft because it is missing ${missing.join(
			" and ",
		)}.`;
		await client.chat.postMessage({
			channel: dmChannelId,
			thread_ts: event.thread_ts,
			blocks: buildInsufficientDetailsBlocks(missing),
			text,
		});
		return;
	}

	await setPendingPublish(
		dmChannelId,
		{
			draftText: newDraftText,
			details: newDetails,
			roster: newRoster,
			previewTs: pending.previewTs,
			createdAt: pending.createdAt,
			requester: pending.requester,
		},
		db,
	);

	const newBlocks = buildPreviewBlocks(
		newDraftText,
		newDetails,
		newRoster,
		dmChannelId,
		pending.previewTs,
	);
	await client.chat.update({
		channel: dmChannelId,
		ts: pending.previewTs,
		blocks: newBlocks,
		text: newDraftText,
	});

	try {
		await client.reactions.remove({
			channel: dmChannelId,
			timestamp: event.ts,
			name: "eyes",
		});
	} catch (error) {
		console.error("remove eyes failed", error);
	}

	try {
		await client.reactions.add({
			channel: dmChannelId,
			timestamp: event.ts,
			name: "white_check_mark",
		});
	} catch (error) {
		console.error("checkbox reaction failed", error);
	}

	const doneText =
		"Updated the draft based on your feedback! Review the main message above.";
	if (statusTs) {
		try {
			await client.chat.update({
				channel: dmChannelId,
				ts: statusTs,
				text: doneText,
				blocks: [
					{
						type: "section",
						text: { type: "mrkdwn", text: doneText },
					},
				],
			});
		} catch (error) {
			console.error("status update to done failed", error);
		}
	} else {
		await client.chat.postMessage({
			channel: dmChannelId,
			thread_ts: event.thread_ts,
			text: doneText,
		});
	}
}

async function handleConfirmDraft({ ack, body, client }, workflows) {
	await ack();
	const dmChannelId = getActionValue(body);
	const userId = body.user?.id;
	const consentTs = body.message.ts;
	try {
		const text =
			"Got it! Reading the chat and drafting a publish post... :hourglass_flowing_sand:";
		await client.chat.update({
			channel: dmChannelId,
			ts: consentTs,
			blocks: [{ type: "section", text: { type: "mrkdwn", text } }],
			text,
		});
	} catch (error) {
		console.error("consent update to drafting failed", error);
	}
	await workflows.doLLMDraft(dmChannelId, userId, client, consentTs);
}

async function handleCancelDraft({ ack, body, client }) {
	await ack();
	const dmChannelId = getActionValue(body);
	const messageTs = body.message?.ts;
	try {
		const text = "_Cancelled._ Chat history was not sent to LLM.";
		await client.chat.update({
			channel: dmChannelId,
			ts: messageTs,
			blocks: [{ type: "section", text: { type: "mrkdwn", text } }],
			text: "Cancelled. Chat history was not sent to LLM.",
		});
	} catch (error) {
		console.error("cancel update failed", error);
		const userId = body.user?.id;
		await client.chat.postEphemeral({
			channel: dmChannelId,
			user: userId,
			text: "Cancelled. Chat history was not sent to LLM.",
		});
	}
}

async function handleApprovePublish({ ack, body, client }, workflows, db) {
	await ack();
	const { dmChannelId, previewTs } = getPendingReference(body);
	const publisherUserId = body.user?.id;
	const pending = await getPendingPublish(dmChannelId, db, previewTs);
	if (!pending) {
		await client.chat.postEphemeral({
			channel: dmChannelId,
			user: publisherUserId,
			text: "No pending draft found for this DM. Try pressing :mega: Publish again to generate a new draft.",
		});
		return;
	}
	try {
		await workflows.publishToPublicChannel(
			pending,
			dmChannelId,
			publisherUserId,
		);
		await deletePendingPublish(dmChannelId, db, previewTs);
	} catch (error) {
		console.error("approve_publish failed", error);
		await client.chat.postEphemeral({
			channel: dmChannelId,
			user: publisherUserId,
			text: `Could not publish this donut: ${error.message}`,
		});
	}
}

async function handleDiscardPublish({ ack, body, client }, db) {
	await ack();
	const { dmChannelId, previewTs } = getPendingReference(body);
	const messageTs = body.message?.ts;
	await deletePendingPublish(dmChannelId, db, previewTs);

	try {
		const text =
			"_Draft discarded._ Run `/publish` or hit *Publish* again to create a new one.";
		await client.chat.update({
			channel: dmChannelId,
			ts: messageTs,
			blocks: [{ type: "section", text: { type: "mrkdwn", text } }],
			text: "Draft discarded.",
		});
	} catch (error) {
		console.error("discard update failed", error);
	}
}

function registerDraftHandlers({ slackBot, db, workflows }) {
	slackBot.event("message", async ({ event, client }) => {
		try {
			await handleThreadReply(event, client, { db });
		} catch (error) {
			console.error("thread feedback handler error", error);
		}
	});

	slackBot.action("confirm_llm_draft", (args) =>
		handleConfirmDraft(args, workflows).catch((error) =>
			console.error("confirm_llm_draft error", error),
		),
	);
	slackBot.action("cancel_llm_draft", (args) =>
		handleCancelDraft(args).catch((error) =>
			console.error("cancel_llm_draft error", error),
		),
	);
	slackBot.action("publishDonut", async ({ ack, body, client }) => {
		try {
			await ack();
			await workflows.handlePublishDonutFlow(body, client);
		} catch (error) {
			console.error("publishDonut action error", error);
		}
	});
	slackBot.action("approve_publish", (args) =>
		handleApprovePublish(args, workflows, db).catch((error) =>
			console.error("approve_publish error", error),
		),
	);
	slackBot.action("discard_publish_draft", (args) =>
		handleDiscardPublish(args, db).catch((error) =>
			console.error("discard_publish_draft error", error),
		),
	);
	slackBot.command("/publish", async ({ command, ack, client }) => {
		await ack();
		const dmChannelId = command.channel_id;
		const userId = command.user_id;
		const text = (command.text || "").trim();
		if (!text) {
			await workflows.handlePublishDonutFlow(
				{ channel: { id: dmChannelId }, user: { id: userId } },
				client,
			);
			return;
		}
		await workflows.createCustomPublishDraft(
			dmChannelId,
			userId,
			text,
			client,
		);
	});
}

module.exports = { registerDraftHandlers };
