// index.js — public facade for publish LLM functionality

const client = require("./client");
const prompts = require("./prompts");

module.exports = {
	...client,
	...prompts,
};
