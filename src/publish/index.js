// index.js — barrel for publish directory (requires from src/publish)
const blocks = require("./slack/blocks");
const repo = require("./repository");
const config = require("./config");
const drafts = require("./drafts");
const llm = require("./llm");
const conversations = require("./slack/conversations");
const slack = require("./slack/message-actions");

module.exports = {
	...blocks,
	...repo,
	...config,
	...drafts,
	...llm,
	...conversations,
	...slack,
};
