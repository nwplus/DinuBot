// roster.js — public donut join and leave actions
const { buildPublicDonutBlocks } = require("../slack/blocks");
const { updatePublishRoster } = require("../repository");

function getRosterContext(body) {
	return {
		publicChannel: body.channel?.id,
		publicTs: body.message?.ts,
		userId: body.user?.id,
	};
}

function membershipError(operation) {
	return operation === "join"
		? "You're already on the roster! :white_check_mark:"
		: "You're not on the roster.";
}

function missingRecordError(operation) {
	return operation === "join"
		? "Could not find this donut publish record. It may have expired."
		: "Could not find this donut publish record.";
}

function rosterError(operation, code, max) {
	if (code === "not_found") return missingRecordError(operation);
	if (code === "roster_full")
		return `This donut's roster is full (maximum ${max} people). You can join if someone leaves.`;
	return membershipError(operation);
}

async function postRosterUpdate(operation, context, record, client) {
	const { publicChannel, publicTs, userId } = context;
	const newBlocks = buildPublicDonutBlocks(
		record.draftText,
		record.details,
		record.currentRoster,
	);
	try {
		await client.chat.update({
			channel: publicChannel,
			ts: publicTs,
			blocks: newBlocks,
			text: record.draftText,
		});
	} catch (error) {
		console.error(`Failed to update public donut on ${operation}`, error);
	}

	const isJoin = operation === "join";
	const announcement = isJoin
		? `:tada: <@${userId}> joined!`
		: `:wave: <@${userId}> left.`;
	const rosterMentions = record.currentRoster.length
		? record.currentRoster.map((id) => `<@${id}>`).join(" ")
		: "No attendees yet";
	try {
		await client.chat.postMessage({
			channel: publicChannel,
			thread_ts: publicTs,
			text: announcement,
			blocks: [
				{
					type: "section",
					text: { type: "mrkdwn", text: announcement },
				},
				{
					type: "context",
					elements: [
						{
							type: "mrkdwn",
							text: `Notifying: ${rosterMentions}`,
						},
					],
				},
			],
		});
	} catch (error) {
		console.error(
			`Failed to post thread notification on ${operation}`,
			error,
		);
	}
}

async function handleRosterAction(operation, body, client, db) {
	const context = getRosterContext(body);
	if (!context.publicChannel || !context.publicTs || !context.userId)
		throw new Error(
			"Roster action is missing channel, message, or user ID",
		);

	const result = await updatePublishRoster(
		operation,
		context.publicChannel,
		context.publicTs,
		context.userId,
		db,
	);
	if (result.error) {
		await client.chat.postEphemeral({
			channel: context.publicChannel,
			user: context.userId,
			text: rosterError(operation, result.error, result.max),
		});
		return;
	}
	await postRosterUpdate(operation, context, result.record, client);
}

function registerRosterHandlers({ slackBot, db }) {
	slackBot.action("join_donut_publish", async ({ ack, body, client }) => {
		try {
			await ack();
			await handleRosterAction("join", body, client, db);
		} catch (error) {
			console.error("join_donut_publish error", error);
		}
	});

	slackBot.action("leave_donut_publish", async ({ ack, body, client }) => {
		try {
			await ack();
			await handleRosterAction("leave", body, client, db);
		} catch (error) {
			console.error("leave_donut_publish error", error);
		}
	});
}

module.exports = { registerRosterHandlers };
