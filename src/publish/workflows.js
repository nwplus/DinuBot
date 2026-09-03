// workflows.js — publish and draft workflows
const {
	buildPreviewBlocks,
	buildPublicDonutBlocks,
	buildInsufficientDetailsBlocks,
	buildAlreadyPublishedBlocks,
	buildLLMConsentBlocks,
} = require("./slack/blocks");
const {
	setPendingPublish,
	getPublishedByDM,
	isAlreadyPublished,
	updatePublishRecord,
} = require("./repository");
const { disablePublishButtonsInDM } = require("./slack/message-actions");
const { hasRequiredDetails, getMissingDetails } = require("./drafts");
const { getPublishChannelId } = require("./config");
const { generateDonutDraft } = require("./llm");
const {
	fetchChannelHistory,
	fetchDMParticipants,
} = require("./slack/conversations");
const { getInteractionChannelId } = require("./slack/interaction");

const PUBLISH_ALREADY_EXISTS_TEXT =
	":white_check_mark: This donut has already been published!";

function createPublishWorkflows({ db, slackClient, getBotUserId }) {
	async function notifyAlreadyPublished(dmChannelId, client) {
		const existing = await getPublishedByDM(dmChannelId, db);
		const blocks = buildAlreadyPublishedBlocks(existing);
		await client.chat.postMessage({
			channel: dmChannelId,
			blocks,
			text: PUBLISH_ALREADY_EXISTS_TEXT,
			unfurl_links: false,
			unfurl_media: false,
		});
		return existing;
	}

	async function handlePublishDonutFlow(body, client) {
		const dmChannelId = getInteractionChannelId(body);

		if (await isAlreadyPublished(dmChannelId, db)) {
			await notifyAlreadyPublished(dmChannelId, client);
			return;
		}

		if (!process.env.OPENAI_API_KEY) {
			const text =
				":warning: Publishing requires LLM — please set `OPENAI_API_KEY` to enable this feature. No heuristic fallback.";
			const blocks = [
				{ type: "section", text: { type: "mrkdwn", text } },
				{
					type: "context",
					elements: [
						{
							type: "mrkdwn",
							text: "Ask an admin to configure the LLM API key, then try again.",
						},
					],
				},
			];
			try {
				await client.chat.postMessage({
					channel: dmChannelId,
					blocks,
					text,
				});
			} catch (error) {
				console.error("publish missing-LLM notify failed", error);
			}
			return;
		}

		try {
			const blocks = buildLLMConsentBlocks(dmChannelId);
			const text =
				"Let an LLM read this chat history to propose a draft message? You will review the draft before publishing.";
			await client.chat.postMessage({
				channel: dmChannelId,
				blocks,
				text,
			});
		} catch (error) {
			console.error("consent post failed", error);
		}
	}

	async function resolveParticipants(dmChannelId, client) {
		const participants = await fetchDMParticipants(dmChannelId, client);
		const botUserId = await getBotUserId(client);

		const roster = [
			...new Set(participants.filter((id) => id !== botUserId)),
		];
		if (!roster.length)
			throw new Error("No human participants found in this DM");
		return roster;
	}

	async function postMissingDetails(dmChannelId, details, client, consentTs) {
		const missing = getMissingDetails(details);
		const blocks = buildInsufficientDetailsBlocks(missing);
		const text = `Please put the ${missing.join(
			" and ",
		)} of your donut into the chat before publishing!`;

		if (consentTs)
			await client.chat.update({
				channel: dmChannelId,
				ts: consentTs,
				blocks,
				text,
			});
		else
			await client.chat.postMessage({
				channel: dmChannelId,
				blocks,
				text,
			});
	}

	async function postDraftPreview(
		dmChannelId,
		draftText,
		details,
		roster,
		client,
		consentTs = null,
	) {
		const previewBlocks = buildPreviewBlocks(
			draftText,
			details,
			roster,
			dmChannelId,
			consentTs,
		);

		if (consentTs) {
			await client.chat.update({
				channel: dmChannelId,
				ts: consentTs,
				blocks: previewBlocks,
				text: draftText,
			});
			return consentTs;
		}

		const response = await client.chat.postMessage({
			channel: dmChannelId,
			blocks: previewBlocks,
			text: draftText,
		});
		const previewTs = response?.ts;
		if (!response?.ok || !previewTs)
			throw new Error("Slack did not return a preview timestamp");

		const updatedBlocks = buildPreviewBlocks(
			draftText,
			details,
			roster,
			dmChannelId,
			previewTs,
		);
		await client.chat.update({
			channel: dmChannelId,
			ts: previewTs,
			blocks: updatedBlocks,
			text: draftText,
		});
		return previewTs;
	}

	async function savePendingDraft(
		dmChannelId,
		draftText,
		details,
		roster,
		previewTs,
		requester,
	) {
		await setPendingPublish(
			dmChannelId,
			{
				draftText,
				details,
				roster,
				previewTs,
				createdAt: new Date().toISOString(),
				requester,
			},
			db,
		);
	}

	async function generateAndSaveDraft({
		dmChannelId,
		history,
		requester,
		client,
		consentTs,
	}) {
		const participants = await resolveParticipants(dmChannelId, client);

		const { details, draftText } = await generateDonutDraft(
			history,
			participants,
			db,
		);

		if (!hasRequiredDetails(details)) {
			await postMissingDetails(dmChannelId, details, client, consentTs);
			return;
		}

		const previewTs = await postDraftPreview(
			dmChannelId,
			draftText,
			details,
			participants,
			client,
			consentTs,
		);

		await savePendingDraft(
			dmChannelId,
			draftText,
			details,
			participants,
			previewTs,
			requester,
		);
	}

	async function doLLMDraft(
		dmChannelId,
		requestingUserId,
		client,
		consentTs = null,
	) {
		try {
			const history = await fetchChannelHistory(dmChannelId, client);

			await generateAndSaveDraft({
				dmChannelId,
				history,
				requester: requestingUserId,
				client,
				consentTs,
			});
		} catch (error) {
			console.error("doLLMDraft error:", error);
			try {
				const text = `Failed to generate publish draft: ${error.message}`;
				const blocks = [
					{ type: "section", text: { type: "mrkdwn", text } },
				];

				if (consentTs)
					await client.chat.update({
						channel: dmChannelId,
						ts: consentTs,
						blocks,
						text,
					});
				else
					await client.chat.postMessage({
						channel: dmChannelId,
						text,
					});
			} catch (notifyError) {
				console.error("doLLMDraft error notify failed", notifyError);
			}
		}
	}

	async function publishToPublicChannel(
		pending,
		dmChannelId,
		publisherUserId,
	) {
		const publicChannelId = getPublishChannelId();
		if (
			!pending?.draftText ||
			!pending.details ||
			!Array.isArray(pending.roster)
		)
			throw new Error("Pending publish is incomplete");

		const { draftText, details } = pending;
		const currentRoster = [...new Set(pending.roster)];

		if (!hasRequiredDetails(details))
			throw new Error("Pending publish is missing time or place");
		if (!currentRoster.length)
			throw new Error("Pending publish has no roster");
		const blocks = buildPublicDonutBlocks(
			draftText,
			details,
			currentRoster,
		);

		if (await isAlreadyPublished(dmChannelId, db)) {
			return notifyAlreadyPublished(dmChannelId, slackClient);
		}

		const result = await slackClient.chat.postMessage({
			channel: publicChannelId,
			blocks,
			text: draftText,
		});
		if (!result?.ok || !result.ts)
			throw new Error(
				`Slack could not publish the donut: ${
					result?.error || "missing message timestamp"
				}`,
			);

		const publicMessageTs = result.ts;
		const record = {
			publicChannelId,
			publicMessageTs,
			dmChannelId,
			draftText,
			details,
			originalRoster: [...currentRoster],
			currentRoster: [...currentRoster],
			createdAt: new Date().toISOString(),
			createdBy: publisherUserId,
		};
		await updatePublishRecord(record, db);

		try {
			await disablePublishButtonsInDM(dmChannelId, slackClient, record);
		} catch (error) {
			console.error("disablePublishButtonsInDM failed", error);
		}
		try {
			const publicBlocks = buildPublicDonutBlocks(
				draftText,
				details,
				currentRoster,
			);
			await slackClient.chat.postMessage({
				channel: dmChannelId,
				text: `Forwarded from <#${publicChannelId}>`,
				blocks: [
					{
						type: "context",
						elements: [
							{
								type: "mrkdwn",
								text: `Forwarded from <#${publicChannelId}>:`,
							},
						],
					},
					...publicBlocks,
				],
			});
		} catch (error) {
			console.error("forward post failed", error);
		}
		return record;
	}

	async function createCustomPublishDraft(dmChannelId, userId, text, client) {
		try {
			if (await isAlreadyPublished(dmChannelId, db)) {
				await notifyAlreadyPublished(dmChannelId, client);
				return;
			}

			await generateAndSaveDraft({
				dmChannelId,
				history: [{ text, user: userId }],
				requester: userId,
				client,
			});
		} catch (error) {
			console.error("custom publish error", error);
			await client.chat.postMessage({
				channel: dmChannelId,
				text: `Failed to generate custom draft: ${error.message}`,
			});
		}
	}

	return {
		handlePublishDonutFlow,
		doLLMDraft,
		publishToPublicChannel,
		createCustomPublishDraft,
	};
}

module.exports = { createPublishWorkflows };
