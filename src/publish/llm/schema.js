// schema.js — structured output contract for publish LLM calls

const DONUT_DETAILS_RESPONSE_FORMAT = {
	type: "json_schema",
	json_schema: {
		name: "donut_details",
		strict: true,
		schema: {
			type: "object",
			properties: {
				dateTime: {
					type: "string",
					description:
						"The meetup time, or exactly TBD if it is not explicit.",
				},
				place: {
					type: "string",
					description:
						"The meetup location, or exactly TBD if it is not explicit.",
				},
				activity: {
					type: "string",
					description:
						"A concise activity phrase that preserves meaningful surrounding context.",
				},
				emojis: {
					type: "string",
					description: "One or two emojis relevant to the activity.",
				},
			},
			required: ["dateTime", "place", "activity", "emojis"],
			additionalProperties: false,
		},
	},
};

module.exports = { DONUT_DETAILS_RESPONSE_FORMAT };
