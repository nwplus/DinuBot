const exp = require("constants");
const { getUserMatchings } = require("../src/matching");
const assert = require("assert");

test("getUserMatchings", () => {
	expect(getUserMatchings(["1", "2", "3", "4"]).length).toEqual(2);
	expect(getUserMatchings(["1", "2", "3", "4", "5"]).length).toEqual(2);
});
