// handlers.js — publish handler registration
const { createPublishWorkflows } = require("../workflows");
const { registerDraftHandlers } = require("./draft");
const { registerRosterHandlers } = require("./roster");
const { registerTimezoneHandlers } = require("./timezone");
const { registerSettingsHandlers } = require("./settings");

function registerPublishHandlers(slackBot, slackClient, db, getBotUserId) {
	const workflows = createPublishWorkflows({ db, slackClient, getBotUserId });
	registerDraftHandlers({ slackBot, db, workflows });
	registerTimezoneHandlers({ slackBot, slackClient, db });
	registerRosterHandlers({ slackBot, db });
	registerSettingsHandlers({ slackBot, db });
}

module.exports = { registerPublishHandlers };
